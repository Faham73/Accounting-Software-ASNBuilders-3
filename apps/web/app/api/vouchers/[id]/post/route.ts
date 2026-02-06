import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { postVoucher } from '@/lib/vouchers/workflow';

/**
 * POST /api/vouchers/[id]/post
 * Post an approved voucher (APPROVED → POSTED)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'POST');

    const result = await postVoucher(
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
