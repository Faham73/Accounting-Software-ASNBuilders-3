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
 * POST /api/projects/[id]/stock/adjustment
 * Record stock adjustment for a project (can be positive or negative)
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
    const { stockItemId, qty, unitCost, movementDate, reason } = body;

    if (!stockItemId || qty === undefined || !reason) {
      return NextResponse.json(
        {
          ok: false,
          error: 'stockItemId, qty, and reason are required',
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

    const qtyNum = parseFloat(qty);
    const movementType = qtyNum > 0 ? StockMovementType.IN : StockMovementType.OUT;
    const absQty = Math.abs(qtyNum);

    // Create adjustment movement
    const result = await adjustStock({
      companyId: auth.companyId,
      stockItemId,
      type: movementType,
      qty: absQty,
      unitCost: unitCost ? parseFloat(unitCost) : undefined,
      projectId: params.id,
      vendorId: undefined,
      referenceType: undefined,
      referenceId: undefined,
      notes: reason,
      userId: auth.userId,
      movementDate: movementDate ? new Date(movementDate) : new Date(),
    });

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || 'Failed to record adjustment',
        },
        { status: 400 }
      );
    }

    // Update the movement to set movementKind, reason, and auto-approve
    await prisma.stockMovement.update({
      where: { id: result.movementId! },
      data: {
        movementKind: StockMovementKind.ADJUSTMENT,
        reason,
        approvedById: auth.userId, // Auto-approve for now
        approvedAt: new Date(),
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
