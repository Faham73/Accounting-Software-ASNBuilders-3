import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { z } from 'zod';
import { ZodError } from 'zod';

const ExpenseCategoryUpdateSchema = z.object({
  name: z.string().min(1, 'Category name is required').optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/expense-categories/[id]
 * Get a single expense category
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'expenses', 'READ');

    const category = await prisma.expenseCategory.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!category) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Category not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: category,
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
 * PUT /api/expense-categories/[id]
 * Update an expense category
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'expenses', 'WRITE');

    const existing = await prisma.expenseCategory.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Category not found',
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = ExpenseCategoryUpdateSchema.parse(body);

    // Check name uniqueness if name is being updated
    if (validatedData.name && validatedData.name !== existing.name) {
      const nameExists = await prisma.expenseCategory.findUnique({
        where: {
          companyId_name: {
            companyId: auth.companyId,
            name: validatedData.name,
          },
        },
      });

      if (nameExists) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Category with this name already exists',
          },
          { status: 400 }
        );
      }
    }

    const category = await prisma.expenseCategory.update({
      where: {
        id: params.id,
      },
      data: {
        name: validatedData.name ?? existing.name,
        isActive: validatedData.isActive ?? existing.isActive,
      },
    });

    return NextResponse.json({
      ok: true,
      data: category,
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
 * DELETE /api/expense-categories/[id]
 * Delete an expense category (only if not used)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'expenses', 'WRITE');

    const category = await prisma.expenseCategory.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
      include: {
        expenses: {
          take: 1,
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Category not found',
        },
        { status: 404 }
      );
    }

    if (category.expenses.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Cannot delete category that is used in expenses',
        },
        { status: 400 }
      );
    }

    await prisma.expenseCategory.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({
      ok: true,
      data: { id: params.id },
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
