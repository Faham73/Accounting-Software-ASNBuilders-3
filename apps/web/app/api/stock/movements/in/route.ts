import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { StockMovementInSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { adjustStock } from '@/lib/stock/stockService.server';
import { createAuditLog } from '@/lib/audit';

/**
 * POST /api/stock/movements/in
 * Create a stock IN movement (purchase/receipt)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'stock', 'WRITE');

    const body = await request.json();
    const validatedData = StockMovementInSchema.parse(body);

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

    // Verify project if provided
    if (validatedData.projectId) {
      const project = await prisma.project.findUnique({
        where: {
          id: validatedData.projectId,
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
    }

    // Verify vendor if provided
    if (validatedData.vendorId) {
      const vendor = await prisma.vendor.findUnique({
        where: {
          id: validatedData.vendorId,
          companyId: auth.companyId,
        },
      });

      if (!vendor) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Vendor not found or does not belong to your company',
          },
          { status: 400 }
        );
      }
    }

    // Create stock movement
    const result = await adjustStock({
      companyId: auth.companyId,
      stockItemId: validatedData.stockItemId,
      type: 'IN',
      qty: validatedData.qty,
      unitCost: validatedData.unitCost,
      referenceType: validatedData.referenceType ?? undefined,
      referenceId: validatedData.referenceId ?? undefined,
      projectId: validatedData.projectId ?? undefined,
      vendorId: validatedData.vendorId ?? undefined,
      notes: validatedData.notes ?? undefined,
      userId: auth.userId,
      movementDate: validatedData.movementDate ? new Date(validatedData.movementDate) : new Date(),
    });

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || 'Failed to create stock movement',
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
