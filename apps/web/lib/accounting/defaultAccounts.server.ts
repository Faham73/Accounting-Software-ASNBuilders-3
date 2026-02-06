/**
 * Default Account Helpers
 * 
 * Finds default accounts (Cash, Bank, Owner Capital) for a company.
 * Uses account codes first, then falls back to name matching.
 */

import { prisma } from '@accounting/db';
import { AccountType } from '@prisma/client';
import { SYSTEM_ACCOUNT_CODES } from '../systemAccounts';

/**
 * Get default Cash account for a company
 * Tries code 1010 first, then falls back to name contains "Cash" with type ASSET
 * 
 * @param companyId - The company ID
 * @returns Promise resolving to the account ID
 * @throws Error if account not found
 */
export async function getDefaultCashAccount(companyId: string): Promise<string> {
  // Try by exact code first (1010)
  const accountByCode = await prisma.account.findUnique({
    where: {
      companyId_code: {
        companyId,
        code: SYSTEM_ACCOUNT_CODES.CASH,
      },
    },
    select: { id: true },
  });

  if (accountByCode) {
    return accountByCode.id;
  }

  // Fallback: find by name contains "Cash" and type ASSET
  const accountByName = await prisma.account.findFirst({
    where: {
      companyId,
      name: {
        contains: 'Cash',
        mode: 'insensitive',
      },
      type: AccountType.ASSET,
      isActive: true,
    },
    select: { id: true },
  });

  if (accountByName) {
    return accountByName.id;
  }

  throw new Error(
    'Default Cash account not found. Create an ASSET account named Cash (code 1010 recommended).'
  );
}

/**
 * Get default Bank account for a company
 * Tries code 1020 first, then falls back to name contains "Bank" with type ASSET
 * 
 * @param companyId - The company ID
 * @returns Promise resolving to the account ID
 * @throws Error if account not found
 */
export async function getDefaultBankAccount(companyId: string): Promise<string> {
  // Try by exact code first (1020)
  const accountByCode = await prisma.account.findUnique({
    where: {
      companyId_code: {
        companyId,
        code: SYSTEM_ACCOUNT_CODES.BANK,
      },
    },
    select: { id: true },
  });

  if (accountByCode) {
    return accountByCode.id;
  }

  // Fallback: find by name contains "Bank" and type ASSET
  const accountByName = await prisma.account.findFirst({
    where: {
      companyId,
      name: {
        contains: 'Bank',
        mode: 'insensitive',
      },
      type: AccountType.ASSET,
      isActive: true,
    },
    select: { id: true },
  });

  if (accountByName) {
    return accountByName.id;
  }

  throw new Error(
    'Default Bank account not found. Create an ASSET account named Bank (code 1020 recommended).'
  );
}

/**
 * Get Owner Capital account for a company
 * Tries codes 3010 (Owner Equity) or 3020 (Capital) first,
 * then falls back to name contains "Owner Capital" or "Capital" with type EQUITY
 * 
 * @param companyId - The company ID
 * @returns Promise resolving to the account ID
 * @throws Error if account not found
 */
export async function getOwnerCapitalAccount(companyId: string): Promise<string> {
  // Try by exact codes first (3010 or 3020)
  const accountByCode3010 = await prisma.account.findUnique({
    where: {
      companyId_code: {
        companyId,
        code: SYSTEM_ACCOUNT_CODES.OWNER_EQUITY,
      },
    },
    select: { id: true },
  });

  if (accountByCode3010) {
    return accountByCode3010.id;
  }

  const accountByCode3020 = await prisma.account.findUnique({
    where: {
      companyId_code: {
        companyId,
        code: SYSTEM_ACCOUNT_CODES.CAPITAL,
      },
    },
    select: { id: true },
  });

  if (accountByCode3020) {
    return accountByCode3020.id;
  }

  // Fallback: find by name contains "Owner Capital" or "Capital" and type EQUITY
  const accountByName = await prisma.account.findFirst({
    where: {
      companyId,
      OR: [
        {
          name: {
            contains: 'Owner Capital',
            mode: 'insensitive',
          },
        },
        {
          name: {
            contains: 'Capital',
            mode: 'insensitive',
          },
        },
      ],
      type: AccountType.EQUITY,
      isActive: true,
    },
    select: { id: true },
  });

  if (accountByName) {
    return accountByName.id;
  }

  throw new Error(
    'Owner Capital account not found. Create an EQUITY account named "Owner Capital" or "Capital" (code 3010 or 3020 recommended).'
  );
}
