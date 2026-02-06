import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { VoucherLineUpdateSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { canEditVoucher, generateVoucherNumber } from '@/lib/voucher';
import { createAuditLog } from '@/lib/audit';

/**
 * PATCH /api/voucher-lines/[lineId]
 * Update a single voucher line
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { lineId: string } }
) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    const body = await request.json();
    const validatedData = VoucherLineUpdateSchema.parse(body);

    // Fetch the voucher line with its voucher
    const voucherLine = await prisma.voucherLine.findUnique({
      where: { id: params.lineId },
      include: {
        voucher: true,
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

    // Check if voucher can be edited
    if (!canEditVoucher(voucherLine.voucher.status)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot edit voucher line. Voucher status is ${voucherLine.voucher.status}. Only DRAFT vouchers can be edited.`,
        },
        { status: 400 }
      );
    }

    // Update the voucher line
    const updated = await prisma.$transaction(async (tx) => {
      const updatedLine = await tx.voucherLine.update({
        where: { id: params.lineId },
        data: {
          ...(validatedData.accountId && { accountId: validatedData.accountId }),
          ...(validatedData.description !== undefined && { description: validatedData.description || null }),
          ...(validatedData.debit !== undefined && { debit: validatedData.debit }),
          ...(validatedData.credit !== undefined && { credit: validatedData.credit }),
          ...(validatedData.projectId !== undefined && {
            projectId: validatedData.projectId || null,
          }),
          ...(validatedData.isCompanyLevel !== undefined && { isCompanyLevel: validatedData.isCompanyLevel }),
          ...(validatedData.vendorId !== undefined && { vendorId: validatedData.vendorId || null }),
          ...(validatedData.paymentMethodId !== undefined && { paymentMethodId: validatedData.paymentMethodId || null }),
          // PDF fields
          ...(validatedData.workDetails !== undefined && { workDetails: validatedData.workDetails || null }),
          ...(validatedData.paidBy !== undefined && { paidBy: validatedData.paidBy || null }),
          ...(validatedData.receivedBy !== undefined && { receivedBy: validatedData.receivedBy || null }),
          ...(validatedData.fileRef !== undefined && { fileRef: validatedData.fileRef || null }),
          ...(validatedData.voucherRef !== undefined && { voucherRef: validatedData.voucherRef || null }),
        },
        include: {
          voucher: {
            select: {
              id: true,
              voucherNo: true,
              date: true,
              type: true,
              narration: true,
            },
          },
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

      return updatedLine;
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'VOUCHER_LINE',
      entityId: updated.id,
      action: 'UPDATE',
      after: updated,
      request,
    });

    return NextResponse.json({
      ok: true,
      data: updated,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.errors[0]?.message || 'Validation error',
        },
        { status: 400 }
      );
    }
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}

/**
 * DELETE /api/voucher-lines/[lineId]
 * Delete a single voucher line
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { lineId: string } }
) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    // Fetch the voucher line with its voucher
    const voucherLine = await prisma.voucherLine.findUnique({
      where: { id: params.lineId },
      include: {
        voucher: {
          include: {
            lines: true,
          },
        },
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

    // Check if voucher can be edited
    if (!canEditVoucher(voucherLine.voucher.status)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot delete voucher line. Voucher status is ${voucherLine.voucher.status}. Only DRAFT vouchers can be edited.`,
        },
        { status: 400 }
      );
    }

    // Check if voucher has at least 2 lines (required for voucher balance)
    if (voucherLine.voucher.lines.length <= 2) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Cannot delete voucher line. A voucher must have at least 2 lines.',
        },
        { status: 400 }
      );
    }

    // Delete the voucher line
    await prisma.$transaction(async (tx) => {
      await tx.voucherLine.delete({
        where: { id: params.lineId },
      });
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'VOUCHER_LINE',
      entityId: params.lineId,
      action: 'DELETE',
      request,
    });

    return NextResponse.json({
      ok: true,
      message: 'Voucher line deleted successfully',
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
