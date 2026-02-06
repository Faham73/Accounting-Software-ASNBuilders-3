# Default Expense Categories Implementation

## Summary

Implemented default expense categories (13 predefined) that are automatically created for all companies. Categories appear in the "Expense Category *" dropdown in Add Expense form.

## Files Modified

### 1. **Helper Function** (`apps/web/lib/expenseCategoriesDefaults.server.ts`)
   - **NEW FILE** - Created reusable helper function
   - `ensureDefaultExpenseCategories(companyId)` - Ensures all 13 default categories exist for a company
   - `ensureDefaultExpenseCategoriesForAllCompanies()` - Bulk setup helper
   - Uses `findFirst` + `create` pattern (does NOT modify existing categories)
   - Categories created with:
     - `isActive = true`
     - `sortOrder = 10, 20, 30...` (in list order)
     - `code = null` (optional field)

### 2. **Seed Script** (`packages/db/prisma/seed.ts`)
   - **UPDATED** - Added call to `ensureDefaultExpenseCategories` at start of `seedCompany()`
   - Replaced hardcoded category creation with helper call
   - Removed duplicate category creation logic
   - Categories are now created via shared helper (consistent with production)

### 3. **Company Creation API** (`apps/web/app/api/companies/route.ts`)
   - **UPDATED** - Added call to `ensureDefaultExpenseCategories` after company creation
   - New companies automatically get default categories

### 4. **Bootstrap API** (`apps/web/app/api/auth/bootstrap/route.ts`)
   - **UPDATED** - Added call to `ensureDefaultExpenseCategories` after bootstrap company creation
   - First company created via bootstrap gets default categories

## Default Categories (13)

1. Land & Legal (sortOrder: 10)
2. Design & Approvals (sortOrder: 20)
3. Construction Material (sortOrder: 30)
4. Labor & Workforce (sortOrder: 40)
5. Machinery & Equipment (sortOrder: 50)
6. Sub-Contractor (sortOrder: 60)
7. Utilities & Site Ops (sortOrder: 70)
8. Transport & Logistics (sortOrder: 80)
9. Site Admin & Misc (sortOrder: 90)
10. Finance & Statutory (sortOrder: 100)
11. Marketing & Sales (sortOrder: 110)
12. Head Office (sortOrder: 120)
13. Contingency (sortOrder: 130)

## Behavior

- **Idempotent**: Safe to run multiple times - only creates missing categories
- **Non-destructive**: Does NOT modify existing categories (preserves user customizations)
- **Automatic**: Categories created automatically for:
  - New companies (via `/api/companies` POST)
  - Bootstrap companies (via `/api/auth/bootstrap` POST)
  - Existing companies (via seed script)

## UI Impact

- No UI changes required
- Dropdown in `CreateDebitVoucherForm.tsx` continues to fetch from `/api/expense-categories?active=true`
- Default categories automatically appear in dropdown (sorted by sortOrder)

## Commands to Run

### For Existing Companies (Backfill)
```bash
# Run seed to ensure defaults exist for all companies
cd packages/db
npx prisma db seed
# OR from root:
npm run db:seed
```

### For New Companies
- No action needed - categories are created automatically when company is created

### Verify
1. Check expense categories page: `/dashboard/expense-categories`
2. Should see all 13 default categories
3. Try creating a new expense: `/dashboard/projects/[id]/debit/new`
4. Category dropdown should show all 13 defaults

## Testing Checklist

- [ ] Seed runs successfully and creates categories for existing companies
- [ ] New company creation via `/api/companies` creates default categories
- [ ] Bootstrap company creation creates default categories
- [ ] Categories appear in Add Expense form dropdown
- [ ] Categories are sorted correctly (by sortOrder)
- [ ] Existing custom categories are preserved (not modified)
- [ ] Re-running seed doesn't create duplicates

## Notes

- Categories are created with `code = null` (code is optional in schema)
- Helper uses `findFirst` + `create` pattern (not `upsert`) to avoid modifying existing categories
- Seed script still assigns codes to categories for testing purposes (doesn't affect production)
