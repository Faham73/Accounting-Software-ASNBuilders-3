import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { ZodError } from 'zod';
import { z } from 'zod';
import { getCompanyTotals } from '@/lib/projects/projectTotals.server';

const VoucherStatusFilterSchema = z.enum(['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED']);

// Helper to safely coerce date, treating empty strings as undefined
const safeDateCoerce = z.preprocess(
  (val) => {
    if (!val || (typeof val === 'string' && val.trim() === '')) return undefined;
    return val;
  },
  z.coerce.date().optional()
);

const DebitListFiltersSchema = z.object({
  projectId: z.string().optional(),
  dateFrom: safeDateCoerce,
  dateTo: safeDateCoerce,
  status: VoucherStatusFilterSchema.optional().default('ALL'),
  includeCompanyLevel: z
    .string()
    .optional()
    .transform((v) => v == null || v === '' || v === 'true'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
});

/**
 * GET /api/debit
 * List debit entries (voucher lines) company-wide with optional project filter
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'READ');

    const { searchParams } = new URL(request.url);
    
    // Build raw params object from URLSearchParams
    const rawParams: Record<string, string | undefined> = {};
    for (const [key, value] of searchParams.entries()) {
      rawParams[key] = value || undefined;
    }
    
    // Handle empty strings for optional fields (treat as undefined)
    const cleanedParams = {
      projectId: rawParams.projectId || undefined,
      dateFrom: rawParams.dateFrom && rawParams.dateFrom.trim() !== '' ? rawParams.dateFrom : undefined,
      dateTo: rawParams.dateTo && rawParams.dateTo.trim() !== '' ? rawParams.dateTo : undefined,
      status: rawParams.status || undefined,
      includeCompanyLevel: rawParams.includeCompanyLevel,
      page: rawParams.page || '1',
      pageSize: rawParams.pageSize || '25',
    };

    // Use safeParse to catch validation errors
    const parsed = DebitListFiltersSchema.safeParse(cleanedParams);
    
    if (!parsed.success) {
      console.error('DEBIT API: Invalid query params', {
        raw: cleanedParams,
        issues: parsed.error.issues,
      });
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid query params',
          raw: cleanedParams,
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const filters = parsed.data;

    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 25;

    const where: any = {
      companyId: auth.companyId,
      debit: { gt: 0 },
    };

    // Build voucher filters (status and date)
    const voucherFilters: any = {};
    if (filters.status !== 'ALL') {
      voucherFilters.status = filters.status;
    }
    const voucherDateFilter: any = {};
    if (filters.dateFrom) {
      voucherDateFilter.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      voucherDateFilter.lte = filters.dateTo;
    }
    if (Object.keys(voucherDateFilter).length > 0) {
      voucherFilters.date = voucherDateFilter;
    }

    // Build project filter and combine with voucher filters
    if (filters.projectId) {
      // When filtering by project: match if voucherLine.projectId OR voucher.projectId matches
      // This handles cases where voucherLine.projectId is null but voucher.projectId is set
      if (Object.keys(voucherFilters).length > 0) {
        where.AND = [
          {
            OR: [
              { projectId: filters.projectId },
              { voucher: { projectId: filters.projectId } },
            ],
          },
          {
            voucher: voucherFilters,
          },
        ];
      } else {
        where.OR = [
          { projectId: filters.projectId },
          { voucher: { projectId: filters.projectId } },
        ];
      }
    } else if (filters.includeCompanyLevel === false) {
      // Exclude company-level rows: exclude where BOTH voucherLine.projectId AND voucher.projectId are null
      // Include rows where voucherLine.projectId IS NOT NULL OR voucher.projectId IS NOT NULL
      if (Object.keys(voucherFilters).length > 0) {
        where.AND = [
          {
            OR: [
              { projectId: { not: null } },
              { voucher: { projectId: { not: null } } },
            ],
          },
          {
            voucher: voucherFilters,
          },
        ];
      } else {
        where.OR = [
          { projectId: { not: null } },
          { voucher: { projectId: { not: null } } },
        ];
      }
    } else if (Object.keys(voucherFilters).length > 0) {
      // No project filter, but have voucher filters
      where.voucher = voucherFilters;
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [debitLines, total, totals] = await Promise.all([
      prisma.voucherLine.findMany({
        where,
        skip,
        take,
        orderBy: [
          { voucher: { date: 'asc' } },
          { createdAt: 'asc' },
        ],
        include: {
          voucher: {
            select: {
              id: true,
              voucherNo: true,
              date: true,
              type: true,
              narration: true,
              status: true,
            },
          },
          account: {
            select: { id: true, code: true, name: true },
          },
          project: {
            select: { id: true, name: true },
          },
          paymentMethod: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.voucherLine.count({ where }),
      getCompanyTotals(auth.companyId, filters.projectId, {
        voucherStatus: filters.status as 'ALL' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED',
        includeCompanyLevel: filters.projectId ? undefined : filters.includeCompanyLevel,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      data: debitLines,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      totals: {
        debit: totals.debit,
      },
    });
  } catch (error) {
    // Log error for debugging
    console.error('DEBIT API ERROR', {
      error,
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Handle specific error types
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Validation error',
          issues: error.errors,
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

    // Unexpected errors return 500 with details
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        ok: false,
        error: 'Debit API failed',
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : undefined,
        stack: isDev && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
