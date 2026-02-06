import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, createErrorResponse, ForbiddenError, UnauthorizedError } from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { CompanyCreateSchema } from '@accounting/shared';
import { ZodError } from 'zod';

/**
 * GET /api/companies
 * List all companies (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const companies = await prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
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
      data: companies,
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
 * POST /api/companies
 * Create a new company (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();

    // Validate input with Zod
    const validatedData = CompanyCreateSchema.parse(body);

    // Check for duplicate company name
    const existingCompany = await prisma.company.findFirst({
      where: {
        name: {
          equals: validatedData.name,
          mode: 'insensitive', // Case-insensitive check
        },
      },
    });

    if (existingCompany) {
      return NextResponse.json(
        {
          ok: false,
          error: 'A company with this name already exists',
        },
        { status: 409 }
      );
    }

    // Create company
    const company = await prisma.company.create({
      data: {
        name: validatedData.name,
        isActive: validatedData.isActive ?? true,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        data: company,
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
