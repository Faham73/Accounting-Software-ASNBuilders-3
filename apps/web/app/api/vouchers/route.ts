import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { VoucherCreateSchema, VoucherListFiltersSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { generateVoucherNumber, validateVoucherBalance } from '@/lib/voucher';

/**
 * GET /api/vouchers
 * List vouchers for user's company with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'READ');

    const { searchParams } = new URL(request.url);
    const filters = VoucherListFiltersSchema.parse({
      status: searchParams.get('status') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      projectId: searchParams.get('projectId') || undefined,
      q: searchParams.get('q') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    });

    // Ensure page and limit are numbers (schema should handle this, but be explicit)
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;

    const where: any = {
      companyId: auth.companyId,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.date.lte = filters.dateTo;
      }
    }

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.q) {
      where.OR = [
        { voucherNo: { contains: filters.q, mode: 'insensitive' as const } },
        { narration: { contains: filters.q, mode: 'insensitive' as const } },
      ];
    }

    const skip = (page - 1) * limit;
    const take = limit;

    const [vouchers, total] = await Promise.all([
      prisma.voucher.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          project: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          postedBy: {
            select: { id: true, name: true, email: true },
          },
          lines: {
            include: {
              account: {
                select: { id: true, code: true, name: true },
              },
            },
          },
        },
      }),
      prisma.voucher.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      data: vouchers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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

/**
 * POST /api/vouchers
 * Create a new draft voucher
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    const body = await request.json();
    const validatedData = VoucherCreateSchema.parse(body);

    // Validate balance
    const balanceCheck = validateVoucherBalance(validatedData.lines);
    if (!balanceCheck.valid) {
      return NextResponse.json(
        {
          ok: false,
          error: balanceCheck.error,
        },
        { status: 400 }
      );
    }

    // Validate all accounts exist, belong to company, and are active
    const accountIds = validatedData.lines.map((line) => line.accountId);
    const accounts = await prisma.account.findMany({
      where: {
        id: { in: accountIds },
        companyId: auth.companyId,
        isActive: true,
        isSystem: true, // Only system accounts are allowed
      },
    });

    if (accounts.length !== accountIds.length) {
      return NextResponse.json(
        {
          ok: false,
          error: 'One or more accounts not found, inactive, or are not system accounts',
        },
        { status: 400 }
      );
    }

    // Validate project if provided
    if (validatedData.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: validatedData.projectId },
      });

      if (!project || project.companyId !== auth.companyId) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Project not found or does not belong to your company',
          },
          { status: 400 }
        );
      }
    }

    // Ensure office expenses don't have projectId
    if (validatedData.expenseType === 'OFFICE_EXPENSE' && validatedData.projectId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Office expenses cannot have a project assigned',
        },
        { status: 400 }
      );
    }

    // Generate voucher number
    const voucherNo = await generateVoucherNumber(auth.companyId, validatedData.date);

    // Create voucher with lines in a transaction
    const voucher = await prisma.$transaction(async (tx) => {
      const newVoucher = await tx.voucher.create({
        data: {
          companyId: auth.companyId,
          projectId: validatedData.expenseType === 'OFFICE_EXPENSE' ? null : (validatedData.projectId || null),
          voucherNo,
          date: validatedData.date,
          status: 'DRAFT',
          narration: validatedData.narration || null,
          expenseType: validatedData.expenseType || null,
          createdByUserId: auth.userId,
          lines: {
            create: validatedData.lines.map((line) => {
              // Determine projectId: use line.projectId if set, otherwise fall back to voucher.projectId
              // Exception: if isCompanyLevel is true or expenseType is OFFICE_EXPENSE, projectId should be null
              const voucherProjectId = validatedData.expenseType === 'OFFICE_EXPENSE' ? null : (validatedData.projectId || null);
              const lineProjectId = validatedData.expenseType === 'OFFICE_EXPENSE' 
                ? null 
                : (line.isCompanyLevel ? null : (line.projectId || voucherProjectId));
              
              return {
                companyId: auth.companyId,
                accountId: line.accountId,
                description: line.description || null,
                debit: line.debit,
                credit: line.credit,
                projectId: lineProjectId,
                isCompanyLevel: validatedData.expenseType === 'OFFICE_EXPENSE' ? false : (line.isCompanyLevel || false),
                vendorId: line.vendorId || null,
                paymentMethodId: line.paymentMethodId || null,
                expenseCategoryId: line.expenseCategoryId || null, // Only stored on debit lines (debit > 0)
                // PDF fields
                workDetails: line.workDetails || null,
                paidBy: line.paidBy || null,
                receivedBy: line.receivedBy || null,
                fileRef: line.fileRef || null,
                voucherRef: line.voucherRef || null,
              };
            }),
          },
        },
        include: {
          project: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          lines: {
            include: {
              account: {
                select: { id: true, code: true, name: true },
              },
              expenseCategory: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      return newVoucher;
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'VOUCHER',
      entityId: voucher.id,
      action: 'CREATE',
      after: voucher,
      request,
    });

    return NextResponse.json(
      {
        ok: true,
        data: voucher,
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
