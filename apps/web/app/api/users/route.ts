import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import {
  requirePermission,
  createErrorResponse,
  UnauthorizedError,
  ForbiddenError,
} from '@/lib/rbac';
import { prisma, UserRole, InviteTokenPurpose } from '@accounting/db';
import { createAuditLog } from '@/lib/audit';
import { createInviteToken } from '@/lib/inviteToken';
import { getClientIp, checkRateLimit, recordRateLimitAttempt } from '@/lib/rateLimit';

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'ENGINEER', 'DATA_ENTRY', 'VIEWER']),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

function generateTemporaryPassword(): string {
  return crypto.randomBytes(6).toString('hex');
}

/**
 * GET /api/users — List users for the current company (ADMIN only)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'users', 'READ');
    const users = await prisma.user.findMany({
      where: { companyId: auth.companyId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ ok: true, data: users });
  } catch (error) {
    if (error instanceof UnauthorizedError) return createErrorResponse(error, 401);
    if (error instanceof ForbiddenError) return createErrorResponse(error, 403);
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}

/**
 * POST /api/users — Create user (ADMIN only). Password optional; when omitted a temp password is generated and returned once.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'users', 'WRITE');
    const ip = getClientIp(request);
    await recordRateLimitAttempt(ip, 'create-user');
    if (await checkRateLimit(ip, 'create-user')) {
      return NextResponse.json(
        { ok: false, error: 'Too many requests. Try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validated = createUserSchema.parse(body);

    const existing = await prisma.user.findUnique({
      where: { email: validated.email },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    const password = validated.password ?? generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        name: validated.name,
        passwordHash,
        role: validated.role as UserRole,
        companyId: auth.companyId,
        isActive: true,
      },
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
      entityId: user.id,
      action: 'CREATE',
      after: { email: user.email, role: user.role },
      request,
    });

    const setPasswordToken = await createInviteToken({
      userId: user.id,
      companyId: auth.companyId,
      purpose: InviteTokenPurpose.INVITE,
    });

    const response: { ok: true; data: typeof user & { temporaryPassword?: string }; setPasswordToken: string } = {
      ok: true,
      data: user,
      setPasswordToken,
    };
    if (!validated.password) {
      (response.data as typeof user & { temporaryPassword?: string }) = { ...user, temporaryPassword: password };
    }
    return NextResponse.json(response);
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
