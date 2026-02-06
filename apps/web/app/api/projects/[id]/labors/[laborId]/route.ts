import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { ProjectLaborUpdateSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { Prisma } from '@prisma/client';

/**
 * PATCH /api/projects/[id]/labors/[laborId]
 * Update a labor entry (e.g. teamLeader, paid, rating, amount, date, note).
 * Recomputes due = max(0, amount - paid) on save.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; laborId: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'WRITE');

    const body = await request.json();
    const validatedData = ProjectLaborUpdateSchema.parse(body);

    const existing = await prisma.projectLabor.findFirst({
      where: {
        id: params.laborId,
        projectId: params.id,
        companyId: auth.companyId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: 'Labor entry not found' },
        { status: 404 }
      );
    }

    const amount = validatedData.amount ?? existing.amount.toNumber();
    const paidNum = validatedData.paid !== undefined ? validatedData.paid : (existing.paid?.toNumber() ?? 0);
    const due = Math.max(0, amount - paidNum);

    const updateData: Prisma.ProjectLaborUpdateInput = {
      ...(validatedData.date !== undefined && { date: validatedData.date }),
      ...(validatedData.amount !== undefined && { amount: new Prisma.Decimal(validatedData.amount) }),
      ...(validatedData.note !== undefined && { note: validatedData.note ?? null }),
      ...(validatedData.workerName !== undefined && { workerName: validatedData.workerName ?? null }),
      ...(validatedData.employeeName !== undefined && { employeeName: validatedData.employeeName ?? null }),
      ...(validatedData.month !== undefined && { month: validatedData.month ?? null }),
      ...(validatedData.year !== undefined && { year: validatedData.year ?? null }),
      ...(validatedData.teamLeader !== undefined && { teamLeader: validatedData.teamLeader ?? null }),
      ...(validatedData.paid !== undefined && { paid: new Prisma.Decimal(validatedData.paid) }),
      due: new Prisma.Decimal(due),
      ...(validatedData.rating !== undefined && { rating: validatedData.rating ?? null }),
    };

    const labor = await prisma.projectLabor.update({
      where: { id: params.laborId },
      data: updateData,
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'ProjectLabor',
      entityId: labor.id,
      action: 'UPDATE',
      after: labor,
      request,
    });

    return NextResponse.json({ ok: true, data: labor });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: error.errors[0]?.message || 'Validation error' },
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
