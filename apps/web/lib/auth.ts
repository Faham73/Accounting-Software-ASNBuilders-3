import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@accounting/db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'
);

export interface AuthUser {
  userId: string;
  companyId: string;
  role: string;
}

export interface AuthUserWithDetails {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
}

/**
 * Sign a JWT token with user payload
 */
export async function signToken(payload: AuthUser): Promise<string> {
  return await new SignJWT({ ...payload } as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as AuthUser;
}

/**
 * Get auth user from request cookie, verify JWT, and load from DB
 */
export async function getAuthUser(
  request: NextRequest
): Promise<AuthUserWithDetails | null> {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return null;
    }

    const authPayload = await verifyToken(token);

    const user = await prisma.user.findUnique({
      where: {
        id: authPayload.userId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get cookie options for setting auth token
 */
export function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  };
}
