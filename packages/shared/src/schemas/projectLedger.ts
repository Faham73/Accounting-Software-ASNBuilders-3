import { z } from 'zod';

/**
 * Schema for project ledger query parameters
 */
export const ProjectLedgerFiltersSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  vendorId: z.string().optional(),
  category: z.enum(['CIVIL', 'MATERIALS', 'MATI_KATA', 'DHALAI', 'OTHERS']).optional(),
  paymentMethodId: z.string().optional(),
  accountId: z.string().optional(),
  type: z.enum(['ALL', 'DEBIT', 'CREDIT']).optional().default('ALL'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * Schema for project cost summary query parameters
 */
export const ProjectCostSummaryFiltersSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  vendorId: z.string().optional(),
  category: z.enum(['CIVIL', 'MATERIALS', 'MATI_KATA', 'DHALAI', 'OTHERS']).optional(),
  paymentMethodId: z.string().optional(),
});

// Inferred TypeScript types
export type ProjectLedgerFilters = z.infer<typeof ProjectLedgerFiltersSchema>;
export type ProjectCostSummaryFilters = z.infer<typeof ProjectCostSummaryFiltersSchema>;
