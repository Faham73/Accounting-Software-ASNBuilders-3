import { z } from 'zod';

/**
 * Schema for creating a stock item
 */
export const StockItemCreateSchema = z.object({
  name: z.string().min(1, 'Stock item name is required').trim(),
  sku: z.string().optional().nullable(),
  unit: z.string().min(1, 'Unit is required'),
  category: z.string().optional().nullable(),
  reorderLevel: z.number().nonnegative('Reorder level must be non-negative').optional().nullable(),
  isActive: z.boolean().default(true),
});

/**
 * Schema for updating a stock item
 */
export const StockItemUpdateSchema = z.object({
  name: z.string().min(1, 'Stock item name is required').trim().optional(),
  sku: z.string().optional().nullable(),
  unit: z.string().min(1, 'Unit is required').optional(),
  category: z.string().optional().nullable(),
  reorderLevel: z.number().nonnegative('Reorder level must be non-negative').optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for filtering stock items list
 */
export const StockItemListFiltersSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
  category: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

/**
 * Schema for creating a stock movement (IN)
 */
export const StockMovementInSchema = z.object({
  stockItemId: z.string().min(1, 'Stock item is required'),
  qty: z.number().positive('Quantity must be positive'),
  unitCost: z.number().nonnegative('Unit cost must be non-negative').optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  projectId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  movementDate: z.string().datetime().optional(),
});

/**
 * Schema for creating a stock movement (OUT)
 */
export const StockMovementOutSchema = z.object({
  stockItemId: z.string().min(1, 'Stock item is required'),
  qty: z.number().positive('Quantity must be positive'),
  projectId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  movementDate: z.string().datetime().optional(),
});

/**
 * Schema for creating a stock movement (ADJUST)
 */
export const StockMovementAdjustSchema = z.object({
  stockItemId: z.string().min(1, 'Stock item is required'),
  qty: z.number().nonnegative('Quantity must be non-negative'),
  unitCost: z.number().nonnegative('Unit cost must be non-negative').optional(),
  notes: z.string().optional().nullable(),
  movementDate: z.string().datetime().optional(),
});

/**
 * Schema for filtering stock balances list
 */
export const StockBalanceListFiltersSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
  lowStock: z.coerce.boolean().optional(),
  category: z.string().optional(),
});

/**
 * Schema for filtering stock movements list
 */
export const StockMovementListFiltersSchema = z.object({
  stockItemId: z.string().optional(),
  type: z.enum(['IN', 'OUT', 'ADJUST']).optional(),
  projectId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
});

// Inferred TypeScript types
export type StockItemCreate = z.infer<typeof StockItemCreateSchema>;
export type StockItemUpdate = z.infer<typeof StockItemUpdateSchema>;
export type StockItemListFilters = z.infer<typeof StockItemListFiltersSchema>;
export type StockMovementIn = z.infer<typeof StockMovementInSchema>;
export type StockMovementOut = z.infer<typeof StockMovementOutSchema>;
export type StockMovementAdjust = z.infer<typeof StockMovementAdjustSchema>;
export type StockBalanceListFilters = z.infer<typeof StockBalanceListFiltersSchema>;
export type StockMovementListFilters = z.infer<typeof StockMovementListFiltersSchema>;
