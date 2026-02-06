import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { AccountListFiltersSchema } from '@accounting/shared';
import { ZodError } from 'zod';

/**
 * GET /api/chart-of-accounts
 * List system accounts for internal use (vouchers/reports)
 * Note: This endpoint is for internal use only. Accounts are system-managed.
 */
export async function GET(request: NextRequest) {
  try {
    // No permission check needed - accounts are read-only for UI, used internally
    const auth = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const filters = AccountListFiltersSchema.parse({
      q: searchParams.get('q') || undefined,
      type: searchParams.get('type') || undefined,
      active: searchParams.get('active') === null ? undefined : searchParams.get('active') === 'true',
      parentId: searchParams.get('parentId') || undefined,
      expenseCategoryId: searchParams.get('categoryId') || searchParams.get('expenseCategoryId') || undefined,
    });

    const where: any = {
      companyId: auth.companyId,
    };

    if (filters.active !== undefined) {
      where.isActive = filters.active;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.parentId !== undefined) {
      where.parentId = filters.parentId;
    }

    if (filters.expenseCategoryId) {
      where.expenseCategoryId = filters.expenseCategoryId;
      where.type = 'EXPENSE'; // expense accounts only when filtering by category
    }

    if (filters.q) {
      where.OR = [
        { code: { contains: filters.q, mode: 'insensitive' as const } },
        { name: { contains: filters.q, mode: 'insensitive' as const } },
      ];
    }

    // Only return system accounts for internal use (vouchers/reports)
    const accounts = await prisma.account.findMany({
      where: {
        ...where,
        isSystem: true, // Only system accounts are accessible
      },
      orderBy: [{ code: 'asc' }],
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
        children: {
          select: { id: true },
        },
        _count: {
          select: { voucherLines: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      data: accounts,
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
 * POST /api/chart-of-accounts
 * DISABLED: Accounts are system-managed only. Use ensureSystemAccounts() service instead.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: 'Account creation is disabled. Accounts are system-managed only.',
    },
    { status: 403 }
  );
}
