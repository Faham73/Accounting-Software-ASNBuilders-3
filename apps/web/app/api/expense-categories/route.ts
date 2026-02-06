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

const ExpenseCategoryCreateSchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  isActive: z.boolean().optional().default(true),
});

const ExpenseCategoryUpdateSchema = z.object({
  name: z.string().min(1, 'Category name is required').optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/expense-categories
 * List expense categories for user's company
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'expenses', 'READ');

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';

    const where: any = {
      companyId: auth.companyId,
    };

    if (activeOnly) {
      where.isActive = true;
    }

    const categories = await prisma.expenseCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({
      ok: true,
      data: categories,
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
 * POST /api/expense-categories
 * Create a new expense category
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'expenses', 'WRITE');

    const body = await request.json();
    const validatedData = ExpenseCategoryCreateSchema.parse(body);

    // Check if category with same name already exists
    const existing = await prisma.expenseCategory.findUnique({
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
          error: 'Category with this name already exists',
        },
        { status: 400 }
      );
    }

    const category = await prisma.expenseCategory.create({
      data: {
        companyId: auth.companyId,
        name: validatedData.name,
        isActive: validatedData.isActive ?? true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        data: category,
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
