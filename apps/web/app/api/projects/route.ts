import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { ProjectCreateSchema } from '@accounting/shared';
import { ZodError } from 'zod';

/**
 * GET /api/projects
 * List projects for user's company with optional filters
 * Query params: q (search), status, active (default: true)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'projects', 'READ');

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const status = searchParams.get('status');
    const activeParam = searchParams.get('active');
    // Handle 'all' as null (no filter)
    const active = activeParam === null || activeParam === 'all' ? null : activeParam === 'true';

    // Build where clause
    const where: any = {
      companyId: auth.companyId,
    };

    // Filter by active status (only if not 'all')
    if (active !== null) {
      where.isActive = active;
    }

    // Filter by status (only if not 'all')
    if (status && status !== 'all') {
      where.status = status;
    }

    // Search across multiple fields (case-insensitive)
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
        { companySiteName: { contains: q, mode: 'insensitive' } },
        { projectManager: { contains: q, mode: 'insensitive' } },
        { projectEngineer: { contains: q, mode: 'insensitive' } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        files: {
          select: { id: true },
        },
        vouchers: {
          select: { id: true },
        },
        parentProject: {
          select: { id: true, name: true },
        },
      },
    });

    // Transform to include computed fields
    const projectsWithCounts = projects.map((project) => {
      const entriesCount = project.vouchers.length;
      const filesCount = project.files.length;
      
      return {
        id: project.id,
        name: project.name,
        clientName: project.clientName,
        clientContact: project.clientContact,
        siteLocation: project.siteLocation,
        startDate: project.startDate,
        expectedEndDate: project.expectedEndDate,
        contractValue: project.contractValue,
        status: project.status,
        assignedManager: project.assignedManager,
        isActive: project.isActive,
        // New fields
        address: project.address,
        projectManager: project.projectManager,
        projectEngineer: project.projectEngineer,
        companySiteName: project.companySiteName,
        reference: project.reference,
        isMain: project.isMain,
        parentProjectId: project.parentProjectId,
        parentProject: project.parentProject,
        budgetTotal: project.budgetTotal,
        // Computed fields
        entriesCount,
        filesCount,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      };
    });

    return NextResponse.json({
      ok: true,
      data: projectsWithCounts,
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
 * POST /api/projects
 * Create a new project (requires WRITE permission)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'projects', 'WRITE');

    const body = await request.json();

    // Validate input with Zod
    const validatedData = ProjectCreateSchema.parse(body);

    // Validate parentProjectId if provided (must belong to same company and be a main project)
    if (validatedData.parentProjectId) {
      const parentProject = await prisma.project.findFirst({
        where: {
          id: validatedData.parentProjectId,
          companyId: auth.companyId,
          isMain: true,
        },
      });
      if (!parentProject) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Parent project not found or is not a main project',
          },
          { status: 400 }
        );
      }
    }

    // Create project (companyId from auth context)
    const project = await prisma.project.create({
      data: {
        companyId: auth.companyId,
        name: validatedData.name,
        clientName: validatedData.clientName,
        clientContact: validatedData.clientContact,
        siteLocation: validatedData.siteLocation,
        startDate: validatedData.startDate,
        expectedEndDate: validatedData.expectedEndDate,
        contractValue: validatedData.contractValue,
        status: validatedData.status || 'DRAFT',
        assignedManager: validatedData.assignedManager,
        isActive: validatedData.isActive ?? true,
        // New fields
        address: validatedData.address,
        projectManager: validatedData.projectManager,
        projectEngineer: validatedData.projectEngineer,
        companySiteName: validatedData.companySiteName,
        reference: validatedData.reference,
        isMain: validatedData.isMain ?? false,
        parentProjectId: validatedData.parentProjectId,
        budgetTotal: validatedData.budgetTotal ?? null,
      },
      select: {
        id: true,
        name: true,
        clientName: true,
        clientContact: true,
        siteLocation: true,
        startDate: true,
        expectedEndDate: true,
        contractValue: true,
        status: true,
        assignedManager: true,
        isActive: true,
        address: true,
        projectManager: true,
        projectEngineer: true,
        companySiteName: true,
        reference: true,
        isMain: true,
        parentProjectId: true,
        budgetTotal: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        data: project,
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
