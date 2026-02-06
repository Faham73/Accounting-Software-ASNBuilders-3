import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { StockMovementKind } from '@prisma/client';

/**
 * GET /api/projects/[id]/stock/movements
 * Get stock movements for a specific project with filters
 * Query params: from, to, stockItemId, movementKind, userId
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
      select: {
        id: true,
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

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const stockItemId = searchParams.get('stockItemId');
    const movementKindParam = searchParams.get('movementKind');
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '100'), 100);

    // Build where clause
    const where: any = {
      companyId: auth.companyId,
      OR: [
        { projectId: params.id },
        { destinationProjectId: params.id }, // Include transfers received
      ],
    };

    // Date range filter
    if (from || to) {
      where.movementDate = {};
      if (from) {
        where.movementDate.gte = new Date(from);
      }
      if (to) {
        where.movementDate.lte = new Date(to);
      }
    }

    // Stock item filter
    if (stockItemId) {
      where.stockItemId = stockItemId;
    }

    // Movement kind filter
    if (movementKindParam) {
      where.movementKind = movementKindParam as StockMovementKind;
    }

    // User filter
    if (userId) {
      where.createdById = userId;
    }

    // Fetch movements with pagination
    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        orderBy: [
          { movementDate: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              unit: true,
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

    // Transform movements to include calculated totals and additional info
    const movementsWithTotals = movements.map((movement) => {
      const qty = Number(movement.qty);
      const unitCost = movement.unitCost ? Number(movement.unitCost) : 0;
      const total = qty * unitCost;

      return {
        id: movement.id,
        movementDate: movement.movementDate,
        type: movement.type,
        movementKind: movement.movementKind,
        qty,
        unitCost: movement.unitCost ? Number(movement.unitCost) : null,
        total,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        notes: movement.notes,
        reason: movement.reason,
        meta: movement.meta,
        stockItem: movement.stockItem,
        vendor: movement.vendor,
        createdBy: movement.createdBy,
        approvedBy: movement.approvedById ? { id: movement.approvedById } : null,
        approvedAt: movement.approvedAt,
        createdAt: movement.createdAt,
      };
    });

    return NextResponse.json({
      ok: true,
      data: movementsWithTotals,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
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
