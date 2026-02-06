import { z } from 'zod';

/**
 * Schema for creating a credit entry
 */
export const CreditCreateSchema = z.object({
  projectId: z.string().min(1, 'Project is required').nullable().optional(),
  projectSnapshotName: z.string().min(1, 'Project name is required'),
  date: z.coerce.date(),
  purpose: z.string().min(1, 'Purpose is required'),
  paidBy: z.string().min(1, 'Paid By is required'),
  receivedBy: z.string().min(1, 'Received By is required'),
  paymentMethod: z.enum(['Cash', 'Check', 'Bank Transfer', 'Bkash', 'Other'], {
    errorMap: () => ({ message: 'Payment method is required' }),
  }),
  paymentRef: z.string().optional().nullable(),
  paymentAccountId: z.string().optional().nullable(),
  amount: z.number().positive('Amount must be positive'),
  note: z.string().optional().nullable(),
});

/**
 * Schema for updating a credit entry
 */
export const CreditUpdateSchema = z.object({
  projectId: z.string().min(1, 'Project is required').nullable().optional(),
  projectSnapshotName: z.string().min(1, 'Project name is required').optional(),
  date: z.coerce.date().optional(),
  purpose: z.string().min(1, 'Purpose is required').optional(),
  paidBy: z.string().min(1, 'Paid By is required').optional(),
  receivedBy: z.string().min(1, 'Received By is required').optional(),
  paymentMethod: z.enum(['Cash', 'Check', 'Bank Transfer', 'Bkash', 'Other']).optional(),
  paymentRef: z.string().optional().nullable(),
  paymentAccountId: z.string().optional().nullable(),
  amount: z.number().positive('Amount must be positive').optional(),
  note: z.string().optional().nullable(),
});

/**
 * Schema for filtering credits list
 */
export const CreditListFiltersSchema = z.object({
  projectId: z.string().optional(),
  companyLevelOnly: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
});

// Inferred TypeScript types
export type CreditCreate = z.infer<typeof CreditCreateSchema>;
export type CreditUpdate = z.infer<typeof CreditUpdateSchema>;
export type CreditListFilters = z.infer<typeof CreditListFiltersSchema>;
