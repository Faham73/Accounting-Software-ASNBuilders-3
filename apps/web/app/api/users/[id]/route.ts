import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  requirePermission,
  createErrorResponse,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/rbac';
import { prisma, UserRole } from '@accounting/db';
import { createAuditLog } from '@/lib/audit';

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'ENGINEER', 'DATA_ENTRY', 'VIEWER']).optional(),
}).refine((data) => data.isActive !== undefined || data.role !== undefined, {
  message: 'Provide isActive and/or role',
});

/**
 * PATCH /api/users/[id] — Update isActive and/or role (ADMIN only, same company). Use POST .../reset-password to set password.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'users', 'WRITE');
    const target = await prisma.user.findUnique({
      where: { id: params.id },
    });
    if (!target || target.companyId !== auth.companyId) {
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validated = patchSchema.parse(body);
    if (validated.isActive === false && target.id === auth.userId) {
      return NextResponse.json(
        { ok: false, error: 'You cannot deactivate your own account' },
        { status: 400 }
      );
    }

    const updates: { isActive?: boolean; role?: UserRole } = {};
    let action: 'USER_ACTIVATE' | 'USER_DEACTIVATE' | 'UPDATE' = 'UPDATE';

    if (validated.isActive !== undefined) {
      updates.isActive = validated.isActive;
      action = validated.isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE';
    }
    if (validated.role !== undefined) {
      updates.role = validated.role as UserRole;
      action = 'UPDATE';
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'User',
      entityId: target.id,
      action,
      before: { isActive: target.isActive, role: target.role },
      after: { isActive: updated.isActive, role: updated.role },
      request,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    if (error instanceof UnauthorizedError) return createErrorResponse(error, 401);
    if (error instanceof ForbiddenError) return createErrorResponse(error, 403);
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}
