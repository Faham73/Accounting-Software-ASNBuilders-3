import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { StockMovementListFiltersSchema } from '@accounting/shared';
import { ZodError } from 'zod';

/**
 * GET /api/stock/movements
 * List stock movements (ledger) for user's company with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'stock', 'READ');

    const { searchParams } = new URL(request.url);
    const filters = StockMovementListFiltersSchema.parse({
      stockItemId: searchParams.get('stockItemId') || undefined,
      type: searchParams.get('type') as 'IN' | 'OUT' | 'ADJUST' | undefined,
      projectId: searchParams.get('projectId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '25',
    });

    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 25;

    const where: any = {
      companyId: auth.companyId,
    };

    if (filters.stockItemId) {
      where.stockItemId = filters.stockItemId;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.movementDate = {};
      if (filters.dateFrom) {
        where.movementDate.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.movementDate.lte = new Date(filters.dateTo);
      }
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take,
        orderBy: { movementDate: 'desc' },
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              unit: true,
            },
          },
          project: {
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
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    // Transform movements
    const movementsTransformed = movements.map((movement) => ({
      ...movement,
      qty: Number(movement.qty),
      unitCost: movement.unitCost ? Number(movement.unitCost) : null,
    }));

    return NextResponse.json({
      ok: true,
      data: movementsTransformed,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
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
