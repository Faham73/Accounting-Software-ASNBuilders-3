import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '@accounting/db';
import { verifyInviteToken, markTokenUsed } from '@/lib/inviteToken';

/**
 * GET /api/auth/set-password?token=... — Validate token and return user info for the form (no auth).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Token required' }, { status: 400 });
  }
  const payload = await verifyInviteToken(token);
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired link' }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    data: { email: payload.user.email, name: payload.user.name },
  });
}

const bodySchema = z
  .object({
    token: z.string().min(1, 'Token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * POST /api/auth/set-password — Set password using invite/reset token. Token is single-use.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = bodySchema.parse(body);

    const tokenPayload = await verifyInviteToken(validated.token);
    if (!tokenPayload) {
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired link. Request a new one from your admin.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(validated.newPassword, 10);
    await prisma.user.update({
      where: { id: tokenPayload.userId },
      data: { passwordHash },
    });
    await markTokenUsed(tokenPayload.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: 'Failed to set password' },
      { status: 500 }
    );
  }
}
