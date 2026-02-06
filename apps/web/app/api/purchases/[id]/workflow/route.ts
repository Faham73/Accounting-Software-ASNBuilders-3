import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  requireAuth,
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import {
  submitVoucher,
  approveVoucher,
  postVoucher,
  reverseVoucher,
} from '@/lib/vouchers/workflow';
import {
  syncPurchaseStatusWithVoucher,
} from '@/lib/purchases/purchaseAccounting.server';
import {
  createStockMovementsForPostedPurchase,
  reverseStockMovementsForPurchase,
} from '@/lib/purchases/stockIntegration.server';
import { can } from '@/lib/permissions';

/**
 * POST /api/purchases/[id]/workflow
 * Perform workflow action on purchase (via linked voucher)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request);

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body might be empty
    }
    const { action } = body;

    if (!['SUBMIT', 'APPROVE', 'POST', 'REVERSE'].includes(action)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid action. Must be SUBMIT, APPROVE, POST, or REVERSE',
        },
        { status: 400 }
      );
    }

    // Get purchase
    const purchase = await prisma.purchase.findUnique({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
      include: {
        voucher: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Purchase not found',
        },
        { status: 404 }
      );
    }

    // Ensure voucher exists for SUBMIT/APPROVE/POST/REVERSE
    if (!purchase.voucherId) {
      if (action === 'SUBMIT' || action === 'APPROVE' || action === 'POST' || action === 'REVERSE') {
        return NextResponse.json(
          {
            ok: false,
            error: 'Purchase must have a voucher. Please create a voucher first.',
          },
          { status: 400 }
        );
      }
    }

    // Check permissions based on action
    if (action === 'APPROVE' || action === 'POST' || action === 'REVERSE') {
      if (!can(auth.role, 'vouchers', action === 'REVERSE' ? 'POST' : action)) {
        throw new ForbiddenError(`You do not have permission to ${action} purchases`);
      }
    }

    // Perform workflow action on voucher
    let workflowResult;
    const voucherId = purchase.voucherId!;

    switch (action) {
      case 'SUBMIT':
        workflowResult = await submitVoucher(
          voucherId,
          auth.userId,
          auth.companyId,
          auth.role,
          request
        );
        break;

      case 'APPROVE':
        workflowResult = await approveVoucher(
          voucherId,
          auth.userId,
          auth.companyId,
          auth.role,
          request
        );
        break;

      case 'POST':
        workflowResult = await postVoucher(
          voucherId,
          auth.userId,
          auth.companyId,
          auth.role,
          request
        );
        break;

      case 'REVERSE':
        workflowResult = await reverseVoucher(
          voucherId,
          auth.userId,
          auth.companyId,
          auth.role,
          {
            date: body.date ? new Date(body.date) : undefined,
            description: body.description,
          },
          request
        );
        break;

      default:
        return NextResponse.json(
          {
            ok: false,
            error: 'Invalid action',
          },
          { status: 400 }
        );
    }

    if (!workflowResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: workflowResult.error,
        },
        { status: 400 }
      );
    }

    // Sync purchase status with voucher status
    await syncPurchaseStatusWithVoucher(voucherId, auth.companyId);

    // Create stock movements on POST (handled by stockIntegration.server.ts)
    if (action === 'POST' && workflowResult.voucher?.status === 'POSTED') {
      // Create stock movements for purchase lines with stockItemId
      // Debug: Log material lines before creating stock movements
      const purchaseForDebug = await prisma.purchase.findUnique({
        where: { id: params.id, companyId: auth.companyId },
        include: {
          lines: {
            where: {
              lineType: 'MATERIAL',
              stockItemId: { not: null },
              quantity: { gt: 0 },
            },
            include: {
              stockItem: true,
            },
          },
        },
      });
      
      if (purchaseForDebug) {
        const materialLines = purchaseForDebug.lines.filter(
          (line) => line.lineType === 'MATERIAL' && line.stockItemId && line.quantity && line.quantity.gt(0)
        );
        console.log(`[Purchase POST] Material lines count: ${materialLines.length}`);
        materialLines.forEach((line, idx) => {
          console.log(
            `[Purchase POST] Material line ${idx + 1}: stockItemId=${line.stockItemId}, stockItemName=${line.stockItem?.name || 'N/A'}, qty=${line.quantity?.toString() || '0'}, unitRate=${line.unitRate?.toString() || 'N/A'}`
          );
        });
      }
      
      const stockResult = await createStockMovementsForPostedPurchase(params.id, auth.companyId, auth.userId);
      console.log(`[Purchase POST] Stock movements created: ${stockResult.movementsCreated}`);
      if (stockResult.error) {
        console.error(`[Purchase POST] Stock movement error: ${stockResult.error}`);
      }
    }

    // Reverse stock movements on REVERSE
    if (action === 'REVERSE') {
      await reverseStockMovementsForPurchase(params.id, auth.companyId, auth.userId);
    }

    // Fetch updated purchase
    const updatedPurchase = await prisma.purchase.findUnique({
      where: { id: params.id },
      include: {
        voucher: {
          select: {
            id: true,
            voucherNo: true,
            status: true,
          },
        },
      },
    });

    // Revalidate purchase and voucher pages
    revalidatePath(`/dashboard/purchases/${params.id}`);
    revalidatePath('/dashboard/purchases');
    if (voucherId) {
      revalidatePath(`/dashboard/vouchers/${voucherId}`);
    }

    return NextResponse.json({
      ok: true,
      data: {
        purchase: updatedPurchase,
        voucher: workflowResult.voucher,
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
