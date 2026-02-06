import { z } from 'zod';

/**
 * Schema for creating attachment metadata
 * Note: This is for metadata only. Actual file upload handling is separate.
 */
export const AttachmentCreateSchema = z.object({
  url: z.string().url('URL must be a valid URL'),
  fileName: z.string().min(1, 'File name is required'),
  mimeType: z.string().min(1, 'MIME type is required'),
  sizeBytes: z.number().int().positive('Size must be a positive integer'),
});

/**
 * Schema for filtering attachments in list queries
 */
export const AttachmentListFiltersSchema = z.object({
  uploadedByUserId: z.string().optional(),
  mimeType: z.string().optional(),
  minSizeBytes: z.number().int().nonnegative().optional(),
  maxSizeBytes: z.number().int().positive().optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
});

// Inferred TypeScript types
export type AttachmentCreate = z.infer<typeof AttachmentCreateSchema>;
export type AttachmentListFilters = z.infer<typeof AttachmentListFiltersSchema>;
