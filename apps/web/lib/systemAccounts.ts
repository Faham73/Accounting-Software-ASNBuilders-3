/**
 * System Account Registry
 * 
 * Defines the required system accounts that are auto-created and managed by the system.
 * These accounts are used internally for vouchers, purchases, expenses, and financial reports.
 * Users cannot create, edit, or delete system accounts.
 */

import { AccountType } from '@prisma/client';

export interface SystemAccountDefinition {
  code: string;
  name: string;
  type: AccountType;
  parentCode?: string; // Optional parent account code for hierarchy
}

/**
 * System accounts required for the accounting system to function.
 * These are auto-created for each company.
 */
export const SYSTEM_ACCOUNTS: SystemAccountDefinition[] = [
  // ASSET accounts
  { code: '1010', name: 'Cash', type: 'ASSET' },
  { code: '1020', name: 'Bank - Main Account', type: 'ASSET' },
  { code: '1030', name: 'Accounts Receivable', type: 'ASSET' },
  { code: '1040', name: 'Inventory', type: 'ASSET' },
  
  // LIABILITY accounts
  { code: '2010', name: 'Accounts Payable', type: 'LIABILITY' },
  
  // EQUITY accounts
  { code: '3010', name: 'Owner Equity', type: 'EQUITY' },
  { code: '3020', name: 'Capital', type: 'EQUITY' },
  
  // INCOME accounts (if needed for future revenue tracking)
  { code: '4010', name: 'Sales Revenue', type: 'INCOME' },
  
  // EXPENSE accounts
  { code: '5010', name: 'Direct Materials', type: 'EXPENSE' },
  { code: '5020', name: 'Direct Labor', type: 'EXPENSE' },
  { code: '5030', name: 'Site Overhead', type: 'EXPENSE' },
  { code: '5090', name: 'Miscellaneous Expenses', type: 'EXPENSE' },
];

/**
 * Get system account by code
 */
export function getSystemAccount(code: string): SystemAccountDefinition | undefined {
  return SYSTEM_ACCOUNTS.find((acc) => acc.code === code);
}

/**
 * Get all system account codes
 */
export function getSystemAccountCodes(): string[] {
  return SYSTEM_ACCOUNTS.map((acc) => acc.code);
}

/**
 * Account code constants for easy reference in code
 */
export const SYSTEM_ACCOUNT_CODES = {
  CASH: '1010',
  BANK: '1020',
  ACCOUNTS_RECEIVABLE: '1030',
  INVENTORY: '1040',
  ACCOUNTS_PAYABLE: '2010',
  OWNER_EQUITY: '3010',
  CAPITAL: '3020',
  SALES_REVENUE: '4010',
  DIRECT_MATERIALS: '5010',
  DIRECT_LABOR: '5020',
  SITE_OVERHEAD: '5030',
  MISC_EXPENSES: '5090',
} as const;
