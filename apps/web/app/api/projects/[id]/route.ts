import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { ProjectUpdateSchema } from '@accounting/shared';
import { ZodError } from 'zod';

/**
 * GET /api/projects/[id]
 * Get a single project by ID (scoped to user's company)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'READ');

    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId, // Ensure company scoping
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

    if (!project) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: project,
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
 * PATCH /api/projects/[id]
 * Update a project (requires WRITE permission)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'WRITE');

    const body = await request.json();

    // Validate input with Zod
    const validatedData = ProjectUpdateSchema.parse(body);

    // Check if project exists and belongs to user's company
    const existingProject = await prisma.project.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!existingProject) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    // Validate parentProjectId if provided (must belong to same company and be a main project)
    if (validatedData.parentProjectId !== undefined && validatedData.parentProjectId !== null) {
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
      // Prevent circular reference: cannot set parent to self
      if (validatedData.parentProjectId === params.id) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Project cannot be its own parent',
          },
          { status: 400 }
        );
      }
    }

    // Build update data (only include fields that are provided)
    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.clientName !== undefined) updateData.clientName = validatedData.clientName;
    if (validatedData.clientContact !== undefined)
      updateData.clientContact = validatedData.clientContact;
    if (validatedData.siteLocation !== undefined)
      updateData.siteLocation = validatedData.siteLocation;
    if (validatedData.startDate !== undefined) updateData.startDate = validatedData.startDate;
    if (validatedData.expectedEndDate !== undefined)
      updateData.expectedEndDate = validatedData.expectedEndDate;
    if (validatedData.contractValue !== undefined)
      updateData.contractValue = validatedData.contractValue;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.assignedManager !== undefined)
      updateData.assignedManager = validatedData.assignedManager;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    // New fields
    if (validatedData.address !== undefined) updateData.address = validatedData.address;
    if (validatedData.projectManager !== undefined)
      updateData.projectManager = validatedData.projectManager;
    if (validatedData.projectEngineer !== undefined)
      updateData.projectEngineer = validatedData.projectEngineer;
    if (validatedData.companySiteName !== undefined)
      updateData.companySiteName = validatedData.companySiteName;
    if (validatedData.reference !== undefined) updateData.reference = validatedData.reference;
    if (validatedData.isMain !== undefined) updateData.isMain = validatedData.isMain;
    if (validatedData.parentProjectId !== undefined)
      updateData.parentProjectId = validatedData.parentProjectId;
    if ('budgetTotal' in validatedData)
      updateData.budgetTotal = validatedData.budgetTotal ?? null;

    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: updateData,
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

    return NextResponse.json({
      ok: true,
      data: updatedProject,
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
 * DELETE /api/projects/[id]
 * Soft delete a project by setting isActive=false (requires WRITE permission)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'WRITE');

    // Check if project exists and belongs to user's company
    const existingProject = await prisma.project.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!existingProject) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    // Soft delete by setting isActive=false
    const deletedProject = await prisma.project.update({
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
      data: deletedProject,
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
