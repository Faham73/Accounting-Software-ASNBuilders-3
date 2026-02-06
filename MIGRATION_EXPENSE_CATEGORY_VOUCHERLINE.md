# Migration: Add Expense Category to VoucherLine

## Summary of Changes

This migration adds `expenseCategoryId` to the `VoucherLine` model to enable category-wise expense tracking and cost summary aggregation.

### Files Modified

1. **Database Schema** (`packages/db/prisma/schema.prisma`)
   - Added `expenseCategoryId` field to `VoucherLine` model
   - Added relation to `ExpenseCategory`
   - Added index `[companyId, projectId, expenseCategoryId]`
   - Added reverse relation `voucherLines[]` to `ExpenseCategory`

2. **Shared Schemas** (`packages/shared/src/schemas/voucher.ts`)
   - Added `expenseCategoryId: z.string().uuid().optional().nullable()` to `VoucherLineCreateSchema`
   - Added `expenseCategoryId: z.string().uuid().optional().nullable()` to `VoucherLineUpdateSchema`

3. **Voucher API** (`apps/web/app/api/vouchers/route.ts`)
   - Accepts `expenseCategoryId` in voucher line creation
   - Stores `expenseCategoryId` on voucher lines (debit lines only)
   - Includes `expenseCategory` relation in response

4. **Debit API** (`apps/web/app/api/debit/route.ts`)
   - Includes `expenseCategory` relation in response

5. **Project Add Expense Form** (`apps/web/app/dashboard/projects/[id]/debit/new/CreateDebitVoucherForm.tsx`)
   - Added expense category dropdown (required)
   - Filters expense accounts by selected category
   - Includes `expenseCategoryId` in payload
   - Renamed "Work Details" → "Work / Material Details"

6. **Debit List Page** (`apps/web/app/dashboard/debit/DebitClient.tsx`)
   - Added category column to table
   - Shows category name for each expense line

7. **Cost Summary API** (`apps/web/app/api/projects/[id]/cost-summary/route.ts`)
   - Aggregates VoucherLine expenses by `expenseCategoryId` instead of "OTHERS"
   - Merges VoucherLine totals with Expense model totals by categoryId
   - Handles uncategorized expenses (null categoryId) as "Uncategorized"
   - Includes categories used in voucherLines in the category list

## Migration Steps

### 1. Generate Prisma Migration

```bash
cd packages/db
npx prisma migrate dev --name add_expense_category_to_voucher_line
```

This will:
- Create a migration SQL file
- Apply the migration to your database
- Regenerate Prisma Client

### 2. Regenerate Prisma Client (if needed)

```bash
cd packages/db
npx prisma generate
```

### 3. Update Existing Data (Optional)

If you want to backfill existing VoucherLine records with categoryId based on their account's expenseCategoryId:

```sql
-- Backfill expenseCategoryId from account's expenseCategoryId for debit lines
UPDATE voucher_lines vl
SET expense_category_id = a.expense_category_id
FROM accounts a
WHERE vl.account_id = a.id
  AND vl.debit > 0
  AND a.expense_category_id IS NOT NULL
  AND vl.expense_category_id IS NULL;
```

**Note:** This is optional. Existing records will show as "Uncategorized" in cost summary if not backfilled.

### 4. Verify Changes

1. **Test Add Expense Form:**
   - Navigate to `/dashboard/projects/[id]/debit/new`
   - Verify category dropdown appears and is required
   - Verify expense account list filters by selected category
   - Create an expense and verify it saves with categoryId

2. **Test Debit List:**
   - Navigate to `/dashboard/debit`
   - Verify category column appears in table
   - Verify existing expenses show category (or "—" if null)

3. **Test Cost Summary:**
   - Navigate to `/dashboard/projects/[id]/cost-summary`
   - Verify expenses are grouped by category (not all in "OTHERS")
   - Verify "Uncategorized" appears if any expenses have null categoryId

## Breaking Changes

**None** - All changes are backward compatible:
- `expenseCategoryId` is optional in schemas
- Existing API calls without `expenseCategoryId` still work
- Existing VoucherLine records with null `expenseCategoryId` are handled gracefully

## Edge Cases Handled

1. **Deleted/Inactive Categories:** Existing voucher lines may reference deleted categories. The API handles this gracefully by showing category name if available, or "Unknown Category" if not found.

2. **Null CategoryId:** VoucherLines without a category are grouped under "Uncategorized" in cost summary.

3. **Account Filtering:** Expense accounts are filtered by selected category. If no category is selected, account dropdown is disabled.

4. **Backward Compatibility:** All new fields are optional, so existing API callers continue to work without modification.

## Testing Checklist

- [ ] Migration runs successfully
- [ ] New expense form requires category selection
- [ ] Expense account list filters by category
- [ ] Expense saves with categoryId
- [ ] Debit list shows category column
- [ ] Cost summary groups expenses by category
- [ ] Uncategorized expenses appear correctly
- [ ] Existing expenses without category show "—" in list
- [ ] Edit expense form (if implemented) preserves category
