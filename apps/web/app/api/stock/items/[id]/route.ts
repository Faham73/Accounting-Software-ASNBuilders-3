import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { StockItemUpdateSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { Prisma } from '@prisma/client';

/**
 * GET /api/stock/items/[id]
 * Get a single stock item
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'stock', 'READ');

    const item = await prisma.stockItem.findUnique({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
      include: {
        balances: {
          select: {
            onHandQty: true,
            avgCost: true,
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Stock item not found',
        },
        { status: 404 }
      );
    }

    const balance = item.balances[0];
    const itemWithBalance = {
      ...item,
      onHandQty: balance ? Number(balance.onHandQty) : 0,
      avgCost: balance ? Number(balance.avgCost) : 0,
      balances: undefined,
    };

    return NextResponse.json({
      ok: true,
      data: itemWithBalance,
    });
  } catch (error) {
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
 * PATCH /api/stock/items/[id]
 * Partial update (same semantics as PUT)
 */
export async function PATCH(
  request: NextRequest,
  ctx: { params: { id: string } }
) {
  return PUT(request, ctx);
}

/**
 * DELETE /api/stock/items/[id]
 * Remove item only if it has no movements or balances.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'stock', 'WRITE');

    const existing = await prisma.stockItem.findUnique({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Stock item not found' },
        { status: 404 }
      );
    }

    const movementCount = await prisma.stockMovement.count({
      where: { stockItemId: params.id },
    });

    if (movementCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Cannot delete this item because stock movements exist. Disable it instead.',
        },
        { status: 409 }
      );
    }

    await prisma.stockBalance.deleteMany({
      where: { stockItemId: params.id },
    });

    await prisma.stockItem.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ ok: true, data: { success: true } });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(
      error instanceof Error ? error : new Error('Unknown error'),
      500
    );
  }
}

/**
 * PUT /api/stock/items/[id]
 * Update a stock item
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'stock', 'WRITE');

    const body = await request.json();
    const validatedData = StockItemUpdateSchema.parse(body);

    // Check if item exists
    const existing = await prisma.stockItem.findUnique({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Stock item not found',
        },
        { status: 404 }
      );
    }

    // Check name uniqueness (case-insensitive) if name is being updated
    const nameTrimmed = validatedData.name?.trim();
    if (nameTrimmed && nameTrimmed.toLowerCase() !== existing.name.toLowerCase()) {
      const nameConflict = await prisma.stockItem.findFirst({
        where: {
          companyId: auth.companyId,
          id: { not: params.id },
          name: { equals: nameTrimmed, mode: 'insensitive' },
        },
      });

      if (nameConflict) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Stock item with this name already exists',
          },
          { status: 400 }
        );
      }
    }

    // Check SKU uniqueness if SKU is being updated
    if (validatedData.sku !== undefined && validatedData.sku !== existing.sku) {
      if (validatedData.sku) {
        const skuConflict = await prisma.stockItem.findUnique({
          where: {
            companyId_sku: {
              companyId: auth.companyId,
              sku: validatedData.sku,
            },
          },
        });

        if (skuConflict) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Stock item with this SKU already exists',
            },
            { status: 400 }
          );
        }
      }
    }

    // Build update data
    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name?.trim() ?? validatedData.name;
    if (validatedData.sku !== undefined) updateData.sku = validatedData.sku || null;
    if (validatedData.unit !== undefined) updateData.unit = validatedData.unit;
    if (validatedData.category !== undefined) updateData.category = validatedData.category || null;
    if (validatedData.reorderLevel !== undefined) {
      updateData.reorderLevel = validatedData.reorderLevel
        ? new Prisma.Decimal(validatedData.reorderLevel)
        : null;
    }
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;

    const before = { ...existing };
    const item = await prisma.stockItem.update({
      where: {
        id: params.id,
      },
      data: updateData,
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'StockItem',
      entityId: item.id,
      action: 'UPDATE',
      before,
      after: item,
      request,
    });

    return NextResponse.json({
      ok: true,
      data: item,
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
