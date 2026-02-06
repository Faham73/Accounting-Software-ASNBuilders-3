import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { PaymentMethodUpdateSchema } from '@accounting/shared';
import { ZodError } from 'zod';

/**
 * GET /api/payment-methods/[id]
 * Get a single payment method by ID (scoped to user's company)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'paymentMethods', 'READ');

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
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

    if (!paymentMethod) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Payment method not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: paymentMethod,
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
 * PATCH /api/payment-methods/[id]
 * Update a payment method (requires WRITE permission)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'paymentMethods', 'WRITE');

    const body = await request.json();

    const validatedData = PaymentMethodUpdateSchema.parse(body);

    const existingPaymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!existingPaymentMethod) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Payment method not found',
        },
        { status: 404 }
      );
    }

    // Check for duplicate name if name is being updated
    if (validatedData.name && validatedData.name !== existingPaymentMethod.name) {
      const duplicate = await prisma.paymentMethod.findUnique({
        where: {
          companyId_name: {
            companyId: auth.companyId,
            name: validatedData.name,
          },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          {
            ok: false,
            error: 'A payment method with this name already exists',
          },
          { status: 409 }
        );
      }
    }

    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.type !== undefined) updateData.type = validatedData.type;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;

    const updatedPaymentMethod = await prisma.paymentMethod.update({
      where: { id: params.id },
      data: updateData,
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
      data: updatedPaymentMethod,
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

/**
 * DELETE /api/payment-methods/[id]
 * Soft delete a payment method by setting isActive=false (requires WRITE permission)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'paymentMethods', 'WRITE');

    const existingPaymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!existingPaymentMethod) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Payment method not found',
        },
        { status: 404 }
      );
    }

    const deletedPaymentMethod = await prisma.paymentMethod.update({
      where: { id: params.id },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: deletedPaymentMethod,
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
