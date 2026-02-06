import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { reverseVoucher } from '@/lib/vouchers/workflow';

/**
 * POST /api/vouchers/[id]/reverse
 * Reverse a posted voucher (POSTED → REVERSED, creates reversal voucher)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'POST'); // Use POST permission for reverse

    const body = await request.json().catch(() => ({}));
    const { date, description } = body;

    const result = await reverseVoucher(
      params.id,
      auth.userId,
      auth.companyId,
      auth.role,
      {
        date: date ? new Date(date) : undefined,
        description,
      },
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
