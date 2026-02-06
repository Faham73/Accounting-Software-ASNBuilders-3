import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { CreditUpdateSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { Prisma } from '@prisma/client';

/**
 * PUT /api/credit/[id]
 * Update a credit entry
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    const body = await request.json();
    const validatedData = CreditUpdateSchema.parse(body);

    // Verify credit exists and belongs to company
    const existingCredit = await prisma.credit.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!existingCredit) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Credit not found or does not belong to your company',
        },
        { status: 404 }
      );
    }

    // If projectId is being updated, verify it exists and belongs to company
    let projectSnapshotName = validatedData.projectSnapshotName || existingCredit.projectSnapshotName;
    if (validatedData.projectId !== undefined) {
      if (validatedData.projectId) {
        const project = await prisma.project.findFirst({
          where: {
            id: validatedData.projectId,
            companyId: auth.companyId,
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (!project) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Project not found or does not belong to your company',
            },
            { status: 400 }
          );
        }

        // Use project name as snapshot name if not explicitly provided
        if (!validatedData.projectSnapshotName) {
          projectSnapshotName = project.name;
        }
      } else {
        // Company-level credit
        projectSnapshotName = validatedData.projectSnapshotName || 'Company (All Projects)';
      }
    }

    // Verify payment account if provided
    if (validatedData.paymentAccountId) {
      const account = await prisma.account.findFirst({
        where: {
          id: validatedData.paymentAccountId,
          companyId: auth.companyId,
        },
      });

      if (!account) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Payment account not found or does not belong to your company',
          },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {};
    if (validatedData.date !== undefined) updateData.date = validatedData.date;
    if (validatedData.projectId !== undefined) updateData.projectId = validatedData.projectId || null;
    if (projectSnapshotName) updateData.projectSnapshotName = projectSnapshotName;
    if (validatedData.purpose !== undefined) updateData.purpose = validatedData.purpose;
    if (validatedData.paidBy !== undefined) updateData.paidBy = validatedData.paidBy;
    if (validatedData.receivedBy !== undefined) updateData.receivedBy = validatedData.receivedBy;
    if (validatedData.paymentMethod !== undefined) updateData.paymentMethod = validatedData.paymentMethod;
    if (validatedData.paymentRef !== undefined) updateData.paymentRef = validatedData.paymentRef || null;
    if (validatedData.paymentAccountId !== undefined) updateData.paymentAccountId = validatedData.paymentAccountId || null;
    if (validatedData.amount !== undefined) updateData.amount = new Prisma.Decimal(validatedData.amount);
    if (validatedData.note !== undefined) updateData.note = validatedData.note || 'Done';

    // Update credit
    const updatedCredit = await prisma.credit.update({
      where: {
        id: params.id,
      },
      data: updateData,
      include: {
        project: {
          select: { id: true, name: true },
        },
        paymentAccount: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'Credit',
      entityId: updatedCredit.id,
      action: 'UPDATE',
      before: existingCredit,
      after: updatedCredit,
      request,
    });

    return NextResponse.json({
      ok: true,
      data: updatedCredit,
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
    return createErrorResponse(
      error instanceof Error ? error : new Error('Unknown error'),
      500
    );
  }
}

/**
 * DELETE /api/credit/[id]
 * Delete a credit entry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    // Verify credit exists and belongs to company
    const existingCredit = await prisma.credit.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!existingCredit) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Credit not found or does not belong to your company',
        },
        { status: 404 }
      );
    }

    // Delete credit
    await prisma.credit.delete({
      where: {
        id: params.id,
      },
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'Credit',
      entityId: params.id,
      action: 'DELETE',
      before: existingCredit,
      request,
    });

    return NextResponse.json({
      ok: true,
      message: 'Credit deleted successfully',
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(
      error instanceof Error ? error : new Error('Unknown error'),
      500
    );
  }
}
