import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { resolvePaymentAccountId } from '@/lib/purchases/purchasePaymentDefaults.server';

/**
 * GET /api/payment-methods/[id]/default-account
 * Returns the default credit account id for this payment method when type is CASH or BANK.
 * Used by debit/expense forms to auto-fill credit account from payment method.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'READ');

    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
        isActive: true,
      },
      select: { type: true },
    });

    if (!paymentMethod) {
      return NextResponse.json(
        { ok: false, error: 'Payment method not found' },
        { status: 404 }
      );
    }

    const type = paymentMethod.type as string;
    if (type !== 'CASH' && type !== 'BANK') {
      return NextResponse.json({
        ok: true,
        data: { accountId: null },
      });
    }

    const result = await resolvePaymentAccountId(auth.companyId, type as 'CASH' | 'BANK');
    if ('error' in result) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: { accountId: result.paymentAccountId },
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
