import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { Prisma } from '@prisma/client';
import { StockMovementKind, StockMovementType } from '@prisma/client';
import { adjustStock } from '@/lib/stock/stockService.server';
import { ZodError } from 'zod';

const normalizeName = (s: string) => s.trim().replace(/\s+/g, ' ');

/**
 * GET /api/projects/[id]/stock/opening
 * Get existing opening stock entries for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'stock', 'READ');

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

    // Fetch existing opening stock movements
    const openingMovements = await prisma.stockMovement.findMany({
      where: {
        companyId: auth.companyId,
        projectId: params.id,
        movementKind: StockMovementKind.OPENING,
        referenceType: 'OPENING_STOCK',
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            unit: true,
            category: true,
          },
        },
      },
      orderBy: {
        movementDate: 'asc',
      },
    });

    const lines = openingMovements.map((mov) => ({
      stockItemId: mov.stockItemId,
      stockItemName: mov.stockItem.name,
      unit: mov.stockItem.unit,
      category: mov.stockItem.category || '',
      qty: Number(mov.qty),
      unitCost: mov.unitCost ? Number(mov.unitCost) : 0,
      notes: mov.notes || '',
      movementDate: mov.movementDate.toISOString().split('T')[0],
    }));

    return NextResponse.json({
      ok: true,
      data: {
        exists: openingMovements.length > 0,
        openingDate: openingMovements[0]?.movementDate.toISOString().split('T')[0] || null,
        lines,
      },
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

type ResolvedLine = {
  stockItemId: string;
  qty: number;
  unitCost: number;
  notes: string;
  category?: string;
  unit?: string;
};

async function resolveLineToStockItemId(
  line: { stockItemId?: string; name?: string; unit?: string; category?: string },
  companyId: string
): Promise<string> {
  const hasId = !!line.stockItemId;
  const nameTrimmed = typeof line.name === 'string' ? normalizeName(line.name) : '';

  if (hasId) {
    const item = await prisma.stockItem.findFirst({
      where: { id: line.stockItemId!, companyId },
    });
    if (!item) {
      throw new Error(`Stock item ${line.stockItemId} not found or does not belong to your company`);
    }
    return item.id;
  }

  if (!nameTrimmed) {
    throw new Error('Each line must have stockItemId or name');
  }

  const unit = (line.unit?.trim() || 'Piece').slice(0, 50) || 'Piece';
  const category = (line.category?.trim() || null) as string | null;

  const existing = await prisma.stockItem.findFirst({
    where: {
      companyId,
      name: { equals: nameTrimmed, mode: 'insensitive' },
    },
  });

  if (existing) return existing.id;

  try {
    const created = await prisma.stockItem.create({
      data: {
        companyId,
        name: nameTrimmed,
        unit,
        category,
        isActive: true,
      },
    });
    await prisma.stockBalance.create({
      data: {
        companyId,
        stockItemId: created.id,
        onHandQty: new Prisma.Decimal(0),
        avgCost: new Prisma.Decimal(0),
      },
    });
    return created.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const found = await prisma.stockItem.findFirst({
        where: {
          companyId,
          name: { equals: nameTrimmed, mode: 'insensitive' },
        },
      });
      if (found) return found.id;
    }
    throw e;
  }
}

/**
 * POST /api/projects/[id]/stock/opening
 * Create or replace opening stock entries for a project (bulk)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'stock', 'WRITE');

    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId: auth.companyId },
    });

    if (!project) {
      return NextResponse.json(
        { ok: false, error: 'Project not found or does not belong to your company' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { openingDate, lines, replaceExisting } = body;

    if (!openingDate || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'openingDate and lines array are required' },
        { status: 400 }
      );
    }

    for (const line of lines) {
      const hasId = !!line.stockItemId;
      const hasName = typeof line.name === 'string' && normalizeName(line.name).length > 0;
      if ((!hasId && !hasName) || line.qty == null || line.unitCost == null) {
        return NextResponse.json(
          { ok: false, error: 'Each line must have stockItemId or name, and qty and unitCost' },
          { status: 400 }
        );
      }
      if (Number(line.qty) <= 0) {
        return NextResponse.json(
          { ok: false, error: 'Quantity must be greater than 0' },
          { status: 400 }
        );
      }
      if (Number(line.unitCost) < 0) {
        return NextResponse.json(
          { ok: false, error: 'Unit cost cannot be negative' },
          { status: 400 }
        );
      }
    }

    const existingOpening = await prisma.stockMovement.findFirst({
      where: {
        companyId: auth.companyId,
        projectId: params.id,
        movementKind: StockMovementKind.OPENING,
        referenceType: 'OPENING_STOCK',
      },
    });

    if (existingOpening && !replaceExisting) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Opening stock already exists. Set replaceExisting=true to replace.',
        },
        { status: 409 }
      );
    }

    const resolved: ResolvedLine[] = [];
    for (const line of lines) {
      const stockItemId = await resolveLineToStockItemId(
        {
          stockItemId: line.stockItemId,
          name: line.name,
          unit: line.unit,
          category: line.category,
        },
        auth.companyId
      );
      const qty = Number(line.qty);
      const unitCost = Number(line.unitCost);
      resolved.push({
        stockItemId,
        qty,
        unitCost,
        notes: line.notes || '',
        category: line.category,
        unit: line.unit,
      });
    }

    const mergedLines = new Map<string, ResolvedLine>();
    for (const line of resolved) {
      const cur = mergedLines.get(line.stockItemId);
      if (cur) {
        const totalQty = cur.qty + line.qty;
        const totalValue = cur.qty * cur.unitCost + line.qty * line.unitCost;
        cur.qty = totalQty;
        cur.unitCost = totalQty > 0 ? totalValue / totalQty : 0;
        if (line.notes && !cur.notes) cur.notes = line.notes;
        else if (line.notes && cur.notes) cur.notes = `${cur.notes}; ${line.notes}`;
      } else {
        mergedLines.set(line.stockItemId, { ...line });
      }
    }

    return await prisma.$transaction(async (tx) => {
      // Delete existing opening stock if replacing
      if (replaceExisting && existingOpening) {
        await tx.stockMovement.deleteMany({
          where: {
            companyId: auth.companyId,
            projectId: params.id,
            movementKind: StockMovementKind.OPENING,
            referenceType: 'OPENING_STOCK',
          },
        });
      }

      // Verify all stock items belong to company
      const stockItemIds = Array.from(mergedLines.keys());
      const stockItems = await tx.stockItem.findMany({
        where: {
          id: { in: stockItemIds },
          companyId: auth.companyId,
        },
      });

      if (stockItems.length !== stockItemIds.length) {
        throw new Error('One or more stock items not found or do not belong to your company');
      }

      const movementDate = new Date(openingDate);
      const createdMovements = [];

      // Create opening stock movements for each merged line
      for (const line of mergedLines.values()) {
        const result = await adjustStock({
          companyId: auth.companyId,
          stockItemId: line.stockItemId,
          type: StockMovementType.IN,
          qty: line.qty,
          unitCost: line.unitCost,
          projectId: params.id,
          vendorId: undefined,
          referenceType: 'OPENING_STOCK',
          referenceId: undefined,
          notes: line.notes || undefined,
          userId: auth.userId,
          movementDate,
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to create opening stock movement');
        }

        // Update the movement to set movementKind
        await tx.stockMovement.update({
          where: { id: result.movementId! },
          data: {
            movementKind: StockMovementKind.OPENING,
          },
        });

        createdMovements.push(result.movementId);
      }

      return NextResponse.json(
        {
          ok: true,
          data: {
            movementIds: createdMovements,
            linesCreated: mergedLines.size,
          },
        },
        { status: 201 }
      );
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
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to create opening stock',
      },
      { status: 500 }
    );
  }
}
