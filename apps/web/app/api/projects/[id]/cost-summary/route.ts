import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { ProjectCostSummaryFiltersSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { getProjectAllocatedOverhead } from '@/lib/reports/overhead';

/**
 * GET /api/projects/[id]/cost-summary
 * Get project cost summary grouped by cost category
 * Only includes expense lines from POSTED vouchers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'READ');

    // Verify project exists and belongs to user's company
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const includeAllocatedOverhead = searchParams.get('includeAllocatedOverhead') === 'true';
    const filters = ProjectCostSummaryFiltersSchema.parse({
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      vendorId: searchParams.get('vendorId') || undefined,
      category: searchParams.get('category') || undefined,
      paymentMethodId: searchParams.get('paymentMethodId') || undefined,
    });

    // Build voucher where clause first
    const voucherWhere: Prisma.VoucherWhereInput = {
      status: 'POSTED', // Only POSTED vouchers
      companyId: auth.companyId,
    };

    // Date range filter on voucher
    if (filters.from || filters.to) {
      voucherWhere.date = {};
      if (filters.from) {
        voucherWhere.date.gte = new Date(filters.from);
      }
      if (filters.to) {
        const toDate = new Date(filters.to);
        toDate.setHours(23, 59, 59, 999); // Include entire day
        voucherWhere.date.lte = toDate;
      }
    }

    // Build where clause for expense lines only
    const where: Prisma.VoucherLineWhereInput = {
      companyId: auth.companyId,
      account: {
        type: 'EXPENSE', // Only expense accounts
      },
      voucher: voucherWhere,
      // Project matching: prefer line.projectId, fallback to voucher.projectId
      OR: [
        { projectId: params.id },
        {
          AND: [
            { projectId: null },
            { voucher: { ...voucherWhere, projectId: params.id } },
          ],
        },
      ],
    };

    // Additional filters
    if (filters.vendorId) {
      where.vendorId = filters.vendorId;
    }
    if (filters.paymentMethodId) {
      where.paymentMethodId = filters.paymentMethodId;
    }


    // Get all expense lines for the project
    const lines = await prisma.voucherLine.findMany({
      where,
      include: {
      },
    });

    // Calculate voucher-based costs (legacy, for backward compatibility)
    // All voucher costs are categorized as 'OTHERS' since cost heads are removed
    const voucherCategoryTotals = new Map<string, number>();
    lines.forEach((line) => {
      const costAmount = Number(line.debit) - Number(line.credit);
      voucherCategoryTotals.set('OTHERS', (voucherCategoryTotals.get('OTHERS') || 0) + costAmount);
    });

    // Get expenses for this MAIN project and aggregate by dynamic category
    const expenseWhere: Prisma.ExpenseWhereInput = {
      companyId: auth.companyId,
      mainProjectId: params.id, // Use mainProjectId for filtering
    };

    // Apply date range filter to expenses if provided
    if (filters.from || filters.to) {
      expenseWhere.date = {};
      if (filters.from) {
        expenseWhere.date.gte = new Date(filters.from);
      }
      if (filters.to) {
        const toDate = new Date(filters.to);
        toDate.setHours(23, 59, 59, 999);
        expenseWhere.date.lte = toDate;
      }
    }

    // Apply vendor filter if provided
    if (filters.vendorId) {
      expenseWhere.vendorId = filters.vendorId;
    }

    // Apply payment method filter if provided
    if (filters.paymentMethodId) {
      expenseWhere.paymentMethodId = filters.paymentMethodId;
    }

    // Apply category filter if provided (map from ProjectCostCategory to ExpenseCategory)
    // Note: This is a legacy filter - in the future we should use categoryId
    if (filters.category) {
      // Find expense categories that match the ProjectCostCategory name
      const matchingCategories = await prisma.expenseCategory.findMany({
        where: {
          companyId: auth.companyId,
          name: {
            equals: filters.category.replace(/_/g, ' '),
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });
      if (matchingCategories.length > 0) {
        expenseWhere.categoryId = { in: matchingCategories.map((c) => c.id) };
      } else {
        // No matching category, return empty
        expenseWhere.categoryId = 'no-match';
      }
    }

    // Get all expense categories for this company (active + any used in expenses)
    const allCategories = await prisma.expenseCategory.findMany({
      where: {
        companyId: auth.companyId,
        OR: [
          { isActive: true },
          {
            expenses: {
              some: {
                companyId: auth.companyId,
                mainProjectId: params.id,
              },
            },
          },
        ],
      },
      orderBy: { name: 'asc' },
    });

    // Get expenses and aggregate by categoryId
    const expenseTotals = await prisma.expense.groupBy({
      by: ['categoryId'],
      where: expenseWhere,
      _sum: {
        amount: true,
      },
    });

    // Build a map of category totals
    const expenseCategoryTotals = new Map<string, number>();
    expenseTotals.forEach((item) => {
      if (item._sum.amount) {
        expenseCategoryTotals.set(item.categoryId, Number(item._sum.amount));
      }
    });

    // Combine voucher-based totals (legacy) with expense totals
    // For now, we'll prioritize expense totals and show categories from ExpenseCategory table
    const summaryByCategory = allCategories.map((category) => {
      const expenseAmount = expenseCategoryTotals.get(category.id) || 0;
      // Add voucher-based amount if category name matches (legacy support)
      const voucherAmount = voucherCategoryTotals.get(category.name.toUpperCase().replace(/\s+/g, '_')) || 0;
      const totalAmount = expenseAmount + voucherAmount;

      return {
        key: category.id,
        name: category.name,
        amount: totalAmount,
      };
    });

    // Also include categories that have voucher totals but no expense category (legacy)
    voucherCategoryTotals.forEach((amount, categoryName) => {
      const categoryKey = categoryName.toUpperCase().replace(/\s+/g, '_');
      const exists = summaryByCategory.some((cat) => 
        cat.name.toUpperCase().replace(/\s+/g, '_') === categoryKey
      );
      if (!exists && amount > 0) {
        summaryByCategory.push({
          key: categoryKey,
          name: categoryName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          amount,
        });
      }
    });

    // Sort by amount descending, then by name
    summaryByCategory.sort((a, b) => {
      if (b.amount !== a.amount) {
        return b.amount - a.amount;
      }
      return a.name.localeCompare(b.name);
    });

    // Calculate grand total from summary
    let totalCost = summaryByCategory.reduce((sum, cat) => sum + cat.amount, 0);

    // Add allocated overhead if requested
    let allocatedOverhead = 0;
    if (includeAllocatedOverhead && filters.from && filters.to) {
      // Calculate allocated overhead for each month in the date range
      const fromDate = new Date(filters.from);
      const toDate = new Date(filters.to);
      const currentMonth = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
      
      while (currentMonth <= toDate) {
        const monthAllocated = await getProjectAllocatedOverhead(
          auth.companyId,
          params.id,
          currentMonth
        );
        allocatedOverhead += monthAllocated;
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }
      
      totalCost += allocatedOverhead;
    }

    return NextResponse.json({
      ok: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
        },
        filtersApplied: {
          from: filters.from,
          to: filters.to,
          vendorId: filters.vendorId,
          category: filters.category,
          paymentMethodId: filters.paymentMethodId,
          includeAllocatedOverhead,
        },
        summaryByCategory,
        grandTotals: {
          totalCost,
          allocatedOverhead: includeAllocatedOverhead ? allocatedOverhead : undefined,
        },
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.errors[0]?.message || 'Validation error',
        },
        { status: 400 }
      );
    }
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}
