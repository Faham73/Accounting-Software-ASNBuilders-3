import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import {
  StockItemCreateSchema,
  StockItemListFiltersSchema,
} from '@accounting/shared';
import { ZodError } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { Prisma } from '@prisma/client';

/**
 * GET /api/stock/items
 * List stock items for user's company with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'stock', 'READ');

    // Debug: Log companyId
    console.log(`[GET /api/stock/items] companyId: ${auth.companyId}`);

    const { searchParams } = new URL(request.url);
    
    // Parse filters - schema will coerce boolean strings
    const filters = StockItemListFiltersSchema.parse({
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '25',
      category: searchParams.get('category') || undefined,
      isActive: searchParams.get('isActive') || undefined,
    });

    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 25;

    const where: any = {
      companyId: auth.companyId,
    };

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' as const } },
        { sku: { contains: filters.search, mode: 'insensitive' as const } },
      ];
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [items, total] = await Promise.all([
      prisma.stockItem.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          balances: {
            select: {
              onHandQty: true,
              avgCost: true,
            },
          },
        },
      }),
      prisma.stockItem.count({ where }),
    ]);

    // Transform items to include balance
    const itemsWithBalance = items.map((item) => {
      const balance = item.balances[0];
      return {
        ...item,
        onHandQty: balance ? Number(balance.onHandQty) : 0,
        avgCost: balance ? Number(balance.avgCost) : 0,
        balances: undefined,
      };
    });

    // Debug: Log number of items returned
    console.log(`[GET /api/stock/items] Found ${itemsWithBalance.length} items (total: ${total})`);

    return NextResponse.json({
      ok: true,
      data: itemsWithBalance,
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

/**
 * POST /api/stock/items
 * Create a new stock item
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'stock', 'WRITE');

    const body = await request.json();
    const validatedData = StockItemCreateSchema.parse(body);

    // Check if item with same name already exists
    const existing = await prisma.stockItem.findUnique({
      where: {
        companyId_name: {
          companyId: auth.companyId,
          name: validatedData.name,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Stock item with this name already exists',
        },
        { status: 400 }
      );
    }

    // Check SKU uniqueness if provided
    if (validatedData.sku) {
      const existingSku = await prisma.stockItem.findUnique({
        where: {
          companyId_sku: {
            companyId: auth.companyId,
            sku: validatedData.sku,
          },
        },
      });

      if (existingSku) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Stock item with this SKU already exists',
          },
          { status: 400 }
        );
      }
    }

    // Create stock item
    const item = await prisma.stockItem.create({
      data: {
        companyId: auth.companyId,
        name: validatedData.name,
        sku: validatedData.sku || null,
        unit: validatedData.unit,
        category: validatedData.category || null,
        reorderLevel: validatedData.reorderLevel
          ? new Prisma.Decimal(validatedData.reorderLevel)
          : null,
        isActive: validatedData.isActive,
      },
    });

    // Create initial balance
    await prisma.stockBalance.create({
      data: {
        companyId: auth.companyId,
        stockItemId: item.id,
        onHandQty: new Prisma.Decimal(0),
        avgCost: new Prisma.Decimal(0),
      },
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'StockItem',
      entityId: item.id,
      action: 'CREATE',
      after: item,
      request,
    });

    return NextResponse.json(
      {
        ok: true,
        data: item,
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
