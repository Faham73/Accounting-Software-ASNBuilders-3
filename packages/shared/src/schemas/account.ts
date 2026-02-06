import { z } from 'zod';

/**
 * Account type enum values
 */
export const AccountTypeEnum = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']);

/**
 * Schema for creating an account
 */
export const AccountCreateSchema = z.object({
  code: z.string().min(1, 'Account code is required'),
  name: z.string().min(1, 'Account name is required'),
  type: AccountTypeEnum,
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Schema for updating an account
 */
export const AccountUpdateSchema = z.object({
  code: z.string().min(1, 'Account code is required').optional(),
  name: z.string().min(1, 'Account name is required').optional(),
  type: AccountTypeEnum.optional(),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for filtering accounts list
 */
export const AccountListFiltersSchema = z.object({
  q: z.string().optional(),
  type: AccountTypeEnum.optional(),
  active: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
  expenseCategoryId: z.string().optional(),
});

// Inferred TypeScript types
export type AccountCreate = z.infer<typeof AccountCreateSchema>;
export type AccountUpdate = z.infer<typeof AccountUpdateSchema>;
export type AccountListFilters = z.infer<typeof AccountListFiltersSchema>;
export type AccountType = z.infer<typeof AccountTypeEnum>;
