import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { ProjectInvestmentCreateSchema, ProjectInvestmentListFiltersSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { Prisma } from '@prisma/client';
import { generateVoucherNumber } from '@/lib/voucher';
import {
  getDefaultCashAccount,
  getDefaultBankAccount,
  getOwnerCapitalAccount,
} from '@/lib/accounting/defaultAccounts.server';

/**
 * GET /api/projects/[id]/investments
 * List investments for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'READ');

    const { searchParams } = new URL(request.url);
    const filters = ProjectInvestmentListFiltersSchema.parse({
      projectId: params.id,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      paymentMethod: searchParams.get('paymentMethod') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '25',
    });

    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 25;

    // Verify project belongs to company
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
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

    const where: any = {
      companyId: auth.companyId,
      projectId: params.id,
    };

    if (filters.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
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

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [investments, total] = await Promise.all([
      prisma.projectInvestment.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: {
          project: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.projectInvestment.count({ where }),
    ]);

    const totals = await prisma.projectInvestment.aggregate({
      where,
      _sum: {
        amount: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: investments,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      totals: {
        total: totals._sum.amount?.toNumber() || 0,
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
 * POST /api/projects/[id]/investments
 * Create a new investment for a project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'WRITE');

    const body = await request.json();
    const validatedData = ProjectInvestmentCreateSchema.parse({
      ...body,
      projectId: params.id,
    });

    // Verify project exists and belongs to company
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Project not found or does not belong to your company',
        },
        { status: 400 }
      );
    }

    // Get default accounts based on payment method
    const [cashAccountId, bankAccountId, ownerCapitalAccountId] = await Promise.all([
      getDefaultCashAccount(auth.companyId).catch(() => null),
      getDefaultBankAccount(auth.companyId).catch(() => null),
      getOwnerCapitalAccount(auth.companyId).catch(() => null),
    ]);

    if (!cashAccountId || !bankAccountId || !ownerCapitalAccountId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Default accounts not configured. Please ensure Cash, Bank, and Owner Capital accounts exist.',
        },
        { status: 400 }
      );
    }

    // Determine which account to debit based on payment method
    const debitAccountId = validatedData.paymentMethod === 'CASH' ? cashAccountId : bankAccountId;

    // Generate voucher number
    const investmentDate = validatedData.date;
    const voucherNo = await generateVoucherNumber(auth.companyId, investmentDate);

    // Create investment + voucher + voucher lines in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create voucher with POSTED status (RECEIPT type because money is received)
      const voucher = await tx.voucher.create({
        data: {
          companyId: auth.companyId,
          projectId: params.id,
          voucherNo,
          type: 'RECEIPT',
          date: investmentDate,
          status: 'POSTED',
          narration: `Investment funding from ${validatedData.investorName} received by ${validatedData.receivedBy}`,
          createdByUserId: auth.userId,
          postedByUserId: auth.userId,
          postedAt: new Date(),
          lines: {
            create: [
              // Debit: Cash or Bank account (Asset)
              {
                companyId: auth.companyId,
                accountId: debitAccountId,
                description: `Investment received from ${validatedData.investorName}`,
                debit: validatedData.amount,
                credit: 0,
                projectId: params.id,
              },
              // Credit: Owner Capital account (Equity)
              {
                companyId: auth.companyId,
                accountId: ownerCapitalAccountId,
                description: `Owner Capital - Investment from ${validatedData.investorName}`,
                debit: 0,
                credit: validatedData.amount,
                projectId: params.id,
              },
            ],
          },
        },
      });

      // Create investment linked to voucher
      const investment = await tx.projectInvestment.create({
        data: {
          companyId: auth.companyId,
          projectId: params.id,
          date: investmentDate,
          amount: new Prisma.Decimal(validatedData.amount),
          note: validatedData.note || null,
          investorName: validatedData.investorName,
          receivedBy: validatedData.receivedBy,
          paymentMethod: validatedData.paymentMethod,
          voucherId: voucher.id,
          createdByUserId: auth.userId,
        },
        include: {
          project: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return investment;
    });

    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'ProjectInvestment',
      entityId: result.id,
      action: 'CREATE',
      after: result,
      request,
    });

    return NextResponse.json(
      {
        ok: true,
        data: result,
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
