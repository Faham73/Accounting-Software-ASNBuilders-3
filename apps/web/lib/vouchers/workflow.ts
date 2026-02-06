import { prisma } from '@accounting/db';
import { VoucherStatus, UserRole } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';
import { createDiff, createAuditSnapshot } from '@/lib/audit/diff';
import { validateVoucherBalance, isLeafAccount, generateVoucherNumber } from '@/lib/voucher';
import { syncPurchaseStatusWithVoucher } from '@/lib/purchases/purchaseAccounting.server';
import { NextRequest } from 'next/server';

export interface WorkflowResult {
  success: boolean;
  voucher?: any;
  error?: string;
}

/**
 * Validate status transition
 */
function isValidTransition(currentStatus: VoucherStatus, newStatus: VoucherStatus): boolean {
  const validTransitions: Record<VoucherStatus, VoucherStatus[]> = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['APPROVED', 'DRAFT'], // Allow rejection back to DRAFT
    APPROVED: ['POSTED'],
    POSTED: ['REVERSED'],
    REVERSED: [], // Terminal state
  };

  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Check if user can perform workflow action
 */
function canPerformAction(
  role: UserRole,
  action: 'SUBMIT' | 'APPROVE' | 'POST' | 'REVERSE',
  voucher: any,
  userId: string
): { allowed: boolean; reason?: string } {
  switch (action) {
    case 'SUBMIT':
      // Creator or any authenticated user can submit
      // Allow any authenticated user to submit (can be restricted further if needed)
      return { allowed: true };

    case 'APPROVE':
      // Only ADMIN/ACCOUNTANT can approve
      if (role !== 'ADMIN' && role !== 'ACCOUNTANT') {
        return { allowed: false, reason: 'Only ADMIN or ACCOUNTANT can approve vouchers' };
      }
      return { allowed: true };

    case 'POST':
      // Only ADMIN/ACCOUNTANT can post
      if (role !== 'ADMIN' && role !== 'ACCOUNTANT') {
        return { allowed: false, reason: 'Only ADMIN or ACCOUNTANT can post vouchers' };
      }
      return { allowed: true };

    case 'REVERSE':
      // Only ADMIN/ACCOUNTANT can reverse
      if (role !== 'ADMIN' && role !== 'ACCOUNTANT') {
        return { allowed: false, reason: 'Only ADMIN or ACCOUNTANT can reverse vouchers' };
      }
      return { allowed: true };

    default:
      return { allowed: false, reason: 'Unknown action' };
  }
}

/**
 * Submit a voucher (DRAFT → SUBMITTED)
 */
