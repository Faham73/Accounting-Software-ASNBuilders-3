import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { generateVoucherNumber } from '@/lib/voucher';
import { createAuditLog } from '@/lib/audit';

/**
 * POST /api/voucher-lines/[lineId]/adjust
 * Create an adjustment voucher (new DRAFT voucher) based on a POSTED voucher line
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { lineId: string } }
) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    // Fetch the voucher line with its voucher and related data
    const voucherLine = await prisma.voucherLine.findUnique({
      where: { id: params.lineId },
      include: {
        voucher: true,
        account: true,
        project: true,
        paymentMethod: true,
      },
    });

    if (!voucherLine) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Voucher line not found',
        },
        { status: 404 }
      );
    }

    // Verify company ownership
    if (voucherLine.companyId !== auth.companyId) {
      return createErrorResponse(new ForbiddenError('Voucher line does not belong to your company'), 403);
    }

    // Only allow adjustment for POSTED vouchers
    if (voucherLine.voucher.status !== 'POSTED') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Adjustment can only be created for POSTED vouchers',
        },
        { status: 400 }
      );
    }

    // Create new DRAFT voucher with adjustment line
    const today = new Date();
    const voucherNo = await generateVoucherNumber(auth.companyId, today);

    const newVoucher = await prisma.$transaction(async (tx) => {
      // Create new voucher
      const voucher = await tx.voucher.create({
        data: {
          companyId: auth.companyId,
          projectId: voucherLine.projectId,
          voucherNo,
          date: today,
          status: 'DRAFT',
          narration: `Adjustment for ${voucherLine.voucher.voucherNo}`,
          expenseType: voucherLine.voucher.expenseType,
          createdByUserId: auth.userId,
        },
      });

      // Create adjustment line with same values as original
      const adjustmentLine = await tx.voucherLine.create({
        data: {
          voucherId: voucher.id,
          companyId: auth.companyId,
          accountId: voucherLine.accountId,
          description: voucherLine.description,
          debit: voucherLine.debit,
          credit: voucherLine.credit,
          projectId: voucherLine.projectId,
          isCompanyLevel: voucherLine.isCompanyLevel,
          vendorId: voucherLine.vendorId,
          paymentMethodId: voucherLine.paymentMethodId,
          // PDF fields
          workDetails: voucherLine.workDetails,
          paidBy: voucherLine.paidBy,
          receivedBy: voucherLine.receivedBy,
          fileRef: voucherLine.fileRef,
          voucherRef: voucherLine.voucherRef,
        },
        include: {
          account: {
            select: { id: true, code: true, name: true },
          },
          project: {
            select: { id: true, name: true },
          },
          paymentMethod: {
            select: { id: true, name: true },
          },
        },
      });

      return { voucher, adjustmentLine };
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'VOUCHER',
      entityId: newVoucher.voucher.id,
      action: 'CREATE',
      after: newVoucher.voucher,
      metadata: {
        adjustedFromLineId: params.lineId,
        adjustedFromVoucherId: voucherLine.voucher.id,
      },
      request,
    });

    return NextResponse.json({
      ok: true,
      data: {
        voucherId: newVoucher.voucher.id,
        lineId: newVoucher.adjustmentLine.id,
        voucherNo: newVoucher.voucher.voucherNo,
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
