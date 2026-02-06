import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { ZodError } from 'zod';
import { CreditCreateSchema, CreditListFiltersSchema } from '@accounting/shared';
import { getCompanyTotalCredit, getProjectTotalCredit } from '@/lib/credits/creditTotals.server';
import { createAuditLog } from '@/lib/audit';
import { Prisma } from '@prisma/client';

/**
 * GET /api/credit
 * List credit entries company-wide with optional project filter
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'READ');

    const { searchParams } = new URL(request.url);
    const filters = CreditListFiltersSchema.parse({
      projectId: searchParams.get('projectId') || undefined,
      companyLevelOnly: searchParams.get('companyLevelOnly') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '25',
    });

    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 25;

    // Build where clause for listing credits
    const listWhere: any = {
      companyId: auth.companyId,
    };

    if (filters.companyLevelOnly === 'true') {
      // Show only company-level credits (projectId is null)
      listWhere.projectId = null;
    } else if (filters.projectId) {
      // Show only credits for this project
      listWhere.projectId = filters.projectId;
    }
    // else: show all credits (both project and company-level)

    // Apply date filters
    if (filters.dateFrom || filters.dateTo) {
      listWhere.date = {};
      if (filters.dateFrom) {
        listWhere.date.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        listWhere.date.lte = filters.dateTo;
      }
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [credits, total, companyTotalCredit] = await Promise.all([
      prisma.credit.findMany({
        where: listWhere,
        skip,
        take,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          date: true,
          projectSnapshotName: true,
          purpose: true,
          paidBy: true,
          receivedBy: true,
          paymentMethod: true,
          paymentRef: true,
          amount: true,
          note: true,
          projectId: true,
          project: {
            select: { id: true, name: true },
          },
          paymentAccount: {
            select: { id: true, code: true, name: true },
          },
        },
      }),
      prisma.credit.count({ where: listWhere }),
      filters.projectId
        ? getProjectTotalCredit(filters.projectId, auth.companyId)
        : getCompanyTotalCredit(auth.companyId),
    ]);

    return NextResponse.json({
      ok: true,
      data: credits,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      totals: {
        credit: companyTotalCredit,
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
 * POST /api/credit
 * Create a new credit entry
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    const body = await request.json();
    const validatedData = CreditCreateSchema.parse(body);

    // If projectId is provided, verify it exists and belongs to company
    let projectSnapshotName = validatedData.projectSnapshotName;
    if (validatedData.projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: validatedData.projectId,
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
            error: 'Project not found or does not belong to your company',
          },
          { status: 400 }
        );
      }

      // Use project name as snapshot name if not explicitly provided
      if (!projectSnapshotName) {
        projectSnapshotName = project.name;
      }
    }

    // Verify payment account if provided
    if (validatedData.paymentAccountId) {
      const account = await prisma.account.findFirst({
        where: {
          id: validatedData.paymentAccountId,
          companyId: auth.companyId,
        },
      });

      if (!account) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Payment account not found or does not belong to your company',
          },
          { status: 400 }
        );
      }
    }

    const credit = await prisma.credit.create({
      data: {
        companyId: auth.companyId,
        projectId: validatedData.projectId || null,
        projectSnapshotName,
        date: validatedData.date,
        purpose: validatedData.purpose,
        paidBy: validatedData.paidBy,
        receivedBy: validatedData.receivedBy,
        paymentMethod: validatedData.paymentMethod,
        paymentRef: validatedData.paymentRef || null,
        paymentAccountId: validatedData.paymentAccountId || null,
        amount: new Prisma.Decimal(validatedData.amount),
        note: validatedData.note || 'Done',
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        paymentAccount: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'Credit',
      entityId: credit.id,
      action: 'CREATE',
      after: credit,
      request,
    });

    return NextResponse.json(
      {
        ok: true,
        data: credit,
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
