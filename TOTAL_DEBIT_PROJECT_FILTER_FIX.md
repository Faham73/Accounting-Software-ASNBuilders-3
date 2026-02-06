# Total Debit Project Filter Fix

## Problem

When filtering Total Debit by project (projectId set), the list showed **NOTHING** even though:
- The project dashboard "Total Debit" card showed correct totals
- All projects view (projectId empty) showed debits correctly

## Root Cause

**Data Mismatch**: Some voucherLines have `projectId = NULL` but their parent `voucher.projectId` is set.

**Filtering Logic Bug**: All filtering logic only checked `voucherLine.projectId`, ignoring `voucher.projectId`:
- `/api/debit` route filtered by `where.projectId = filters.projectId`
- `getCompanyTotals()` filtered by `where.projectId = projectId`
- `getProjectTotals()` filtered by `where.projectId = projectId`

**Creation Logic Bug**: When creating voucherLines, if `line.projectId` was null, it didn't fall back to `voucher.projectId`.

## Fixes Applied

### 1. Fixed `/api/debit` Route (`apps/web/app/api/debit/route.ts`)

**Changed**: Project filtering now uses OR logic:
```typescript
if (filters.projectId) {
  where.AND = [
    {
      OR: [
        { projectId: filters.projectId },
        { voucher: { projectId: filters.projectId } },
      ],
    },
    { voucher: voucherFilters }, // status + date filters
  ];
}
```

**Also fixed**: `includeCompanyLevel` logic to exclude rows where BOTH voucherLine.projectId AND voucher.projectId are null.

### 2. Fixed `getCompanyTotals()` (`apps/web/lib/projects/projectTotals.server.ts`)

**Changed**: Same OR logic for project filtering:
```typescript
if (projectId) {
  debitWhere.AND = [
    {
      OR: [
        { projectId },
        { voucher: { projectId } },
      ],
    },
    { voucher: { status: voucherStatusFilter } },
  ];
}
```

### 3. Fixed `getProjectTotals()` (`apps/web/lib/projects/projectTotals.server.ts`)

**Changed**: Project-scoped debit total now uses OR logic:
```typescript
prisma.voucherLine.aggregate({
  where: {
    companyId,
    OR: [
      { projectId },
      { voucher: { projectId } },
    ],
    ...(debitVoucherStatus === 'POSTED' && {
      voucher: { status: 'POSTED' },
    }),
  },
  _sum: { debit: true },
})
```

### 4. Fixed Voucher Creation (`apps/web/app/api/vouchers/route.ts`)

**Changed**: Now falls back to `voucher.projectId` when `line.projectId` is null:
```typescript
const voucherProjectId = validatedData.expenseType === 'OFFICE_EXPENSE' 
  ? null 
  : (validatedData.projectId || null);
const lineProjectId = validatedData.expenseType === 'OFFICE_EXPENSE' 
  ? null 
  : (line.isCompanyLevel ? null : (line.projectId || voucherProjectId));
```

### 5. Fixed Voucher Update (`apps/web/app/api/vouchers/[id]/route.ts`)

**Changed**: Same fallback logic when updating voucherLines.

### 6. Created Backfill Script (`packages/db/scripts/backfillVoucherLineProjectId.ts`)

**Purpose**: Update existing voucherLines where `projectId` is null but `voucher.projectId` is set.

**Usage**:
```bash
npm run backfill:voucher-line-project-id --workspace=packages/db
# or from root:
npm run backfill:voucher-line-project-id --workspace=packages/db
```

**What it does**:
- Finds voucherLines with `projectId = NULL` but `voucher.projectId IS NOT NULL`
- Updates them to set `voucherLine.projectId = voucher.projectId`
- Groups by projectId for efficient batch updates
- Verifies no mismatches remain

## Testing

After applying fixes:

1. **Project Filter**: Navigate to `/dashboard/debit?projectId=<projectId>` → should show debits for that project
2. **All Projects**: Navigate to `/dashboard/debit` → should show all debits
3. **Project Dashboard**: Total Debit card should match filtered list totals
4. **Date/Status Filters**: Should still work correctly
5. **New Vouchers**: Created voucherLines should have projectId set from voucher.projectId if line.projectId is null

## Files Modified

1. `apps/web/app/api/debit/route.ts` - Fixed project filtering with OR logic
2. `apps/web/lib/projects/projectTotals.server.ts` - Fixed both `getCompanyTotals()` and `getProjectTotals()`
3. `apps/web/app/api/vouchers/route.ts` - Fixed voucherLine creation to fallback to voucher.projectId
4. `apps/web/app/api/vouchers/[id]/route.ts` - Fixed voucherLine update to fallback to voucher.projectId
5. `packages/db/scripts/backfillVoucherLineProjectId.ts` - New backfill script
6. `packages/db/package.json` - Added script command

## Next Steps

1. **Run backfill script** to fix existing data:
   ```bash
   npm run backfill:voucher-line-project-id --workspace=packages/db
   ```

2. **Test** the project filter in the UI

3. **Optional**: After backfill, the OR logic in filters can be simplified back to just `projectId` filtering (since all voucherLines will have projectId set). However, keeping the OR logic provides defense-in-depth for any edge cases.

## Notes

- The OR logic ensures backward compatibility with existing data
- New vouchers will have projectId set correctly from the start
- The backfill script is idempotent and safe to re-run
- All filtering logic now consistently uses the same OR pattern