export async function submitVoucher(
  voucherId: string,
  userId: string,
  companyId: string,
  role: UserRole,
  request?: NextRequest
): Promise<WorkflowResult> {
  return await prisma.$transaction(async (tx) => {
    const voucher = await tx.voucher.findUnique({
      where: { id: voucherId },
      include: {
        lines: {
          include: { account: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!voucher || voucher.companyId !== companyId) {
      return { success: false, error: 'Voucher not found' };
    }

    // Validate transition
    if (!isValidTransition(voucher.status, 'SUBMITTED')) {
      return {
        success: false,
        error: `Cannot submit voucher with status ${voucher.status}. Only DRAFT vouchers can be submitted.`,
      };
    }

    // Check permissions
    const permissionCheck = canPerformAction(role, 'SUBMIT', voucher, userId);
    if (!permissionCheck.allowed) {
      return { success: false, error: permissionCheck.reason };
    }

    // Validate balance
    const balanceCheck = validateVoucherBalance(
      voucher.lines.map((line) => ({
        debit: Number(line.debit),
        credit: Number(line.credit),
      }))
    );
    if (!balanceCheck.valid) {
      return { success: false, error: balanceCheck.error };
    }

    const before = createAuditSnapshot(voucher);

    // Update voucher
    const updated = await tx.voucher.update({
      where: { id: voucherId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedById: userId,
      },
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
        lines: {
          include: { account: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    const after = createAuditSnapshot(updated);
    const diff = createDiff(before, after);

    // Create audit log
    await createAuditLog({
      companyId,
      actorUserId: userId,
      entityType: 'VOUCHER',
      entityId: voucherId,
      action: 'STATUS_CHANGE',
      before,
      after,
      diffJson: diff,
      request,
    });

    // Sync purchase status if voucher is linked to a purchase
    await syncPurchaseStatusWithVoucher(voucherId, companyId);

    return { success: true, voucher: updated };
  });
}

/**
 * Approve a voucher (SUBMITTED → APPROVED)
 */
export async function approveVoucher(
  voucherId: string,
  userId: string,
  companyId: string,
  role: UserRole,
  request?: NextRequest
): Promise<WorkflowResult> {
  return await prisma.$transaction(async (tx) => {
    const voucher = await tx.voucher.findUnique({
      where: { id: voucherId },
      include: {
        lines: {
          include: { account: true },
        },
      },
    });

    if (!voucher || voucher.companyId !== companyId) {
      return { success: false, error: 'Voucher not found' };
    }

    // Validate transition
    if (!isValidTransition(voucher.status, 'APPROVED')) {
      return {
        success: false,
        error: `Cannot approve voucher with status ${voucher.status}. Only SUBMITTED vouchers can be approved.`,
      };
    }

    // Check permissions
    const permissionCheck = canPerformAction(role, 'APPROVE', voucher, userId);
    if (!permissionCheck.allowed) {
      return { success: false, error: permissionCheck.reason };
    }

    const before = createAuditSnapshot(voucher);

    // Update voucher
    const updated = await tx.voucher.update({
      where: { id: voucherId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: userId,
      },
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        lines: {
          include: { account: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    const after = createAuditSnapshot(updated);
    const diff = createDiff(before, after);

    // Create audit log
    await createAuditLog({
      companyId,
      actorUserId: userId,
      entityType: 'VOUCHER',
      entityId: voucherId,
      action: 'STATUS_CHANGE',
      before,
      after,
      diffJson: diff,
      request,
    });

    // Sync purchase status if voucher is linked to a purchase
    await syncPurchaseStatusWithVoucher(voucherId, companyId);

    return { success: true, voucher: updated };
  });
}

/**
 * Post a voucher (APPROVED → POSTED)
 */
export async function postVoucher(
  voucherId: string,
  userId: string,
  companyId: string,
  role: UserRole,
  request?: NextRequest
): Promise<WorkflowResult> {
  return await prisma.$transaction(async (tx) => {
    const voucher = await tx.voucher.findUnique({
      where: { id: voucherId },
      include: {
        lines: {
          include: { account: true },
        },
      },
    });

    if (!voucher || voucher.companyId !== companyId) {
      return { success: false, error: 'Voucher not found' };
    }

    // Validate transition
    if (!isValidTransition(voucher.status, 'POSTED')) {
      return {
        success: false,
        error: `Cannot post voucher with status ${voucher.status}. Only APPROVED vouchers can be posted.`,
      };
    }

    // Check permissions
    const permissionCheck = canPerformAction(role, 'POST', voucher, userId);
    if (!permissionCheck.allowed) {
      return { success: false, error: permissionCheck.reason };
    }

    // Validate balance
    const balanceCheck = validateVoucherBalance(
      voucher.lines.map((line) => ({
        debit: Number(line.debit),
        credit: Number(line.credit),
      }))
    );
    if (!balanceCheck.valid) {
      return { success: false, error: balanceCheck.error };
    }

    // Validate all accounts are active
    const inactiveAccounts = voucher.lines.filter((line) => !line.account.isActive);
    if (inactiveAccounts.length > 0) {
      return {
        success: false,
        error: 'Cannot post voucher with inactive accounts',
      };
    }

    // Validate all accounts are leaf accounts
    for (const line of voucher.lines) {
      const isLeaf = await isLeafAccount(line.accountId);
      if (!isLeaf) {
        return {
          success: false,
          error: `Account ${line.account.code} (${line.account.name}) is not a leaf account and cannot be used in voucher lines`,
        };
      }
    }

    const before = createAuditSnapshot(voucher);

    // Update voucher
    const updated = await tx.voucher.update({
      where: { id: voucherId },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        postedByUserId: userId,
      },
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        postedBy: { select: { id: true, name: true, email: true } },
        lines: {
          include: { account: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    const after = createAuditSnapshot(updated);
    const diff = createDiff(before, after);

    // Create audit log
    await createAuditLog({
      companyId,
      actorUserId: userId,
      entityType: 'VOUCHER',
      entityId: voucherId,
      action: 'POST',
      before,
      after,
      diffJson: diff,
      request,
    });

    // Sync purchase status if voucher is linked to a purchase
    await syncPurchaseStatusWithVoucher(voucherId, companyId);

    return { success: true, voucher: updated };
  });
}

/**
 * Reverse a voucher (POSTED → REVERSED, creates new reversal voucher)
 */
export async function reverseVoucher(
  voucherId: string,
  userId: string,
  companyId: string,
  role: UserRole,
  options?: {
    date?: Date;
    description?: string;
  },
  request?: NextRequest
): Promise<WorkflowResult> {
  return await prisma.$transaction(async (tx) => {
    const originalVoucher = await tx.voucher.findUnique({
      where: { id: voucherId },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true, isActive: true } },
            project: { select: { id: true } },
            vendor: { select: { id: true } },
            paymentMethod: { select: { id: true } },
          },
        },
        project: { select: { id: true } },
      },
    });

    if (!originalVoucher || originalVoucher.companyId !== companyId) {
      return { success: false, error: 'Voucher not found' };
    }

    // Only POSTED vouchers can be reversed
    if (originalVoucher.status !== 'POSTED') {
      return {
        success: false,
        error: `Cannot reverse voucher with status ${originalVoucher.status}. Only POSTED vouchers can be reversed.`,
      };
    }

    // Check if already reversed
    const existingReversal = await tx.voucher.findFirst({
      where: {
        reversalOfId: voucherId,
        companyId,
      },
    });

    if (existingReversal) {
      return {
        success: false,
        error: 'This voucher has already been reversed',
      };
    }

    // Check permissions
    const permissionCheck = canPerformAction(role, 'REVERSE', originalVoucher, userId);
    if (!permissionCheck.allowed) {
      return { success: false, error: permissionCheck.reason };
    }

    const reversalDate = options?.date || new Date();
    const reversalDescription =
      options?.description || `Reversal of ${originalVoucher.voucherNo}`;

    // Generate reversal voucher number
    const reversalVoucherNo = await generateVoucherNumber(companyId, reversalDate);

    const before = createAuditSnapshot(originalVoucher);

    // Create reversal voucher with negated lines
    const reversalVoucher = await tx.voucher.create({
      data: {
        companyId,
        voucherNo: reversalVoucherNo,
        type: originalVoucher.type,
        expenseType: originalVoucher.expenseType,
        date: reversalDate,
        narration: reversalDescription,
        status: 'POSTED', // Reversal is posted immediately
        projectId: originalVoucher.projectId,
        createdByUserId: userId,
        postedByUserId: userId,
        postedAt: new Date(),
        reversalOfId: voucherId,
        reversedById: userId,
        reversedAt: new Date(),
        lines: {
          create: originalVoucher.lines.map((line) => ({
            companyId,
            accountId: line.accountId,
            description: line.description,
            // Swap debit and credit (negate)
            debit: line.credit,
            credit: line.debit,
            projectId: line.projectId,
            vendorId: line.vendorId,
            paymentMethodId: line.paymentMethodId,
          })),
        },
      },
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        postedBy: { select: { id: true, name: true, email: true } },
        originalVoucher: {
          select: { id: true, voucherNo: true },
        },
        lines: {
          include: { account: { select: { id: true, code: true, name: true } } },
        },
      },
    });

    // Update original voucher to REVERSED status
    const updatedOriginal = await tx.voucher.update({
      where: { id: voucherId },
      data: {
        status: 'REVERSED',
        reversedAt: new Date(),
        reversedById: userId,
      },
      include: {
        reversalVouchers: {
          select: { id: true, voucherNo: true, date: true },
        },
      },
    });

    const after = createAuditSnapshot(updatedOriginal);
    const diff = createDiff(before, after);

    // Create audit log for original voucher
    await createAuditLog({
      companyId,
      actorUserId: userId,
      entityType: 'VOUCHER',
      entityId: voucherId,
      action: 'REVERSE',
      before,
      after,
      diffJson: diff,
      request,
    });

    // Create audit log for reversal voucher creation
    await createAuditLog({
      companyId,
      actorUserId: userId,
      entityType: 'VOUCHER',
      entityId: reversalVoucher.id,
      action: 'CREATE',
      before: null,
      after: createAuditSnapshot(reversalVoucher),
      request,
    });

    // Sync purchase status if original voucher is linked to a purchase
    await syncPurchaseStatusWithVoucher(voucherId, companyId);

    return {
      success: true,
      voucher: {
        ...reversalVoucher,
        originalVoucher: updatedOriginal,
      },
    };
  });
}
