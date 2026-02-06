import { z } from 'zod';

export const ExpenseSourceEnum = z.enum(['WAREHOUSE', 'LABOR']);

/**
 * Schema for creating an expense
 */
export const ExpenseCreateSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  date: z.union([z.string(), z.date()]).transform((val) => (val instanceof Date ? val : new Date(val))),
  categoryId: z.string().min(1, 'Category is required'),
  source: ExpenseSourceEnum,
  amount: z.number().positive('Amount must be greater than 0'),
  paidTo: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  paymentMethodId: z.string().min(1, 'Payment method is required'),
  debitAccountId: z.string().min(1, 'Debit account (expense account) is required'),
  creditAccountId: z.string().min(1, 'Credit account (payment account) is required'),
  notes: z.string().optional().nullable(),
});

/**
 * Schema for updating an expense
 */
export const ExpenseUpdateSchema = z.object({
  projectId: z.string().min(1, 'Project is required').optional(),
  date: z.union([z.string(), z.date()]).transform((val) => (val instanceof Date ? val : new Date(val))).optional(),
  categoryId: z.string().min(1, 'Category is required').optional(),
  source: ExpenseSourceEnum.optional(),
  amount: z.number().positive('Amount must be greater than 0').optional(),
  paidTo: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  paymentMethodId: z.string().min(1, 'Payment method is required').optional(),
  debitAccountId: z.string().min(1, 'Debit account is required').optional(),
  creditAccountId: z.string().min(1, 'Credit account is required').optional(),
  notes: z.string().optional().nullable(),
});

/**
 * Schema for filtering expenses list
 */
export const ExpenseListFiltersSchema = z.object({
  mainProjectId: z.string().optional(),
  projectId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  categoryId: z.string().optional(),
  source: ExpenseSourceEnum.optional(),
  q: z.string().optional(), // search in paidTo/notes
});

// Inferred TypeScript types
export type ExpenseSource = z.infer<typeof ExpenseSourceEnum>;
export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>;
export type ExpenseUpdate = z.infer<typeof ExpenseUpdateSchema>;
export type ExpenseListFilters = z.infer<typeof ExpenseListFiltersSchema>;
