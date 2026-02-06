import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { ExpenseCreateSchema, ExpenseListFiltersSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { generateVoucherNumber } from '@/lib/voucher';

/**
 * GET /api/expenses
 * List expenses for user's company with optional filters
 * Query params: mainProjectId, projectId, from, to, categoryId, source, q (search)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'expenses', 'READ');

    const { searchParams } = new URL(request.url);
    const filters = ExpenseListFiltersSchema.parse({
      mainProjectId: searchParams.get('mainProjectId') || undefined,
      projectId: searchParams.get('projectId') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      source: searchParams.get('source') || undefined,
      q: searchParams.get('q') || undefined,
    });

    // Build where clause
    const where: Prisma.ExpenseWhereInput = {
      companyId: auth.companyId,
    };

    // Filter by main project
    if (filters.mainProjectId) {
      where.mainProjectId = filters.mainProjectId;
    }

    // Filter by project (can be main or sub)
    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    // Date range filter
    if (filters.from || filters.to) {
      where.date = {};
      if (filters.from) {
        where.date.gte = new Date(filters.from);
      }
      if (filters.to) {
        const toDate = new Date(filters.to);
        toDate.setHours(23, 59, 59, 999); // Include entire day
        where.date.lte = toDate;
      }
    }

    // Filter by category
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    // Filter by source
    if (filters.source) {
      where.source = filters.source;
    }

    // Search in paidTo or notes
    if (filters.q) {
      where.OR = [
        { paidTo: { contains: filters.q, mode: 'insensitive' } },
        { notes: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            parentProjectId: true,
          },
        },
        mainProject: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
        paymentMethod: {
          select: {
            id: true,
            name: true,
          },
        },
        debitAccount: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        creditAccount: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        paidByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        voucher: {
          select: {
            id: true,
            voucherNo: true,
            status: true,
          },
        },
      },
    });

    // Transform to include formatted amounts (categoryNameSnapshot for stable reporting)
    const expensesWithFormatted = expenses.map((expense) => ({
      id: expense.id,
      projectId: expense.projectId,
      project: expense.project,
      mainProjectId: expense.mainProjectId,
      mainProject: expense.mainProject,
      date: expense.date,
      categoryId: expense.categoryId,
      category: expense.category,
      categoryNameSnapshot: expense.categoryNameSnapshot ?? expense.category?.name ?? null,
      source: expense.source,
      amount: Number(expense.amount),
      paidByUserId: expense.paidByUserId,
      paidByUser: expense.paidByUser,
      paidTo: expense.paidTo,
      vendorId: expense.vendorId,
      vendor: expense.vendor,
      paymentMethodId: expense.paymentMethodId,
      paymentMethod: expense.paymentMethod,
      debitAccountId: expense.debitAccountId,
      debitAccount: expense.debitAccount,
      creditAccountId: expense.creditAccountId,
      creditAccount: expense.creditAccount,
      voucherId: expense.voucherId,
      voucher: expense.voucher,
      notes: expense.notes,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    }));

    return NextResponse.json({
      ok: true,
      data: expensesWithFormatted,
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

/**
 * POST /api/expenses
 * Create a new expense with automatic voucher creation (requires WRITE permission)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'expenses', 'WRITE');

    const body = await request.json();

    // Validate input with Zod
    const validatedData = ExpenseCreateSchema.parse(body);

    // Verify project exists and belongs to user's company
    const project = await prisma.project.findFirst({
      where: {
        id: validatedData.projectId,
        companyId: auth.companyId,
      },
      include: {
        parentProject: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Project not found',
        },
        { status: 400 }
      );
    }

    // Determine mainProjectId: if project has parent, use parent; otherwise use project itself
    const mainProjectId = project.parentProjectId || project.id;

    // Verify main project exists
    const mainProject = await prisma.project.findFirst({
      where: {
        id: mainProjectId,
        companyId: auth.companyId,
      },
    });

    if (!mainProject) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Main project not found',
        },
        { status: 400 }
      );
    }

    // Verify category exists
    const category = await prisma.expenseCategory.findFirst({
      where: {
        id: validatedData.categoryId,
        companyId: auth.companyId,
      },
    });

    if (!category) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Expense category not found',
        },
        { status: 400 }
      );
    }

    // Verify vendor if provided
    if (validatedData.vendorId) {
      const vendor = await prisma.vendor.findFirst({
        where: {
          id: validatedData.vendorId,
          companyId: auth.companyId,
        },
      });

      if (!vendor) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Vendor not found',
          },
          { status: 400 }
        );
      }
    }

    // Verify payment method
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: validatedData.paymentMethodId,
        companyId: auth.companyId,
      },
    });

    if (!paymentMethod) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Payment method not found',
        },
        { status: 400 }
      );
    }

    // Verify debit account (expense account - must be system account and belong to selected category)
    const debitAccount = await prisma.account.findFirst({
      where: {
        id: validatedData.debitAccountId,
        companyId: auth.companyId,
        isActive: true,
        isSystem: true,
      },
      select: { id: true, expenseCategoryId: true },
    });

    if (!debitAccount) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Debit account (expense account) not found, inactive, or is not a system account',
        },
        { status: 400 }
      );
    }

    // Category / account mismatch: account must belong to the selected expense category
    if (debitAccount.expenseCategoryId !== validatedData.categoryId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Expense account must belong to the selected expense category',
        },
        { status: 400 }
      );
    }

    // Verify credit account (payment account - must be system account)
    const creditAccount = await prisma.account.findFirst({
      where: {
        id: validatedData.creditAccountId,
        companyId: auth.companyId,
        isActive: true,
        isSystem: true,
      },
    });

    if (!creditAccount) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Credit account (payment account) not found or inactive',
        },
        { status: 400 }
      );
    }

    // Date is already transformed by Zod schema
    const expenseDate = validatedData.date;

    // Generate voucher number
    const voucherNo = await generateVoucherNumber(auth.companyId, expenseDate);

    // Create expense + voucher + voucher lines in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create voucher with POSTED status (direct posting for expenses)
      const voucher = await tx.voucher.create({
        data: {
          companyId: auth.companyId,
          projectId: validatedData.projectId,
          voucherNo,
          type: 'PAYMENT',
          date: expenseDate,
          status: 'POSTED', // Direct posting for expenses
          narration: `Expense: ${category.name} - ${validatedData.notes || 'No description'}`,
          createdByUserId: auth.userId,
          postedByUserId: auth.userId,
          postedAt: new Date(),
          lines: {
            create: [
              // Debit: Expense account
              {
                companyId: auth.companyId,
                accountId: validatedData.debitAccountId,
                description: `Expense: ${category.name}`,
                debit: validatedData.amount,
                credit: 0,
                projectId: validatedData.projectId,
                paymentMethodId: validatedData.paymentMethodId,
              },
              // Credit: Payment account (Cash/Bank/etc)
              {
                companyId: auth.companyId,
                accountId: validatedData.creditAccountId,
                description: `Payment for ${category.name}`,
                debit: 0,
                credit: validatedData.amount,
                projectId: validatedData.projectId,
                paymentMethodId: validatedData.paymentMethodId,
                vendorId: validatedData.vendorId || null,
              },
            ],
          },
        },
      });

      // Create expense linked to voucher (with category snapshot for stable reporting)
      const expense = await tx.expense.create({
        data: {
          companyId: auth.companyId,
          projectId: validatedData.projectId,
          mainProjectId,
          date: expenseDate,
          categoryId: validatedData.categoryId,
          categoryNameSnapshot: category.name,
          source: validatedData.source,
          amount: validatedData.amount,
          paidByUserId: auth.userId,
          paidTo: validatedData.paidTo || null,
          vendorId: validatedData.vendorId || null,
          paymentMethodId: validatedData.paymentMethodId,
          debitAccountId: validatedData.debitAccountId,
          creditAccountId: validatedData.creditAccountId,
          voucherId: voucher.id,
          notes: validatedData.notes || null,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              parentProjectId: true,
            },
          },
          mainProject: {
            select: {
              id: true,
              name: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
          paymentMethod: {
            select: {
              id: true,
              name: true,
            },
          },
          debitAccount: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          creditAccount: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          paidByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          voucher: {
            select: {
              id: true,
              voucherNo: true,
              status: true,
            },
          },
        },
      });

      return expense;
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          ...result,
          amount: Number(result.amount),
        },
      },
      { status: 201 }
    );
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
