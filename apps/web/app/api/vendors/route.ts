import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { VendorCreateSchema } from '@accounting/shared';
import { ZodError } from 'zod';

/**
 * GET /api/vendors
 * List vendors for user's company with optional filters
 * Query params: q (search), active (default: true)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vendors', 'READ');

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const activeParam = searchParams.get('active');
    const active = activeParam === null ? true : activeParam === 'true';

    // Build where clause
    const where: any = {
      companyId: auth.companyId,
    };

    // Filter by active status
    if (active !== null) {
      where.isActive = active;
    }

    // Search by name (case-insensitive)
    if (q) {
      where.name = {
        contains: q,
        mode: 'insensitive',
      };
    }

    const vendors = await prisma.vendor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
      data: vendors,
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
 * POST /api/vendors
 * Create a new vendor (requires WRITE permission)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vendors', 'WRITE');

    const body = await request.json();

    // Validate input with Zod
    const validatedData = VendorCreateSchema.parse(body);

    // Create vendor (companyId from auth context)
    const vendor = await prisma.vendor.create({
      data: {
        companyId: auth.companyId,
        name: validatedData.name,
        phone: validatedData.phone,
        address: validatedData.address,
        notes: validatedData.notes,
        isActive: validatedData.isActive ?? true,
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

    return NextResponse.json(
      {
        ok: true,
        data: vendor,
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
