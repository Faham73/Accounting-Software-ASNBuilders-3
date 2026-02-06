import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { StockMovementAdjustSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { adjustStock } from '@/lib/stock/stockService.server';
import { createAuditLog } from '@/lib/audit';

/**
 * POST /api/stock/movements/adjust
 * Create a stock ADJUST movement (manual adjustment)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'stock', 'WRITE');

    const body = await request.json();
    const validatedData = StockMovementAdjustSchema.parse(body);

    // Verify stock item exists and belongs to company
    const stockItem = await prisma.stockItem.findUnique({
      where: {
        id: validatedData.stockItemId,
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

    // Get current balance to calculate delta
    const currentBalance = await prisma.stockBalance.findUnique({
      where: {
        companyId_stockItemId: {
          companyId: auth.companyId,
          stockItemId: validatedData.stockItemId,
        },
      },
    });

    const currentQty = currentBalance ? Number(currentBalance.onHandQty) : 0;
    const targetQty = validatedData.qty;
    const deltaQty = targetQty - currentQty;

    if (deltaQty === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No adjustment needed. Current quantity matches target.',
        },
        { status: 400 }
      );
    }

    // Create stock movement with absolute qty (ADJUST type uses qty as target)
    const result = await adjustStock({
      companyId: auth.companyId,
      stockItemId: validatedData.stockItemId,
      type: 'ADJUST',
      qty: targetQty, // ADJUST uses qty as target onHandQty
      unitCost: validatedData.unitCost,
      notes: validatedData.notes || `Adjustment: ${deltaQty > 0 ? '+' : ''}${deltaQty}`,
      userId: auth.userId,
      movementDate: validatedData.movementDate ? new Date(validatedData.movementDate) : new Date(),
      referenceType: 'ADJUSTMENT',
    });

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || 'Failed to create stock adjustment',
        },
        { status: 400 }
      );
    }

    // Get the created movement
    const movement = await prisma.stockMovement.findUnique({
      where: { id: result.movementId! },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            unit: true,
          },
        },
      },
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'StockMovement',
      entityId: movement!.id,
      action: 'CREATE',
      after: movement,
      request,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          movement,
          balance: result.balance,
          delta: deltaQty,
        },
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
