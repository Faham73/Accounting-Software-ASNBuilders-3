import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { ProjectLedgerFiltersSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * GET /api/projects/[id]/ledger
 * Get project ledger (all posted voucher lines for a project)
 * Only includes vouchers with status = POSTED
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
    const filters = ProjectLedgerFiltersSchema.parse({
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      vendorId: searchParams.get('vendorId') || undefined,
      category: searchParams.get('category') || undefined,
      paymentMethodId: searchParams.get('paymentMethodId') || undefined,
      accountId: searchParams.get('accountId') || undefined,
      type: searchParams.get('type') || 'ALL',
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '20',
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

    // Build where clause for voucher lines
    // Project matching: prefer line.projectId, fallback to voucher.projectId
    const where: Prisma.VoucherLineWhereInput = {
      companyId: auth.companyId,
      voucher: voucherWhere,
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
    if (filters.accountId) {
      where.accountId = filters.accountId;
    }

    // Type filter (DEBIT/CREDIT)
    if (filters.type === 'DEBIT') {
      where.debit = { gt: 0 };
    } else if (filters.type === 'CREDIT') {
      where.credit = { gt: 0 };
    }


    const skip = (filters.page - 1) * filters.pageSize;
    const take = filters.pageSize;

    // Fetch ledger lines with related data
    const [lines, total] = await Promise.all([
      prisma.voucherLine.findMany({
        where,
        skip,
        take,
        orderBy: [
          { voucher: { date: 'asc' } },
          { voucher: { voucherNo: 'asc' } },
          { createdAt: 'asc' },
        ],
        include: {
          voucher: {
            select: {
              id: true,
              voucherNo: true,
              date: true,
              narration: true,
            },
          },
          account: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
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
        },
      }),
      prisma.voucherLine.count({ where }),
    ]);

    // Calculate totals
    const totalsResult = await prisma.voucherLine.aggregate({
      where,
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const totalDebit = Number(totalsResult._sum.debit || 0);
    const totalCredit = Number(totalsResult._sum.credit || 0);

    // Format response rows
    const rows = lines.map((line) => ({
      voucherId: line.voucher.id,
      voucherNo: line.voucher.voucherNo,
      voucherDate: line.voucher.date.toISOString().split('T')[0],
      voucherNarration: line.voucher.narration,
      lineId: line.id,
      accountId: line.account.id,
      accountCode: line.account.code,
      accountName: line.account.name,
      accountType: line.account.type,
      debit: Number(line.debit),
      credit: Number(line.credit),
      vendorId: line.vendor?.id || null,
      vendorName: line.vendor?.name || null,
      category: 'OTHERS',
      paymentMethodId: line.paymentMethod?.id || null,
      paymentMethodName: line.paymentMethod?.name || null,
      description: line.description,
    }));

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
          accountId: filters.accountId,
          type: filters.type,
        },
        rows,
        totals: {
          totalDebit,
          totalCredit,
          net: totalDebit - totalCredit,
        },
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total,
          totalPages: Math.ceil(total / filters.pageSize),
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
