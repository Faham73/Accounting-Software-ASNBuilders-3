import { z } from 'zod';

/**
 * Payment method type enum values
 */
export const PaymentMethodTypeEnum = z.enum(['CASH', 'BANK', 'CHEQUE', 'MOBILE']);

/**
 * Schema for creating a payment method
 */
export const PaymentMethodCreateSchema = z.object({
  name: z.string().min(1, 'Payment method name is required'),
  type: PaymentMethodTypeEnum,
  isActive: z.boolean().optional().default(true),
});

/**
 * Schema for updating a payment method
 */
export const PaymentMethodUpdateSchema = z.object({
  name: z.string().min(1, 'Payment method name is required').optional(),
  type: PaymentMethodTypeEnum.optional(),
  isActive: z.boolean().optional(),
});

// Inferred TypeScript types
export type PaymentMethodCreate = z.infer<typeof PaymentMethodCreateSchema>;
export type PaymentMethodUpdate = z.infer<typeof PaymentMethodUpdateSchema>;
export type PaymentMethodType = z.infer<typeof PaymentMethodTypeEnum>;
