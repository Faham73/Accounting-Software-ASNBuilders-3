import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/rbac';
import { prisma, InviteTokenPurpose } from '@accounting/db';
import { createAuditLog } from '@/lib/audit';
import { createInviteToken } from '@/lib/inviteToken';
import { getClientIp, checkRateLimit, recordRateLimitAttempt } from '@/lib/rateLimit';

/**
 * POST /api/users/[id]/reset-password — Generate a set-password link token (ADMIN only, same company).
 * Returns raw token once; user sets password via /set-password?token=...
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'users', 'WRITE');
    const ip = getClientIp(request);
    await recordRateLimitAttempt(ip, 'reset-password');
    if (await checkRateLimit(ip, 'reset-password')) {
      return NextResponse.json(
        { ok: false, error: 'Too many requests. Try again later.' },
        { status: 429 }
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: params.id },
    });
    if (!target || target.companyId !== auth.companyId) {
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const setPasswordToken = await createInviteToken({
      userId: target.id,
      companyId: auth.companyId,
      purpose: InviteTokenPurpose.RESET_PASSWORD,
    });

    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'User',
      entityId: target.id,
      action: 'USER_RESET_PASSWORD',
      after: { setPasswordLinkGenerated: true },
      request,
    });

    return NextResponse.json({ ok: true, setPasswordToken });
  } catch (error) {
    if (error instanceof UnauthorizedError) return createErrorResponse(error, 401);
    if (error instanceof ForbiddenError) return createErrorResponse(error, 403);
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}
