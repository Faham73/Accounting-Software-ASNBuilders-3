import { z } from 'zod';

/**
 * Purchase status enum values
 */
export const PurchaseStatusEnum = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED']);

/**
 * Purchase line type enum values
 */
export const PurchaseLineTypeEnum = z.enum(['MATERIAL', 'SERVICE', 'OTHER']);

/**
 * Purchase payment method (CASH -> 1010, BANK -> 1020; server maps to paymentAccountId)
 */
export const PurchasePaymentMethodEnum = z.enum(['CASH', 'BANK']);

/**
 * Schema for creating a purchase line
 */
export const PurchaseLineCreateSchema = z
  .object({
    lineType: PurchaseLineTypeEnum.default('MATERIAL'),
    stockItemId: z.string().optional().nullable(),
    quantity: z.number().nonnegative('Quantity must be non-negative').optional().nullable(),
    unit: z.string().optional().nullable(),
    unitRate: z.number().nonnegative('Unit rate must be non-negative').optional().nullable(),
    description: z.string().optional().nullable(),
    materialName: z.string().trim().min(1).optional().nullable(),
    lineTotal: z.number().nonnegative('Line total must be non-negative'),
  })
  .superRefine((data, ctx) => {
    // MATERIAL lines require either materialName OR stockItemId (for backwards compatibility)
    // Also require quantity > 0
    if (data.lineType === 'MATERIAL') {
      if (!data.materialName && !data.stockItemId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Material name or stock item is required for MATERIAL lines',
          path: ['materialName'],
        });
      }
      if (!data.quantity || data.quantity <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Quantity must be greater than 0 for MATERIAL lines',
          path: ['quantity'],
        });
      }
    }

    // SERVICE lines require description + amount > 0
    if (data.lineType === 'SERVICE') {
      if (!data.description) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Description is required for SERVICE lines',
          path: ['description'],
        });
      }
      if (data.lineTotal <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Amount must be greater than 0 for SERVICE lines',
          path: ['lineTotal'],
        });
      }
    }

    // OTHER lines require amount > 0
    if (data.lineType === 'OTHER') {
      if (data.lineTotal <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Amount must be greater than 0 for OTHER lines',
          path: ['lineTotal'],
        });
      }
    }

    // Compute lineTotal from qty * unitRate if not provided
    if (data.quantity && data.unitRate && (!data.lineTotal || data.lineTotal === 0)) {
      // This will be handled server-side, but we can validate here
    }
  });

/**
 * Schema for creating a purchase attachment
 */
export const PurchaseAttachmentCreateSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileUrl: z.string().url('File URL must be a valid URL'),
  mimeType: z.string().min(1, 'MIME type is required'),
  sizeBytes: z.number().int().positive('Size must be a positive integer'),
});

/**
 * Schema for creating a purchase
 */
export const PurchaseCreateSchema = z.object({
  date: z.coerce.date(),
  challanNo: z.string().optional().nullable(),
  projectId: z.string().min(1, 'Main project is required'),
  subProjectId: z.string().optional().nullable(),
  supplierVendorId: z.string().min(1, 'Supplier is required'),
  reference: z.string().optional().nullable(),
  discountPercent: z.number().nonnegative().max(100).optional().nullable(),
  paidAmount: z.number().nonnegative('Paid amount must be non-negative').default(0),
  paymentMethod: PurchasePaymentMethodEnum.optional().nullable(),
  lines: z.array(PurchaseLineCreateSchema).min(1, 'At least one purchase line is required'),
  attachments: z.array(PurchaseAttachmentCreateSchema).optional().default([]),
})
  .refine(
    (data) => {
      const subtotal = data.lines.reduce((sum, line) => sum + line.lineTotal, 0);
      const discount = data.discountPercent ? (subtotal * data.discountPercent / 100) : 0;
      const total = subtotal - discount;
      return data.paidAmount <= total;
    },
    { message: 'Paid amount cannot exceed total amount' }
  )
  .refine(
    (data) => {
      if (data.paidAmount > 0) return !!data.paymentMethod;
      return true;
    },
    { message: 'Payment method (Cash or Bank) is required when paid amount > 0', path: ['paymentMethod'] }
  )
  .refine(
    (data) => {
      if (data.paidAmount === 0) return data.paymentMethod == null;
      return true;
    },
    { message: 'Payment method must be empty when paid amount is 0', path: ['paymentMethod'] }
  );

/**
 * Schema for updating a purchase
 */
export const PurchaseUpdateSchema = z.object({
  date: z.coerce.date().optional(),
  challanNo: z.string().optional().nullable(),
  projectId: z.string().min(1, 'Main project is required').optional(),
  subProjectId: z.string().optional().nullable(),
  supplierVendorId: z.string().min(1, 'Supplier is required').optional(),
  reference: z.string().optional().nullable(),
  discountPercent: z.number().nonnegative().max(100).optional().nullable(),
  paidAmount: z.number().nonnegative('Paid amount must be non-negative').optional(),
  paymentMethod: PurchasePaymentMethodEnum.optional().nullable(),
  lines: z.array(PurchaseLineCreateSchema).min(1, 'At least one purchase line is required').optional(),
  attachments: z.array(PurchaseAttachmentCreateSchema).optional(),
})
  .refine(
    (data) => {
      if (!data.lines || data.paidAmount == null) return true;
      const subtotal = data.lines.reduce((sum, line) => sum + line.lineTotal, 0);
      const discount = data.discountPercent ? (subtotal * data.discountPercent / 100) : 0;
      const total = subtotal - discount;
      return data.paidAmount <= total;
    },
    { message: 'Paid amount cannot exceed total amount' }
  )
  .refine(
    (data) => {
      if (data.paidAmount != null && data.paidAmount > 0) return !!data.paymentMethod;
      return true;
    },
    { message: 'Payment method (Cash or Bank) is required when paid amount > 0', path: ['paymentMethod'] }
  )
  .refine(
    (data) => {
      if (data.paidAmount != null && data.paidAmount === 0) return data.paymentMethod == null;
      return true;
    },
    { message: 'Payment method must be empty when paid amount is 0', path: ['paymentMethod'] }
  );

/**
 * Schema for filtering purchases list
 */
export const PurchaseListFiltersSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
  projectId: z.string().optional(),
  subProjectId: z.string().optional(),
  supplierId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// Inferred TypeScript types
export type PurchaseLineCreate = z.infer<typeof PurchaseLineCreateSchema>;
export type PurchaseAttachmentCreate = z.infer<typeof PurchaseAttachmentCreateSchema>;
export type PurchaseCreate = z.infer<typeof PurchaseCreateSchema>;
export type PurchaseUpdate = z.infer<typeof PurchaseUpdateSchema>;
export type PurchaseListFilters = z.infer<typeof PurchaseListFiltersSchema>;
export type PurchaseStatus = z.infer<typeof PurchaseStatusEnum>;
export type PurchaseLineType = z.infer<typeof PurchaseLineTypeEnum>;
export type PurchasePaymentMethod = z.infer<typeof PurchasePaymentMethodEnum>;
