import { prisma } from '@accounting/db';
import { Decimal } from '@prisma/client/runtime/library';

export interface VoucherLineInput {
  debit: number;
  credit: number;
}

/**
 * Validate that total debit equals total credit (with tolerance for floating point)
 */
export function validateVoucherBalance(lines: VoucherLineInput[]): { valid: boolean; error?: string } {
  if (lines.length < 2) {
    return { valid: false, error: 'At least 2 voucher lines are required' };
  }

  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
  const difference = Math.abs(totalDebit - totalCredit);

  if (difference >= 0.01) {
    return {
      valid: false,
      error: `Voucher is not balanced. Debit: ${totalDebit.toFixed(2)}, Credit: ${totalCredit.toFixed(2)}, Difference: ${difference.toFixed(2)}`,
    };
  }

  return { valid: true };
}

/**
 * Generate unique voucher number in format: V-YYYY-NNNNNN
 * Example: V-2026-000001
 */
export async function generateVoucherNumber(companyId: string, date: Date): Promise<string> {
  const year = date.getFullYear();
  const prefix = `V-${year}-`;

  // Find the highest voucher number for this company and year
  const lastVoucher = await prisma.voucher.findFirst({
    where: {
      companyId,
      voucherNo: {
        startsWith: prefix,
      },
    },
    orderBy: {
      voucherNo: 'desc',
    },
  });

  let nextNumber = 1;
  if (lastVoucher) {
    // Extract the number part (e.g., "000001" from "V-2026-000001")
    const match = lastVoucher.voucherNo.match(/-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  // Format with leading zeros (6 digits)
  const numberPart = nextNumber.toString().padStart(6, '0');
  return `${prefix}${numberPart}`;
}

/**
 * Check if a voucher can be edited (only DRAFT vouchers can be edited)
 */
export function canEditVoucher(status: string): boolean {
  return status === 'DRAFT';
}

/**
 * Check if an account is a leaf (has no children)
 */
export async function isLeafAccount(accountId: string): Promise<boolean> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { children: true },
  });

  if (!account) {
    return false;
  }

  return account.children.length === 0;
}
