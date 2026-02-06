import { z } from 'zod';

/**
 * Schema for creating a company
 */
export const CompanyCreateSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  isActive: z.boolean().optional().default(true),
});

/**
 * Schema for updating a company
 */
export const CompanyUpdateSchema = z.object({
  name: z.string().min(1, 'Company name is required').optional(),
  isActive: z.boolean().optional(),
});

// Inferred TypeScript types
export type CompanyCreate = z.infer<typeof CompanyCreateSchema>;
export type CompanyUpdate = z.infer<typeof CompanyUpdateSchema>;
