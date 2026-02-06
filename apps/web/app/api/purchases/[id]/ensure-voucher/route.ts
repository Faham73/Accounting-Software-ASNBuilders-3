import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { ensurePurchaseVoucher } from '@/lib/purchases/purchaseAccounting.server';
import { createAuditLog } from '@/lib/audit';

/**
 * POST /api/purchases/[id]/ensure-voucher
 * Create a voucher for a purchase if it doesn't exist
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'purchases', 'WRITE');

    const result = await ensurePurchaseVoucher(params.id, auth.companyId, auth.userId);

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'Purchase',
      entityId: params.id,
      action: 'CREATE',
      after: { voucherId: result.voucherId },
      request,
    });

    // Revalidate purchase pages
    revalidatePath(`/dashboard/purchases/${params.id}`);
    revalidatePath('/dashboard/purchases');
    if (result.voucherId) {
      revalidatePath(`/dashboard/vouchers/${result.voucherId}`);
    }

    return NextResponse.json({
      ok: true,
      data: {
        voucherId: result.voucherId,
      },
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
