/**
 * Server-side service for ensuring default expense categories exist
 * 
 * This service auto-creates default expense categories for each company.
 * Run this on company creation or seed.
 */

import { prisma } from '@accounting/db';

/**
 * Default expense categories with their sort order
 * These are created for every company
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Land & Legal', sortOrder: 10 },
  { name: 'Design & Approvals', sortOrder: 20 },
  { name: 'Construction Material', sortOrder: 30 },
  { name: 'Labor & Workforce', sortOrder: 40 },
  { name: 'Machinery & Equipment', sortOrder: 50 },
  { name: 'Sub-Contractor', sortOrder: 60 },
  { name: 'Utilities & Site Ops', sortOrder: 70 },
  { name: 'Transport & Logistics', sortOrder: 80 },
  { name: 'Site Admin & Misc', sortOrder: 90 },
  { name: 'Finance & Statutory', sortOrder: 100 },
  { name: 'Marketing & Sales', sortOrder: 110 },
  { name: 'Head Office', sortOrder: 120 },
  { name: 'Contingency', sortOrder: 130 },
] as const;

/**
 * Ensure all default expense categories exist for a company
 * Idempotent: safe to re-run. Only creates missing categories.
 * Does NOT modify existing categories (preserves user customizations).
 * 
 * @param companyId - The company ID to ensure categories for
 * @returns Promise resolving to a map of category names to category IDs
 */
export async function ensureDefaultExpenseCategories(
  companyId: string
): Promise<Record<string, string>> {
  const categoryIdMap: Record<string, string> = {};

  // Create each default category if it doesn't exist
  for (const categoryDef of DEFAULT_EXPENSE_CATEGORIES) {
    // Check if category already exists (by name + companyId)
    const existing = await prisma.expenseCategory.findFirst({
      where: {
        companyId,
        name: categoryDef.name,
      },
    });

    if (existing) {
      // Category already exists, use it
      categoryIdMap[categoryDef.name] = existing.id;
    } else {
      // Create new category
      const category = await prisma.expenseCategory.create({
        data: {
          companyId,
          name: categoryDef.name,
          code: null, // code is optional
          isActive: true,
          sortOrder: categoryDef.sortOrder,
        },
      });
      categoryIdMap[categoryDef.name] = category.id;
    }
  }

  return categoryIdMap;
}

/**
 * Ensure default expense categories for all companies
 * Useful for migration or bulk setup
 */
export async function ensureDefaultExpenseCategoriesForAllCompanies(): Promise<void> {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const company of companies) {
    await ensureDefaultExpenseCategories(company.id);
  }
}
