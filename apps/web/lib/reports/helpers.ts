import { VoucherStatus } from '@accounting/db';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Check if a voucher is posted (includes POSTED and REVERSED statuses)
 * Both POSTED and REVERSED vouchers count in financial statements
 */
export function isPosted(status: VoucherStatus): boolean {
  return status === 'POSTED' || status === 'REVERSED';
}

/**
 * Get start and end dates for a month
 */
export function monthRange(date: Date): { from: Date; to: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

/**
 * Get date range from two dates
 */
export function dateRange(from: Date, to: Date): { from: Date; to: Date } {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return { from: start, to: end };
}

/**
 * Sum debit and credit from voucher lines
 */
export function sumDebitCredit(
  lines: Array<{ debit: Decimal | number; credit: Decimal | number }>
): { totalDebit: number; totalCredit: number } {
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    const debit = typeof line.debit === 'number' ? line.debit : Number(line.debit);
    const credit = typeof line.credit === 'number' ? line.credit : Number(line.credit);
    totalDebit += debit;
    totalCredit += credit;
  }

  return { totalDebit, totalCredit };
}

/**
 * Convert Decimal to number safely
 */
export function decimalToNumber(decimal: Decimal | number | string | null | undefined): number {
  if (!decimal) return 0;
  if (typeof decimal === 'number') return decimal;
  if (typeof decimal === 'string') return parseFloat(decimal) || 0;
  return Number(decimal);
}
