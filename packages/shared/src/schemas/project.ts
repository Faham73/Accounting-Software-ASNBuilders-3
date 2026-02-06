import { z } from 'zod';

/**
 * Project status enum values
 */
export const ProjectStatusEnum = z.enum(['DRAFT', 'RUNNING', 'COMPLETED', 'CLOSED']);

/**
 * Schema for creating a project
 */
export const ProjectCreateSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  clientName: z.string().optional(),
  clientContact: z.string().optional(),
  siteLocation: z.string().optional(),
  startDate: z.coerce.date().optional(),
  expectedEndDate: z.coerce.date().optional(),
  contractValue: z
    .number()
    .nonnegative('Contract value must be non-negative')
    .optional()
    .nullable(),
  status: ProjectStatusEnum.optional().default('DRAFT'),
  assignedManager: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  // New fields
  address: z.string().optional().nullable(),
  projectManager: z.string().optional().nullable(),
  projectEngineer: z.string().optional().nullable(),
  companySiteName: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  isMain: z.boolean().optional().default(false),
  parentProjectId: z.string().optional().nullable(),
  budgetTotal: z
    .number()
    .nonnegative('Budget must be non-negative')
    .optional()
    .nullable(),
});

/**
 * Schema for updating a project
 */
export const ProjectUpdateSchema = z.object({
  name: z.string().min(1, 'Project name is required').optional(),
  clientName: z.string().optional().nullable(),
  clientContact: z.string().optional().nullable(),
  siteLocation: z.string().optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  expectedEndDate: z.coerce.date().optional().nullable(),
  contractValue: z
    .number()
    .nonnegative('Contract value must be non-negative')
    .optional()
    .nullable(),
  status: ProjectStatusEnum.optional(),
  assignedManager: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  // New fields
  address: z.string().optional().nullable(),
  projectManager: z.string().optional().nullable(),
  projectEngineer: z.string().optional().nullable(),
  companySiteName: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  isMain: z.boolean().optional(),
  parentProjectId: z.string().optional().nullable(),
  budgetTotal: z
    .number()
    .nonnegative('Budget must be non-negative')
    .optional()
    .nullable(),
});

// Inferred TypeScript types
export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;
export type ProjectUpdate = z.infer<typeof ProjectUpdateSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusEnum>;
