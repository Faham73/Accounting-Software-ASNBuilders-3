import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { submitVoucher } from '@/lib/vouchers/workflow';

/**
 * POST /api/vouchers/[id]/submit
 * Submit a draft voucher (DRAFT → SUBMITTED)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request);

    const result = await submitVoucher(
      params.id,
      auth.userId,
      auth.companyId,
      auth.role,
      request
    );

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: result.voucher,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}
