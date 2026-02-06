import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { VendorUpdateSchema } from '@accounting/shared';
import { ZodError } from 'zod';

/**
 * GET /api/vendors/[id]
 * Get a single vendor by ID (scoped to user's company)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'vendors', 'READ');

    const vendor = await prisma.vendor.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Vendor not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: vendor,
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
 * PATCH /api/vendors/[id]
 * Update a vendor (requires WRITE permission)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'vendors', 'WRITE');

    const body = await request.json();

    // Validate input with Zod
    const validatedData = VendorUpdateSchema.parse(body);

    // Check if vendor exists and belongs to user's company
    const existingVendor = await prisma.vendor.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!existingVendor) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Vendor not found',
        },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone;
    if (validatedData.address !== undefined) updateData.address = validatedData.address;
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;

    const updatedVendor = await prisma.vendor.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: updatedVendor,
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

/**
 * DELETE /api/vendors/[id]
 * Soft delete a vendor by setting isActive=false (requires WRITE permission)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'vendors', 'WRITE');

    const existingVendor = await prisma.vendor.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!existingVendor) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Vendor not found',
        },
        { status: 404 }
      );
    }

    const deletedVendor = await prisma.vendor.update({
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
      data: deletedVendor,
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
