import { z } from 'zod';

const optionalString = z.preprocess(
  (v) => {
    // Convert null -> undefined
    if (v === null) return undefined;
    // Convert "" or "   " -> undefined
    if (typeof v === 'string' && v.trim() === '') return undefined;
    return v;
  },
  z.string().optional()
);

/**
 * Schema for creating a vendor
 */
export const VendorCreateSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  phone: optionalString,
  address: optionalString,
  notes: optionalString,
  isActive: z.boolean().optional().default(true),
});

/**
 * Schema for updating a vendor
 */
export const VendorUpdateSchema = z.object({
  name: z.string().min(1, 'Vendor name is required').optional(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// Inferred TypeScript types
export type VendorCreate = z.infer<typeof VendorCreateSchema>;
export type VendorUpdate = z.infer<typeof VendorUpdateSchema>;
