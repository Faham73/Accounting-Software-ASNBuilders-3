import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, createErrorResponse, ForbiddenError, UnauthorizedError } from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { CompanyUpdateSchema } from '@accounting/shared';
import { ZodError } from 'zod';

/**
 * PATCH /api/companies/[id]
 * Update a company (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);

    const body = await request.json();

    // Validate input with Zod
    const validatedData = CompanyUpdateSchema.parse(body);

    // Check if company exists
    const existingCompany = await prisma.company.findUnique({
      where: { id: params.id },
    });

    if (!existingCompany) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Company not found',
        },
        { status: 404 }
      );
    }

    // If updating name, check for duplicates (excluding current company)
    if (validatedData.name && validatedData.name !== existingCompany.name) {
      const duplicateCompany = await prisma.company.findFirst({
        where: {
          name: {
            equals: validatedData.name,
            mode: 'insensitive',
          },
          NOT: {
            id: params.id,
          },
        },
      });

      if (duplicateCompany) {
        return NextResponse.json(
          {
            ok: false,
            error: 'A company with this name already exists',
          },
          { status: 409 }
        );
      }
    }

    // Update company
    const updatedCompany = await prisma.company.update({
      where: { id: params.id },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: updatedCompany,
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
