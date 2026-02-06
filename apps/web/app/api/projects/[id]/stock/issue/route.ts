import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { StockMovementKind, StockMovementType } from '@prisma/client';
import { adjustStock } from '@/lib/stock/stockService.server';

/**
 * POST /api/projects/[id]/stock/issue
 * Issue stock from a project (OUT movement)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'stock', 'WRITE');

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
          error: 'Project not found or does not belong to your company',
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { stockItemId, qty, movementDate, notes, meta } = body;

    if (!stockItemId || !qty) {
      return NextResponse.json(
        {
          ok: false,
          error: 'stockItemId and qty are required',
        },
        { status: 400 }
      );
    }

    // Verify stock item belongs to company
    const stockItem = await prisma.stockItem.findFirst({
      where: {
        id: stockItemId,
        companyId: auth.companyId,
      },
    });

    if (!stockItem) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Stock item not found or does not belong to your company',
        },
        { status: 400 }
      );
    }

    // Check available stock using the overview function for accurate calculation
    // This ensures we use the same weighted average logic
    try {
      const { getProjectStockOverview } = await import('@/lib/stock/projectStock.server');
      const overview = await getProjectStockOverview(auth.companyId, params.id);
      const item = overview.items.find((i) => i.stockItemId === stockItemId);

      if (!item) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Stock item not found in project inventory',
          },
          { status: 400 }
        );
      }

      if (item.remainingQty < parseFloat(qty)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Insufficient stock. Available: ${item.remainingQty.toFixed(3)}, Requested: ${qty}`,
          },
          { status: 400 }
        );
      }

      if (item.remainingQty === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Cannot issue stock when on-hand quantity is zero',
          },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Failed to check available stock',
        },
        { status: 500 }
      );
    }

    // Create issue movement
    const result = await adjustStock({
      companyId: auth.companyId,
      stockItemId,
      type: StockMovementType.OUT,
      qty: parseFloat(qty),
      unitCost: undefined, // Not needed for OUT
      projectId: params.id,
      vendorId: undefined,
      referenceType: undefined,
      referenceId: undefined,
      notes: notes || undefined,
      userId: auth.userId,
      movementDate: movementDate ? new Date(movementDate) : new Date(),
    });

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || 'Failed to issue stock',
        },
        { status: 400 }
      );
    }

    // Update the movement to set movementKind and meta
    await prisma.stockMovement.update({
      where: { id: result.movementId! },
      data: {
        movementKind: StockMovementKind.ISSUE,
        meta: meta || null,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          movementId: result.movementId,
          balance: result.balance,
        },
      },
      { status: 201 }
    );
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
