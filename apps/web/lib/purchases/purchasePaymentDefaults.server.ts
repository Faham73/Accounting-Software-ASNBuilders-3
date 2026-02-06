/**
 * Server-only: default payment accounts for purchases (CASH -> 1010, BANK -> 1020).
 * DO NOT import in client components.
 */

import { prisma } from '@accounting/db';
import { isLeafAccount } from '@/lib/voucher';
import { SYSTEM_ACCOUNT_CODES } from '@/lib/systemAccounts';

/**
 * Get default Cash account id for the company (code 1010).
 * Must be active, system, and leaf.
 */
export async function getDefaultCashAccountId(companyId: string): Promise<{ id: string } | null> {
  const account = await prisma.account.findFirst({
    where: {
      companyId,
      code: SYSTEM_ACCOUNT_CODES.CASH,
      isActive: true,
      isSystem: true,
    },
    select: { id: true },
  });
  if (!account) return null;
  const leaf = await isLeafAccount(account.id);
  if (!leaf) return null;
  return account;
}

/**
 * Get default Bank account id for the company (code 1020).
 * Must be active, system, and leaf.
 */
export async function getDefaultBankAccountId(companyId: string): Promise<{ id: string } | null> {
  const account = await prisma.account.findFirst({
    where: {
      companyId,
      code: SYSTEM_ACCOUNT_CODES.BANK,
      isActive: true,
      isSystem: true,
    },
    select: { id: true },
  });
  if (!account) return null;
  const leaf = await isLeafAccount(account.id);
  if (!leaf) return null;
  return account;
}

export type PaymentMethodType = 'CASH' | 'BANK';

/**
 * Resolve paymentAccountId from paymentMethod. Returns error message if default account not found or not leaf.
 */
export async function resolvePaymentAccountId(
  companyId: string,
  paymentMethod: PaymentMethodType
): Promise<{ paymentAccountId: string } | { error: string }> {
  if (paymentMethod === 'CASH') {
    const cash = await getDefaultCashAccountId(companyId);
    if (!cash) {
      return {
        error: 'Default CASH account not found. Please create account code 1010 (Cash) and ensure it is a leaf account.',
      };
    }
    return { paymentAccountId: cash.id };
  }
  if (paymentMethod === 'BANK') {
    const bank = await getDefaultBankAccountId(companyId);
    if (!bank) {
      return {
        error: 'Default BANK account not found. Please create account code 1020 (Bank) and ensure it is a leaf account.',
      };
    }
    return { paymentAccountId: bank.id };
  }
  return { error: 'Invalid payment method' };
}
