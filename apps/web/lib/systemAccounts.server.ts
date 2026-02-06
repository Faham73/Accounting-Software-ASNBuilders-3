/**
 * Server-side service for ensuring system accounts exist
 * 
 * This service auto-creates and maintains system accounts for each company.
 * Run this on app startup or first company access.
 */

import { prisma } from '@accounting/db';
import { SYSTEM_ACCOUNTS, SystemAccountDefinition } from './systemAccounts';

/**
 * Ensure all system accounts exist for a company
 * Idempotent: safe to re-run. Uses upserts.
 * 
 * @param companyId - The company ID to ensure accounts for
 * @returns Promise resolving to a map of account codes to account IDs
 */
export async function ensureSystemAccounts(
  companyId: string
): Promise<Record<string, string>> {
  const accountIdMap: Record<string, string> = {};

  // First, create parent accounts if needed (for hierarchy support)
  // For now, we'll create flat accounts, but this can be extended

  // Create or update each system account
  for (const accountDef of SYSTEM_ACCOUNTS) {
    const account = await prisma.account.upsert({
      where: {
        companyId_code: {
          companyId,
          code: accountDef.code,
        },
      },
      update: {
        // Update name and type if they changed (but keep isSystem=true and locked=true)
        name: accountDef.name,
        type: accountDef.type,
        isSystem: true,
        locked: true,
        isActive: true,
      },
      create: {
        companyId,
        code: accountDef.code,
        name: accountDef.name,
        type: accountDef.type,
        parentId: null, // Can be extended to support hierarchy
        isSystem: true,
        locked: true,
        isActive: true,
      },
    });

    accountIdMap[accountDef.code] = account.id;
  }

  return accountIdMap;
}

/**
 * Ensure system accounts for all companies
 * Useful for migration or bulk setup
 */
export async function ensureSystemAccountsForAllCompanies(): Promise<void> {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const company of companies) {
    await ensureSystemAccounts(company.id);
  }
}

/**
 * Get system account ID by code for a company
 * Returns null if account doesn't exist (should not happen if ensureSystemAccounts was run)
 */
export async function getSystemAccountId(
  companyId: string,
  code: string
): Promise<string | null> {
  const account = await prisma.account.findUnique({
    where: {
      companyId_code: {
        companyId,
        code,
      },
    },
    select: { id: true },
  });

  return account?.id || null;
}
