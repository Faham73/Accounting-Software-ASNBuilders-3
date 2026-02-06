# Phase 2: Accounting Backbone (Voucher Engine) - Implementation Plan

## Overview
This document outlines the complete implementation plan for Phase 2: Accounting Backbone (Voucher Engine), which includes Chart of Accounts, Voucher system with posting validation, and basic UI pages.

## Prisma Schema Changes

### New Enums
```prisma
enum VoucherStatus {
  DRAFT
  POSTED
  // Note: REVERSED status will be added in future phase when reversal functionality is implemented
}

enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
}

enum VoucherType {
  JOURNAL
  PAYMENT
  RECEIPT
  CONTRA
}
```

### New Models

#### 1. ChartOfAccount
```prisma
model ChartOfAccount {
  id          String      @id @default(cuid())
  companyId   String      @map("company_id")
  code        String      // Account code (e.g., "1000", "2000")
  name        String      // Account name
  type        AccountType // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  parentId    String?     @map("parent_id") // For hierarchical accounts
  description String?
  isActive    Boolean     @default(true) @map("is_active")
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  company       Company        @relation(fields: [companyId], references: [id])
  parent        ChartOfAccount? @relation("AccountHierarchy", fields: [parentId], references: [id])
  children      ChartOfAccount[] @relation("AccountHierarchy")
  voucherLines  VoucherLine[]

  @@unique([companyId, code])
  @@index([companyId])
  @@index([parentId])
  @@map("chart_of_accounts")
}
```

#### 2. Voucher
```prisma
model Voucher {
  id              String        @id @default(cuid())
  companyId       String        @map("company_id")
  voucherNumber   String        @map("voucher_number") // Auto-generated
  type            VoucherType
  status          VoucherStatus @default(DRAFT)
  date            DateTime
  reference       String?       // External reference number
  description     String?
  narration       String?       // Detailed narration
  postedAt        DateTime?     @map("posted_at")
  postedByUserId  String?       @map("posted_by_user_id")
  createdByUserId String        @map("created_by_user_id")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  company       Company       @relation(fields: [companyId], references: [id])
  createdBy     User          @relation("VoucherCreator", fields: [createdByUserId], references: [id])
  postedBy      User?         @relation("VoucherPoster", fields: [postedByUserId], references: [id])
  voucherLines  VoucherLine[]
  
  // Note: Reversal functionality (reversedBy, reversedById) will be added in future phase

  @@unique([companyId, voucherNumber])
  @@index([companyId])
  @@index([companyId, status])
  @@index([companyId, date])
  @@index([createdByUserId])
  @@map("vouchers")
}
```

#### 3. VoucherLine
```prisma
model VoucherLine {
  id          String   @id @default(cuid())
  voucherId   String   @map("voucher_id")
  accountId   String   @map("account_id")
  debit       Decimal  @db.Decimal(15, 2)
  credit      Decimal  @db.Decimal(15, 2)
  description String?
  createdAt   DateTime @default(now()) @map("created_at")

  voucher  Voucher        @relation(fields: [voucherId], references: [id], onDelete: Cascade)
  account  ChartOfAccount @relation(fields: [accountId], references: [id])

  @@index([voucherId])
  @@index([accountId])
  @@map("voucher_lines")
}
```

