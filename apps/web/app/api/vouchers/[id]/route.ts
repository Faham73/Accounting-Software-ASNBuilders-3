import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { VoucherUpdateSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { validateVoucherBalance, canEditVoucher } from '@/lib/voucher';

/**
 * GET /api/vouchers/[id]
 * Get voucher by ID with all lines
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'READ');

    const voucher = await prisma.voucher.findUnique({
      where: { id: params.id },
      include: {
        project: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        postedBy: {
          select: { id: true, name: true, email: true },
        },
        lines: {
          include: {
            account: {
              select: { id: true, code: true, name: true, type: true },
            },
            project: {
              select: { id: true, name: true },
            },
            vendor: {
              select: { id: true, name: true },
            },
            paymentMethod: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        allocations: {
          include: {
            sourceLine: {
              include: {
                voucher: {
                  select: { id: true, voucherNo: true, date: true },
                },
                account: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!voucher) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Voucher not found',
        },
        { status: 404 }
      );
    }

    if (voucher.companyId !== auth.companyId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Voucher not found',
        },
        { status: 404 }
      );
    }

    // Calculate totals
    const totalDebit = voucher.lines.reduce((sum, line) => sum + Number(line.debit), 0);
    const totalCredit = voucher.lines.reduce((sum, line) => sum + Number(line.credit), 0);

    return NextResponse.json({
      ok: true,
      data: {
        ...voucher,
        totalDebit,
        totalCredit,
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

/**
 * PATCH /api/vouchers/[id]
 * Update draft voucher (only DRAFT vouchers can be updated)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    const voucher = await prisma.voucher.findUnique({
      where: { id: params.id },
      include: {
        lines: true,
      },
    });

    if (!voucher || voucher.companyId !== auth.companyId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Voucher not found',
        },
        { status: 404 }
      );
    }

    // Only DRAFT vouchers can be edited
    if (!canEditVoucher(voucher.status)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Only DRAFT vouchers can be edited',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = VoucherUpdateSchema.parse(body);

    // If lines are being updated, validate balance
    if (validatedData.lines) {
      const balanceCheck = validateVoucherBalance(validatedData.lines);
      if (!balanceCheck.valid) {
        return NextResponse.json(
          {
            ok: false,
            error: balanceCheck.error,
          },
          { status: 400 }
        );
      }

      // Validate all accounts exist, belong to company, and are active
      const accountIds = validatedData.lines.map((line) => line.accountId);
      const accounts = await prisma.account.findMany({
        where: {
          id: { in: accountIds },
          companyId: auth.companyId,
          isActive: true,
          isSystem: true, // Only system accounts are allowed
        },
      });

      if (accounts.length !== accountIds.length) {
        return NextResponse.json(
          {
            ok: false,
            error: 'One or more accounts not found, inactive, or are not system accounts',
          },
          { status: 400 }
        );
      }
    }

    // Validate project if provided
    if (validatedData.projectId !== undefined && validatedData.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: validatedData.projectId },
      });

      if (!project || project.companyId !== auth.companyId) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Project not found or does not belong to your company',
          },
          { status: 400 }
        );
      }
    }

    // Ensure office expenses don't have projectId
    if (validatedData.expenseType === 'OFFICE_EXPENSE' && validatedData.projectId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Office expenses cannot have a project assigned',
        },
        { status: 400 }
      );
    }

    const before = { ...voucher };

    // Update voucher in transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update voucher header
      const updatedVoucher = await tx.voucher.update({
        where: { id: params.id },
        data: {
          ...(validatedData.date && { date: validatedData.date }),
          ...(validatedData.narration !== undefined && { narration: validatedData.narration || null }),
          ...(validatedData.expenseType !== undefined && { expenseType: validatedData.expenseType || null }),
          ...(validatedData.projectId !== undefined && {
            projectId: validatedData.expenseType === 'OFFICE_EXPENSE' ? null : (validatedData.projectId || null),
          }),
        },
      });

      // If lines are provided, replace all lines
      if (validatedData.lines) {
        // Delete existing lines
        await tx.voucherLine.deleteMany({
          where: { voucherId: params.id },
        });

        // Create new lines
        const expenseType = validatedData.expenseType ?? updatedVoucher.expenseType;
        const voucherProjectId = expenseType === 'OFFICE_EXPENSE' ? null : (updatedVoucher.projectId || null);
        
        await tx.voucherLine.createMany({
          data: validatedData.lines.map((line) => {
            // Determine projectId: use line.projectId if set, otherwise fall back to voucher.projectId
            // Exception: if isCompanyLevel is true or expenseType is OFFICE_EXPENSE, projectId should be null
            const lineProjectId = expenseType === 'OFFICE_EXPENSE' 
              ? null 
              : (line.isCompanyLevel ? null : (line.projectId || voucherProjectId));
            
            return {
              voucherId: params.id,
              companyId: auth.companyId,
              accountId: line.accountId,
              description: line.description || null,
              debit: line.debit,
              credit: line.credit,
              projectId: lineProjectId,
              isCompanyLevel: expenseType === 'OFFICE_EXPENSE' ? false : (line.isCompanyLevel || false),
              vendorId: line.vendorId || null,
              paymentMethodId: line.paymentMethodId || null,
              // PDF fields
              workDetails: line.workDetails || null,
              paidBy: line.paidBy || null,
              receivedBy: line.receivedBy || null,
              fileRef: line.fileRef || null,
              voucherRef: line.voucherRef || null,
            };
          }),
        });
      }

      // Fetch updated voucher with lines
      return await tx.voucher.findUnique({
        where: { id: params.id },
        include: {
          project: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          lines: {
            include: {
              account: {
                select: { id: true, code: true, name: true },
              },
            },
          },
        },
      });
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'VOUCHER',
      entityId: updated!.id,
      action: 'UPDATE',
      before,
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
 * DELETE /api/vouchers/[id]
 * Delete draft voucher (only DRAFT vouchers can be deleted)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    const voucher = await prisma.voucher.findUnique({
      where: { id: params.id },
      include: {
        lines: true,
      },
    });

    if (!voucher || voucher.companyId !== auth.companyId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Voucher not found',
        },
        { status: 404 }
      );
    }

    // Only DRAFT vouchers can be deleted
    if (voucher.status !== 'DRAFT') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Only DRAFT vouchers can be deleted.',
        },
        { status: 400 }
      );
    }

    const before = { ...voucher };

    // Delete children first, then parent
    await prisma.voucherLine.deleteMany({
      where: { voucherId: params.id },
    });
    await prisma.voucher.delete({
      where: { id: params.id },
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'VOUCHER',
      entityId: params.id,
      action: 'DELETE',
      before,
      request,
    });

    return NextResponse.json({
      ok: true,
      message: 'Voucher deleted successfully',
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
