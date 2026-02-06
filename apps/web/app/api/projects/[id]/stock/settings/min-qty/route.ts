import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { Prisma } from '@prisma/client';

/**
 * POST /api/projects/[id]/stock/settings/min-qty
 * Set minimum quantity threshold for a stock item in a project
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
    const { stockItemId, minQty } = body;

    if (!stockItemId || minQty === undefined) {
      return NextResponse.json(
        {
          ok: false,
          error: 'stockItemId and minQty are required',
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

    // Upsert the setting
    const setting = await prisma.projectStockSetting.upsert({
      where: {
        projectId_stockItemId: {
          projectId: params.id,
          stockItemId,
        },
      },
      create: {
        companyId: auth.companyId,
        projectId: params.id,
        stockItemId,
        minQty: new Prisma.Decimal(minQty),
      },
      update: {
        minQty: new Prisma.Decimal(minQty),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: setting.id,
          stockItemId: setting.stockItemId,
          minQty: Number(setting.minQty),
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
