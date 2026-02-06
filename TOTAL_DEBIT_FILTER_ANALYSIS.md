# Total Debit Filter Bug Analysis

## A) Code Paths for Total Debit List + Filters

### 1) Page Entry & Client Component
- **Page Route**: `apps/web/app/dashboard/debit/page.tsx`
  - Server component that renders `DebitClient`
- **Client Component**: `apps/web/app/dashboard/debit/DebitClient.tsx`
  - Main component handling UI, filters, and data fetching

### 2) Filter Fields & State Management
**Filter Fields** (defined in `DebitClient.tsx` line 105-111):
- `projectId`: string (empty string = all projects)
- `dateFrom`: string (date input)
- `dateTo`: string (date input)
- `status`: string ('ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED')
- `includeCompanyLevel`: boolean (default: true)

**State Storage**:
- Local state: `useState` hook (line 105-111)
- URL sync: `useSearchParams` + `router.replace` (partial - **BUG HERE**)

**Filter Change Trigger**:
- `handleFilterChange` (line 225-232) updates state
- Only calls `updateUrl` for `projectId`, `status`, `includeCompanyLevel` - **NOT for dates**
- `loadDebits` callback (line 178-204) depends on all filter values
- `useEffect` (line 206-209) calls `loadDebits` when filters change

### 3) Data Fetching
**API Endpoint**: `apps/web/app/api/debit/route.ts`
- GET `/api/debit` with query params

**Request Builder** (`DebitClient.tsx` line 178-192):
```typescript
const params = new URLSearchParams();
if (filters.projectId) params.set('projectId', filters.projectId);
if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
if (filters.dateTo) params.set('dateTo', filters.dateTo);
if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
if (!filters.projectId && filters.includeCompanyLevel === false) {
  params.set('includeCompanyLevel', 'false');
}
params.set('page', pagination.page.toString());
params.set('pageSize', pagination.pageSize.toString());
```

**Backend Handler** (`apps/web/app/api/debit/route.ts`):
- Reads query params (line 36-45)
- Validates with Zod schema (line 15-26)
- Builds Prisma where clause (line 50-76)
- Applies date filters correctly (line 66-76)

## B) Why Filters "Do Nothing"

### Root Cause Identified

**BUG #1**: `handleFilterChange` doesn't update URL for date filters
- Line 229: Only calls `updateUrl` for `projectId`, `status`, `includeCompanyLevel`
- Date filters (`dateFrom`, `dateTo`) update state but NOT URL
- When component remounts or URL is shared, date filters are lost

**BUG #2**: URL hydration doesn't read date params
- Lines 115-127: Only reads `projectId`, `status`, `includeCompanyLevel` from URL
- `dateFrom` and `dateTo` are never hydrated from URL params

**BUG #3**: `updateUrl` function doesn't include date params
- Lines 211-223: `updateUrl` builds URL but doesn't include `dateFrom`/`dateTo` when called from `handleFilterChange`

### Expected Behavior vs Actual

1. ✅ **Frontend updates state**: YES (line 227)
2. ❌ **Frontend updates URL**: NO (only for projectId/status/includeCompanyLevel)
3. ✅ **Request includes params**: YES (line 182-184 builds params correctly)
4. ✅ **Backend applies filters**: YES (lines 66-76 apply date filters)
5. ❌ **URL sync**: NO (dates not in URL, so refresh loses filters)

### Cache/Query Key Issue
- Not using react-query/SWR - using plain `fetch` with `useEffect`
- No cache key issue, but URL sync is broken

## C) Prisma Data Status

### Voucher/VoucherLine Structure
- **Voucher**: `vouchers` table (line 332-383 in schema.prisma)
  - Has `status` field (DRAFT, SUBMITTED, APPROVED, POSTED, REVERSED)
  - Has `date` field
  - Has `type` field (RECEIPT, PAYMENT, JOURNAL, CONTRA)
- **VoucherLine**: `voucher_lines` table (line 385-423 in schema.prisma)
  - Has `debit` and `credit` fields
  - Filtered by `debit > 0` in API (line 52)

### Deletion Status
**"Delete all data" script**: `packages/db/scripts/resetStockData.ts`
- **ONLY deletes**: StockMovement, InventoryTxn, ProjectStockSetting, StockBalance, StockItem
- **DOES NOT delete**: Vouchers, VoucherLines, Projects, Accounts, etc.
- **Conclusion**: Debits (voucherLines with debit > 0) should still exist

### Seed Script
- `packages/db/prisma/seed.ts` creates vouchers and voucherLines
- Creates 30 vouchers by default (line 282)
- Creates voucherLines with debit amounts
- **Idempotent**: Uses upserts, won't duplicate if re-run

## D) "Delete All Data" Logic

**File**: `packages/db/scripts/resetStockData.ts`
**What it deletes**:
```typescript
- StockMovement.deleteMany({})
- InventoryTxn.deleteMany({})
- ProjectStockSetting.deleteMany({})
- StockBalance.deleteMany({})
- StockItem.deleteMany({})
```

**What it DOES NOT delete**:
- Vouchers
- VoucherLines
- Projects
- Accounts
- Users
- Companies

**Conclusion**: Debits (voucherLines) were NOT deleted by the reset script.

## Fix Required

1. Update `handleFilterChange` to call `updateUrl` for ALL filter changes (including dates)
2. Update URL hydration to read `dateFrom` and `dateTo` from URL params
3. Ensure `updateUrl` includes date params in the URL
