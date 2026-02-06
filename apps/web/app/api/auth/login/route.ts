import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '@accounting/db';
import { signToken, getCookieOptions } from '@/lib/auth';
import { getClientIp, checkRateLimit, recordRateLimitAttempt } from '@/lib/rateLimit';
import { createAuditLog } from '@/lib/audit';

const LOCKOUT_AFTER_FAILURES = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    await recordRateLimitAttempt(ip, 'login');
    if (await checkRateLimit(ip, 'login')) {
      return NextResponse.json(
        { ok: false, error: 'Too many login attempts. Try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedData = loginSchema.parse(body);

    // Check rate limit by email too
    await recordRateLimitAttempt(validatedData.email.toLowerCase(), 'login');
    if (await checkRateLimit(validatedData.email.toLowerCase(), 'login')) {
      return NextResponse.json(
        { ok: false, error: 'Too many login attempts. Try again later.' },
        { status: 429 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: {
        email: validatedData.email,
      },
    });

    // Verify user exists and is active
    if (!user) {
      await createAuditLog({
        action: 'LOGIN_FAILURE',
        metadata: { email: validatedData.email, reason: 'user_not_found' },
        request,
      });
      return NextResponse.json(
        { ok: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await createAuditLog({
        companyId: user.companyId,
        actorUserId: user.id,
        action: 'LOGIN_FAILURE',
        metadata: { email: user.email, reason: 'account_locked' },
        request,
      });
      return NextResponse.json(
        { ok: false, error: 'Account temporarily locked due to too many failed attempts. Try again later.' },
        { status: 423 }
      );
    }

    if (!user.isActive) {
      await createAuditLog({
        companyId: user.companyId,
        actorUserId: user.id,
        action: 'LOGIN_FAILURE',
        metadata: { email: user.email, reason: 'account_inactive' },
        request,
      });
      return NextResponse.json(
        { ok: false, error: 'Account is inactive' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(
      validatedData.password,
      user.passwordHash
    );

    if (!isValidPassword) {
      const newFailedCount = user.failedLoginCount + 1;
      const shouldLock = newFailedCount >= LOCKOUT_AFTER_FAILURES;
      const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: newFailedCount,
          lockedUntil,
        },
      });

      await createAuditLog({
        companyId: user.companyId,
        actorUserId: user.id,
        action: 'LOGIN_FAILURE',
        metadata: { email: user.email, reason: 'invalid_password', failedCount: newFailedCount },
        request,
      });

      return NextResponse.json(
        { ok: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Success: reset failed login count and lockedUntil
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    await createAuditLog({
      companyId: user.companyId,
      actorUserId: user.id,
      entityType: 'User',
      entityId: user.id,
      action: 'LOGIN_SUCCESS',
      after: { email: user.email },
      request,
    });

    // Create JWT token
    const token = await signToken({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
    });

    // Create response with user data
    const response = NextResponse.json({
      ok: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        },
      },
    });

    // Set httpOnly cookie
    response.cookies.set('token', token, getCookieOptions());

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack });
    
    return NextResponse.json(
      { ok: false, error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
      { status: 500 }
    );
  }
}
