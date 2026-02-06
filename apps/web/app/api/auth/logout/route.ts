import { NextRequest } from 'next/server';
import { requireAuth, createErrorResponse, UnauthorizedError } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Require authentication to logout (must be logged in to logout)
    await requireAuth(request);

    const response = NextResponse.json({ ok: true });

    // Clear the token cookie
    response.cookies.set('token', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}