#### 4. AuditLog
```prisma
model AuditLog {
  id          String   @id @default(cuid())
  companyId   String   @map("company_id")
  userId      String   @map("user_id")
  action      String   // "CREATE", "UPDATE", "POST", "REVERSE"
  resource    String   // "voucher", "chart_of_account", etc.
  resourceId  String   @map("resource_id")
  details     Json?    // Additional details (old/new values, etc.)
  ipAddress   String?  @map("ip_address")
  userAgent   String?  @map("user_agent")
  createdAt   DateTime @default(now()) @map("created_at")

  company Company @relation(fields: [companyId], references: [id])
  user    User    @relation(fields: [userId], references: [id])

  @@index([companyId])
  @@index([companyId, resource, resourceId])
  @@index([userId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

### Updates to Existing Models

#### Company Model
Add relations:
```prisma
chartOfAccounts  ChartOfAccount[]
vouchers         Voucher[]
auditLogs        AuditLog[]
```

#### User Model
Add relations:
```prisma
createdVouchers  Voucher[] @relation("VoucherCreator")
postedVouchers   Voucher[] @relation("VoucherPoster")
auditLogs        AuditLog[]
```

---

## File-by-File Implementation Plan

### Database Layer

#### 1. `packages/db/prisma/schema.prisma`
- Add new enums: `VoucherStatus`, `AccountType`, `VoucherType`
- Add new models: `ChartOfAccount`, `Voucher`, `VoucherLine`, `AuditLog`
- Update `Company` and `User` models with new relations
- Generate migration

#### 2. `packages/db/prisma/migrations/[timestamp]_phase2_voucher_engine/migration.sql`
- Migration will be auto-generated by Prisma

#### 3. `packages/db/src/client.ts`
- Export new enums: `VoucherStatus`, `AccountType`, `VoucherType`
- No other changes needed (Prisma Client auto-generates types)

### Shared Schemas & Validation

#### 4. `packages/shared/src/schemas/chartOfAccount.ts`
- `ChartOfAccountCreateSchema` (code, name, type, parentId?, description?, isActive?)
- `ChartOfAccountUpdateSchema` (code?, name?, type?, parentId?, description?, isActive?)
- `ChartOfAccountListFiltersSchema` (q?, type?, active?, parentId?)
- Export types

#### 5. `packages/shared/src/schemas/voucher.ts`
- `VoucherCreateSchema` (type, date, reference?, description?, narration?, lines: VoucherLineCreateSchema[])
- `VoucherUpdateSchema` (type?, date?, reference?, description?, narration?, lines?: VoucherLineCreateSchema[])
- `VoucherLineCreateSchema` (accountId, debit, credit, description?)
- `VoucherListFiltersSchema` (status?, type?, dateFrom?, dateTo?, q?, page?, limit?)
- `VoucherPostSchema` (id only, validation happens server-side)
- Export types

#### 6. `packages/shared/src/schemas/auditLog.ts`
- `AuditLogListFiltersSchema` (resource?, resourceId?, userId?, dateFrom?, dateTo?, page?, limit?)
- Export types

#### 7. `packages/shared/src/index.ts`
- Export all new schemas and types

### RBAC & Permissions

#### 8. `apps/web/lib/permissions.ts`
- Add resources: `'chartOfAccounts' | 'vouchers'` to `Resource` type
- Add action: `'POST'` to `Action` type
- Add permissions:
  - `chartOfAccounts`: READ: [ADMIN, ACCOUNTANT, ENGINEER, DATA_ENTRY, VIEWER], WRITE: [ADMIN, ACCOUNTANT]
  - `vouchers`: READ: [ADMIN, ACCOUNTANT, ENGINEER, DATA_ENTRY, VIEWER], WRITE: [ADMIN, ACCOUNTANT], POST: [ADMIN, ACCOUNTANT]

#### 9. `apps/web/lib/rbac.ts`
- No changes needed (existing `requirePermission` works with new resources/actions)

### API Route Handlers

#### 10. `apps/web/app/api/chart-of-accounts/route.ts`
- `GET`: List chart of accounts with filters (q, type, active, parentId)
  - Permission: `requirePermission(request, 'chartOfAccounts', 'READ')`
  - Scope to `auth.companyId`
  - Support hierarchical structure
- `POST`: Create new account
  - Permission: `requirePermission(request, 'chartOfAccounts', 'WRITE')`
  - Validate: code uniqueness per company
  - Validate: parentId exists and belongs to same company
  - Create audit log entry

#### 11. `apps/web/app/api/chart-of-accounts/[id]/route.ts`
- `GET`: Get single account by ID
  - Permission: `requirePermission(request, 'chartOfAccounts', 'READ')`
  - Scope to `auth.companyId`
- `PATCH`: Update account
  - Permission: `requirePermission(request, 'chartOfAccounts', 'WRITE')`
  - Validate: Cannot change code if account is used in posted vouchers
  - Validate: parentId changes (circular reference check)
  - Create audit log entry
- `DELETE`: Soft delete (set isActive=false)
  - Permission: `requirePermission(request, 'chartOfAccounts', 'WRITE')`
  - Validate: Cannot delete if account is used in posted vouchers
  - Create audit log entry

#### 12. `apps/web/app/api/vouchers/route.ts`
- `GET`: List vouchers with filters (status, type, dateFrom, dateTo, q, page, limit)
  - Permission: `requirePermission(request, 'vouchers', 'READ')`
  - Scope to `auth.companyId`
  - Include voucherLines in response
  - Pagination support
- `POST`: Create draft voucher
  - Permission: `requirePermission(request, 'vouchers', 'WRITE')`
  - Validate: debit == credit (within tolerance, e.g., 0.01)
  - Validate: At least 2 voucher lines
  - Validate: All accounts belong to company
  - Validate: All accounts are active
  - Auto-generate voucherNumber (format: VOUCH-YYYYMMDD-####)
  - Status defaults to DRAFT
  - Create audit log entry

#### 13. `apps/web/app/api/vouchers/[id]/route.ts`
- `GET`: Get single voucher by ID with all lines
  - Permission: `requirePermission(request, 'vouchers', 'READ')`
  - Scope to `auth.companyId`
  - Include related data (createdBy, postedBy, accounts, etc.)
- `PATCH`: Update draft voucher
  - Permission: `requirePermission(request, 'vouchers', 'WRITE')`
  - Validate: Voucher status is DRAFT (block edits to POSTED vouchers)
  - Validate: debit == credit
  - Validate: All accounts belong to company and are active
  - Replace all voucherLines (delete old, create new)
  - Create audit log entry
- `DELETE`: Delete draft voucher
  - Permission: `requirePermission(request, 'vouchers', 'WRITE')`
  - Validate: Voucher status is DRAFT
  - Delete cascade (voucherLines will be deleted)
  - Create audit log entry

#### 14. `apps/web/app/api/vouchers/[id]/post/route.ts`
- `POST`: Post a draft voucher
  - Permission: `requirePermission(request, 'vouchers', 'POST')`
  - Validate: Voucher status is DRAFT
  - Validate: debit == credit
  - Validate: All accounts are active
  - Set status to POSTED
  - Set postedAt and postedByUserId
  - Create audit log entry

#### 15. `apps/web/lib/audit.ts` (NEW UTILITY)
- `createAuditLog(companyId, userId, action, resource, resourceId, details?, request?)`
- Helper function to create audit log entries
- Extract IP address and user agent from request if available

#### 16. `apps/web/lib/voucher.ts` (NEW UTILITY)
- `validateVoucherBalance(lines: VoucherLine[]): boolean`
  - Check debit == credit
- `generateVoucherNumber(companyId, date): Promise<string>`
  - Generate unique voucher number: VOUCH-YYYYMMDD-####
- `canEditVoucher(voucher): boolean`
  - Return true if status is DRAFT

### UI Pages & Components

#### 17. `apps/web/app/dashboard/chart-of-accounts/page.tsx`
- Server component
- Use `requirePermissionServer('chartOfAccounts', 'READ')`
- Fetch accounts, filter by active by default
- Pass to client component

#### 18. `apps/web/app/dashboard/chart-of-accounts/components/ChartOfAccountsList.tsx`
- Client component
- Display accounts in tree/hierarchical structure
- Show: code, name, type, balance (if calculable)
- Filter by type, search by code/name
- Actions: Edit, Delete (if canWrite)
- Link to account detail or inline edit

#### 19. `apps/web/app/dashboard/chart-of-accounts/components/CreateAccountForm.tsx`
- Client component
- Form: code, name, type (dropdown), parentId (dropdown), description
- Validate code uniqueness
- Submit to POST /api/chart-of-accounts

#### 20. `apps/web/app/dashboard/chart-of-accounts/components/types.ts`
- TypeScript types for components

#### 21. `apps/web/app/dashboard/vouchers/page.tsx`
- Server component
- Use `requirePermissionServer('vouchers', 'READ')`
- Fetch vouchers with filters from query params
- Pagination support
- Pass to client component

#### 22. `apps/web/app/dashboard/vouchers/components/VouchersList.tsx`
- Client component
- Table: voucherNumber, date, type, status, totalAmount, createdBy, postedBy, postedAt
- Filters: status (DRAFT/POSTED), type, date range, search
- Actions: View, Edit (if DRAFT), Delete (if DRAFT), Post (if DRAFT and canPost)
- Link to voucher detail page

#### 23. `apps/web/app/dashboard/vouchers/components/CreateVoucherForm.tsx`
- Client component
- Form sections:
  - Header: type, date, reference, description, narration
  - Lines table: account (dropdown), debit, credit, description
  - Add/remove lines dynamically
  - Real-time validation: debit == credit
  - Submit to POST /api/vouchers (creates as DRAFT)

#### 24. `apps/web/app/dashboard/vouchers/components/types.ts`
- TypeScript types for components

#### 25. `apps/web/app/dashboard/vouchers/[id]/page.tsx`
- Server component
- Use `requirePermissionServer('vouchers', 'READ')`
- Fetch voucher by ID with all lines
- Check if editable (status === DRAFT)
- Check if canPost (permission check)
- Render view component or edit component based on status

#### 26. `apps/web/app/dashboard/vouchers/[id]/components/VoucherDetail.tsx`
- Client component
- Display voucher header: number, date, type, status, reference, description, narration
- Display voucher lines table: account, debit, credit, description
- Display totals: Total Debit, Total Credit
- Display metadata: createdBy, createdAt, postedBy, postedAt
- Actions:
  - Edit button (only if DRAFT)
  - Post button (only if DRAFT and canPost)
  - Print button
  - Back to list

#### 27. `apps/web/app/dashboard/vouchers/[id]/components/VoucherEditForm.tsx`
- Client component
- Similar to CreateVoucherForm but for editing
- Pre-populate with existing data
- Validate: cannot edit POSTED vouchers (disabled form with message)
- Submit to PATCH /api/vouchers/[id]

#### 28. `apps/web/app/dashboard/vouchers/[id]/components/VoucherPrint.tsx`
- Client component
- Print-friendly layout
- Company header, voucher details, lines table
- Print styling (hide buttons, optimize layout)

#### 29. `apps/web/app/dashboard/vouchers/new/page.tsx`
- Server component
- Check WRITE permission
- Render CreateVoucherForm component

### Seed Data

#### 30. `packages/db/prisma/seed.ts`
- Update existing seed file
- Add default Chart of Accounts for each company:
  - Assets (1000-1999)
    - 1000: Cash
    - 1100: Bank Accounts
    - 1200: Accounts Receivable
    - 1300: Inventory
    - 1400: Fixed Assets
  - Liabilities (2000-2999)
    - 2000: Accounts Payable
    - 2100: Loans
    - 2200: Accrued Expenses
  - Equity (3000-3999)
    - 3000: Capital
    - 3100: Retained Earnings
  - Revenue (4000-4999)
    - 4000: Sales Revenue
    - 4100: Other Income
  - Expenses (5000-5999)
    - 5000: Cost of Goods Sold
    - 5100: Operating Expenses
    - 5200: Administrative Expenses
    - 5300: Financial Expenses

---

## Route Handler List

### Chart of Accounts
- `GET /api/chart-of-accounts` - List accounts (with filters)
- `POST /api/chart-of-accounts` - Create account
- `GET /api/chart-of-accounts/[id]` - Get account by ID
- `PATCH /api/chart-of-accounts/[id]` - Update account
- `DELETE /api/chart-of-accounts/[id]` - Delete account (soft delete)

### Vouchers
- `GET /api/vouchers` - List vouchers (with filters, pagination)
- `POST /api/vouchers` - Create draft voucher
- `GET /api/vouchers/[id]` - Get voucher by ID
- `PATCH /api/vouchers/[id]` - Update draft voucher
- `DELETE /api/vouchers/[id]` - Delete draft voucher
- `POST /api/vouchers/[id]/post` - Post voucher

---

## UI Routes List

### Chart of Accounts
- `/dashboard/chart-of-accounts` - List all accounts (hierarchical view)
- `/dashboard/chart-of-accounts/new` - Create new account (modal or page)
- `/dashboard/chart-of-accounts/[id]` - View/edit account (optional)

### Vouchers
- `/dashboard/vouchers` - List vouchers with filters
- `/dashboard/vouchers/new` - Create new voucher (draft)
- `/dashboard/vouchers/[id]` - View voucher detail (with print option)
  - Edit form (only if DRAFT)
  - Post button (only if DRAFT and has permission)

---

## Seed Plan for Default Chart of Accounts

### Account Structure

```typescript
const defaultAccounts = [
  // Assets (1000-1999)
  { code: '1000', name: 'Cash', type: 'ASSET' },
  { code: '1100', name: 'Bank Accounts', type: 'ASSET' },
  { code: '1200', name: 'Accounts Receivable', type: 'ASSET' },
  { code: '1300', name: 'Inventory', type: 'ASSET' },
  { code: '1400', name: 'Fixed Assets', type: 'ASSET' },
  
  // Liabilities (2000-2999)
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
  { code: '2100', name: 'Loans', type: 'LIABILITY' },
  { code: '2200', name: 'Accrued Expenses', type: 'LIABILITY' },
  
  // Equity (3000-3999)
  { code: '3000', name: 'Capital', type: 'EQUITY' },
  { code: '3100', name: 'Retained Earnings', type: 'EQUITY' },
  
  // Revenue (4000-4999)
  { code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
  { code: '4100', name: 'Other Income', type: 'REVENUE' },
  
  // Expenses (5000-5999)
  { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
  { code: '5100', name: 'Operating Expenses', type: 'EXPENSE' },
  { code: '5200', name: 'Administrative Expenses', type: 'EXPENSE' },
  { code: '5300', name: 'Financial Expenses', type: 'EXPENSE' },
];
```

### Implementation in seed.ts
- Loop through all companies (currently just "Default Company")
- For each company, check if accounts exist
- Create accounts if they don't exist
- Use upsert pattern with unique constraint (companyId + code)

---

## Test Checklist

### Database & Schema
- [ ] Prisma schema validates without errors
- [ ] Migration runs successfully
- [ ] All relations work correctly (Company, User, ChartOfAccount, Voucher, VoucherLine, AuditLog)
- [ ] Unique constraints work (companyId + code for accounts, companyId + voucherNumber for vouchers)
- [ ] Cascade deletes work (voucherLines when voucher deleted)

### Chart of Accounts API
- [ ] GET /api/chart-of-accounts - Lists accounts scoped to company
- [ ] GET /api/chart-of-accounts - Filters work (q, type, active, parentId)
- [ ] POST /api/chart-of-accounts - Creates account with companyId from auth
- [ ] POST /api/chart-of-accounts - Rejects duplicate code in same company
- [ ] POST /api/chart-of-accounts - Validates parentId belongs to same company
- [ ] GET /api/chart-of-accounts/[id] - Returns account if belongs to company
- [ ] GET /api/chart-of-accounts/[id] - Returns 404 if wrong company
- [ ] PATCH /api/chart-of-accounts/[id] - Updates account
- [ ] PATCH /api/chart-of-accounts/[id] - Prevents code change if used in posted vouchers
- [ ] DELETE /api/chart-of-accounts/[id] - Soft deletes (sets isActive=false)
- [ ] DELETE /api/chart-of-accounts/[id] - Prevents delete if used in posted vouchers
- [ ] All endpoints reject requests without proper RBAC permissions

### Voucher API
- [ ] GET /api/vouchers - Lists vouchers scoped to company
- [ ] GET /api/vouchers - Filters work (status, type, dateFrom, dateTo, q)
- [ ] GET /api/vouchers - Pagination works
- [ ] POST /api/vouchers - Creates draft voucher
- [ ] POST /api/vouchers - Auto-generates unique voucherNumber
- [ ] POST /api/vouchers - Validates debit == credit
- [ ] POST /api/vouchers - Rejects if debit != credit
- [ ] POST /api/vouchers - Validates all accounts belong to company
- [ ] POST /api/vouchers - Validates all accounts are active
- [ ] POST /api/vouchers - Requires at least 2 voucher lines
- [ ] GET /api/vouchers/[id] - Returns voucher with lines
- [ ] GET /api/vouchers/[id] - Returns 404 if wrong company
- [ ] PATCH /api/vouchers/[id] - Updates draft voucher
- [ ] PATCH /api/vouchers/[id] - Blocks edit of POSTED voucher
- [ ] PATCH /api/vouchers/[id] - Validates debit == credit on update
- [ ] DELETE /api/vouchers/[id] - Deletes draft voucher
- [ ] DELETE /api/vouchers/[id] - Blocks delete of POSTED voucher
- [ ] POST /api/vouchers/[id]/post - Posts draft voucher
- [ ] POST /api/vouchers/[id]/post - Blocks posting POSTED voucher
- [ ] POST /api/vouchers/[id]/post - Sets postedAt and postedByUserId
- [ ] All endpoints reject requests without proper RBAC permissions

### Audit Logging
- [ ] Audit log created on account CREATE
- [ ] Audit log created on account UPDATE
- [ ] Audit log created on account DELETE
- [ ] Audit log created on voucher CREATE
- [ ] Audit log created on voucher UPDATE
- [ ] Audit log created on voucher POST
- [ ] Audit log includes correct companyId, userId, action, resource, resourceId
- [ ] Audit log captures IP address and user agent when available

### RBAC
- [ ] ADMIN can READ vouchers/accounts
- [ ] ADMIN can WRITE vouchers/accounts
- [ ] ADMIN can POST vouchers
- [ ] ACCOUNTANT can READ vouchers/accounts
- [ ] ACCOUNTANT can WRITE vouchers/accounts
- [ ] ACCOUNTANT can POST vouchers
- [ ] ENGINEER can READ vouchers/accounts
- [ ] ENGINEER cannot WRITE vouchers/accounts
- [ ] ENGINEER cannot POST vouchers
- [ ] DATA_ENTRY can READ vouchers/accounts
- [ ] DATA_ENTRY cannot WRITE vouchers/accounts
- [ ] DATA_ENTRY cannot POST vouchers
- [ ] VIEWER can READ vouchers/accounts
- [ ] VIEWER cannot WRITE vouchers/accounts
- [ ] VIEWER cannot POST vouchers

### UI Pages - Chart of Accounts
- [ ] /dashboard/chart-of-accounts - Displays accounts list
- [ ] /dashboard/chart-of-accounts - Shows hierarchical structure
- [ ] /dashboard/chart-of-accounts - Filters work (type, search)
- [ ] /dashboard/chart-of-accounts - Create button visible only if canWrite
- [ ] /dashboard/chart-of-accounts/new - Create form works
- [ ] /dashboard/chart-of-accounts - Edit/Delete buttons visible only if canWrite
- [ ] /dashboard/chart-of-accounts - Page redirects to /forbidden if no READ permission

### UI Pages - Vouchers
- [ ] /dashboard/vouchers - Displays voucher list
- [ ] /dashboard/vouchers - Filters work (status, type, date range)
- [ ] /dashboard/vouchers - Pagination works
- [ ] /dashboard/vouchers - Create button visible only if canWrite
- [ ] /dashboard/vouchers/new - Create form works
- [ ] /dashboard/vouchers/new - Real-time debit/credit validation
- [ ] /dashboard/vouchers/new - Can add/remove lines dynamically
- [ ] /dashboard/vouchers/[id] - Displays voucher detail
- [ ] /dashboard/vouchers/[id] - Shows all lines with totals
- [ ] /dashboard/vouchers/[id] - Edit button only visible if DRAFT and canWrite
- [ ] /dashboard/vouchers/[id] - Post button only visible if DRAFT and canPost
- [ ] /dashboard/vouchers/[id] - Print button works
- [ ] /dashboard/vouchers/[id]/edit - Edit form pre-populated
- [ ] /dashboard/vouchers/[id]/edit - Blocks editing POSTED vouchers
- [ ] /dashboard/vouchers - Page redirects to /forbidden if no READ permission

### Seed Data
- [ ] Seed creates default chart of accounts for existing companies
- [ ] Seed doesn't duplicate accounts if run multiple times
- [ ] All default accounts are active
- [ ] Account codes follow numbering scheme (1000-5999)

### Data Integrity
- [ ] Cannot create voucher with accounts from different company
- [ ] Cannot create voucher with inactive accounts
- [ ] Cannot post voucher with debit != credit
- [ ] Cannot edit posted voucher
- [ ] Cannot delete posted voucher
- [ ] Cannot change account code if used in posted vouchers
- [ ] Cannot delete account if used in posted vouchers
- [ ] All data scoped to companyId from auth (never from client)

### Edge Cases
- [ ] Voucher with 0.01 difference (tolerance) is accepted
- [ ] Very large voucher amounts handled correctly
- [ ] Voucher number generation handles high volume
- [ ] Date filters handle timezone correctly
- [ ] Pagination with empty results works
- [ ] Search with no results shows appropriate message

---

## Implementation Order

### Phase 2.1: Database & Schemas (Foundation)
1. Update Prisma schema
2. Create migration
3. Update shared schemas
4. Update permissions

### Phase 2.2: Chart of Accounts (Backend)
5. Chart of Accounts API routes
6. Audit logging utility
7. Seed default accounts

### Phase 2.3: Chart of Accounts (Frontend)
8. Chart of Accounts UI pages and components

### Phase 2.4: Voucher Engine (Backend)
9. Voucher utility functions
10. Voucher API routes
11. Post voucher endpoint

### Phase 2.5: Voucher Engine (Frontend)
12. Voucher list page
13. Create voucher form
14. Voucher detail/view page
15. Voucher edit functionality
16. Print functionality

### Phase 2.6: Testing & Polish
17. Run through test checklist
18. Fix any issues
19. UI/UX polish

---

## Notes

- All voucher numbers follow format: `VOUCH-YYYYMMDD-####` (e.g., VOUCH-20250120-0001)
- Debit/Credit validation tolerance: 0.01 (to handle floating point precision issues)
- Posted vouchers are immutable (for now) - future phase will add reversal functionality
- Chart of Accounts supports hierarchical structure but initial implementation may show flat list
- Audit logs are created for all mutations but viewing audit logs UI may be added in future phase
- Voucher posting is a single-step process (no approval workflow in Phase 2)
