import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { PaymentMethodCreateSchema } from '@accounting/shared';
import { ZodError } from 'zod';

/**
 * GET /api/payment-methods
 * List payment methods for user's company with optional filters
 * Query params: q (search), active (default: true)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'paymentMethods', 'READ');

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const activeParam = searchParams.get('active');
    const active = activeParam === null ? true : activeParam === 'true';

    const where: any = {
      companyId: auth.companyId,
    };

    if (active !== null) {
      where.isActive = active;
    }

    if (q) {
      where.name = {
        contains: q,
        mode: 'insensitive',
      };
    }

    const paymentMethods = await prisma.paymentMethod.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: paymentMethods,
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
 * POST /api/payment-methods
 * Create a new payment method (requires WRITE permission)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'paymentMethods', 'WRITE');

    const body = await request.json();

    const validatedData = PaymentMethodCreateSchema.parse(body);

    // Check for duplicate name within company
    const existing = await prisma.paymentMethod.findUnique({
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
          error: 'A payment method with this name already exists',
        },
        { status: 409 }
      );
    }

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        companyId: auth.companyId,
        name: validatedData.name,
        type: validatedData.type,
        isActive: validatedData.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        data: paymentMethod,
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
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'A payment method with this name already exists',
        },
        { status: 409 }
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
