import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createErrorResponse, UnauthorizedError } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    return NextResponse.json({
      ok: true,
      data: {
        user: auth.user,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}
