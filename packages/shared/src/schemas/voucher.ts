import { z } from 'zod';

/**
 * Voucher status enum values
 */
export const VoucherStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED']);

/**
 * Schema for creating a voucher line
 */
export const VoucherLineCreateSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  description: z.string().optional().nullable(),
  debit: z.number().nonnegative('Debit must be non-negative').default(0),
  credit: z.number().nonnegative('Credit must be non-negative').default(0),
  projectId: z.string().optional().nullable(),
  isCompanyLevel: z.boolean().optional().default(false),
  vendorId: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  // PDF fields
  workDetails: z.string().optional().nullable(),
  paidBy: z.string().optional().nullable(),
  receivedBy: z.string().optional().nullable(),
  fileRef: z.string().optional().nullable(),
  voucherRef: z.string().optional().nullable(),
}).refine(
  (data) => data.debit > 0 || data.credit > 0,
  { message: 'Either debit or credit must be greater than 0' }
).refine(
  (data) => !(data.debit > 0 && data.credit > 0),
  { message: 'A line cannot have both debit and credit' }
).refine(
  (data) => {
    // If isCompanyLevel is true, projectId must be null
    if (data.isCompanyLevel && data.projectId) {
      return false;
    }
    return true;
  },
  { message: 'Company-level credits cannot have a project assigned' }
);

/**
 * Expense type enum values
 */
export const ExpenseTypeEnum = z.enum(['PROJECT_EXPENSE', 'OFFICE_EXPENSE']);

/**
 * Schema for creating a voucher
 */
export const VoucherCreateSchema = z.object({
  date: z.coerce.date(),
  narration: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  expenseType: ExpenseTypeEnum.optional().nullable(),
  lines: z.array(VoucherLineCreateSchema).min(2, 'At least 2 voucher lines are required'),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);
    return Math.abs(totalDebit - totalCredit) < 0.01; // Allow small tolerance for floating point
  },
  { message: 'Total debit must equal total credit' }
).refine(
  (data) => {
    // If expenseType is OFFICE_EXPENSE, projectId must be null
    if (data.expenseType === 'OFFICE_EXPENSE' && data.projectId) {
      return false;
    }
    // If expenseType is PROJECT_EXPENSE, projectId should be provided (but allow null for backward compatibility)
    return true;
  },
  { message: 'Office expenses cannot have a project assigned' }
);

/**
 * Schema for updating a voucher
 */
export const VoucherUpdateSchema = z.object({
  date: z.coerce.date().optional(),
  narration: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  expenseType: ExpenseTypeEnum.optional().nullable(),
  lines: z.array(VoucherLineCreateSchema).min(2, 'At least 2 voucher lines are required').optional(),
}).refine(
  (data) => {
    if (!data.lines) return true;
    const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: 'Total debit must equal total credit' }
).refine(
  (data) => {
    // If expenseType is OFFICE_EXPENSE, projectId must be null
    if (data.expenseType === 'OFFICE_EXPENSE' && data.projectId) {
      return false;
    }
    return true;
  },
  { message: 'Office expenses cannot have a project assigned' }
);

/**
 * Schema for updating a voucher line
 */
export const VoucherLineUpdateSchema = z.object({
  accountId: z.string().min(1, 'Account is required').optional(),
  description: z.string().optional().nullable(),
  debit: z.number().nonnegative('Debit must be non-negative').optional(),
  credit: z.number().nonnegative('Credit must be non-negative').optional(),
  projectId: z.string().optional().nullable(),
  isCompanyLevel: z.boolean().optional(),
  vendorId: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  // PDF fields
  workDetails: z.string().optional().nullable(),
  paidBy: z.string().optional().nullable(),
  receivedBy: z.string().optional().nullable(),
  fileRef: z.string().optional().nullable(),
  voucherRef: z.string().optional().nullable(),
}).refine(
  (data) => {
    // If both debit and credit are provided, ensure only one is > 0
    if (data.debit !== undefined && data.credit !== undefined) {
      return !(data.debit > 0 && data.credit > 0);
    }
    return true;
  },
  { message: 'A line cannot have both debit and credit' }
).refine(
  (data) => {
    // If isCompanyLevel is true, projectId must be null
    if (data.isCompanyLevel && data.projectId) {
      return false;
    }
    return true;
  },
  { message: 'Company-level credits cannot have a project assigned' }
);

/**
 * Schema for filtering vouchers list
 */
export const VoucherListFiltersSchema = z.object({
  status: VoucherStatusEnum.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  projectId: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// Inferred TypeScript types
export type VoucherLineCreate = z.infer<typeof VoucherLineCreateSchema>;
export type VoucherLineUpdate = z.infer<typeof VoucherLineUpdateSchema>;
export type VoucherCreate = z.infer<typeof VoucherCreateSchema>;
export type VoucherUpdate = z.infer<typeof VoucherUpdateSchema>;
export type VoucherListFilters = z.infer<typeof VoucherListFiltersSchema>;
export type VoucherStatus = z.infer<typeof VoucherStatusEnum>;
export type ExpenseType = z.infer<typeof ExpenseTypeEnum>;
