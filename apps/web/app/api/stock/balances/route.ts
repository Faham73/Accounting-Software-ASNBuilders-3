import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { StockBalanceListFiltersSchema } from '@accounting/shared';
import { ZodError } from 'zod';

/**
 * GET /api/stock/balances
 * List stock balances (on-hand quantities) for user's company
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'stock', 'READ');

    const { searchParams } = new URL(request.url);
    const filters = StockBalanceListFiltersSchema.parse({
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '25',
      lowStock: searchParams.get('lowStock') || undefined,
      category: searchParams.get('category') || undefined,
    });

    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 25;

    const where: any = {
      companyId: auth.companyId,
      stockItem: {
        isActive: true,
      },
    };

    if (filters.category) {
      where.stockItem = {
        ...where.stockItem,
        category: filters.category,
      };
    }

    if (filters.search) {
      where.stockItem = {
        ...where.stockItem,
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' as const } },
          { sku: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      };
    }

    if (filters.lowStock) {
      // For low stock, we need to filter items where onHandQty <= reorderLevel
      // This requires a more complex query - we'll filter in application code
      // For now, just ensure stockItem has reorderLevel set
      where.stockItem = {
        ...where.stockItem,
        reorderLevel: { not: null },
      };
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [balances, total] = await Promise.all([
      prisma.stockBalance.findMany({
        where,
        skip,
        take,
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit: true,
              category: true,
              reorderLevel: true,
            },
          },
        },
        orderBy: {
          stockItem: {
            name: 'asc',
          },
        },
      }),
      prisma.stockBalance.count({ where }),
    ]);

    // Transform to include low stock flag
    let balancesWithLowStock = balances.map((balance) => {
      const reorderLevel = balance.stockItem.reorderLevel
        ? Number(balance.stockItem.reorderLevel)
        : null;
      const onHand = Number(balance.onHandQty);
      const isLowStock = reorderLevel !== null && onHand <= reorderLevel;

      return {
        id: balance.id,
        stockItemId: balance.stockItemId,
        stockItem: balance.stockItem,
        onHandQty: onHand,
        avgCost: Number(balance.avgCost),
        isLowStock,
        updatedAt: balance.updatedAt,
      };
    });

    // Filter low stock if requested
    if (filters.lowStock) {
      balancesWithLowStock = balancesWithLowStock.filter((b) => b.isLowStock);
    }

    return NextResponse.json({
      ok: true,
      data: balancesWithLowStock,
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
