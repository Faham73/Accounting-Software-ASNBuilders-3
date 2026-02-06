# Project Overview for AI Agents

**Purpose:** This document helps an AI agent understand what this project is, how far it has progressed, what exists today, and what to do next.

---

## 1. What This Project Is

**Accounting Software 2** is a **construction accounting web app** built with:

- **Next.js** (App Router)
- **PostgreSQL** (via Prisma ORM)
- **npm** workspaces (monorepo: `apps/web`, `packages/db`, `packages/shared`)

It is **multi-tenant**: every user belongs to a **Company**. All data (projects, vendors, vouchers, etc.) is **scoped by `companyId`**. The app **never** trusts `companyId` from the client; it always comes from the authenticated user (`auth.companyId`).

---

## 2. Tech Stack & Repo Layout

| Layer | Tech | Location |
|-------|------|----------|
| Frontend | Next.js 14+ (App Router), React, Tailwind | `apps/web/` |
| API | Next.js Route Handlers (REST) | `apps/web/app/api/` |
| Auth | JWT in httpOnly cookie | `apps/web/lib/auth.ts` |
| RBAC | Role-based permissions | `apps/web/lib/permissions.ts`, `lib/rbac.ts` |
| DB | PostgreSQL + Prisma | `packages/db/` |
| Shared | Zod schemas, types | `packages/shared/` |

**Key scripts (from project root):**

- `npm run dev` — start Next.js dev server  
- `npm run build` / `npm run start` — production  
- `npm run db:generate` — regenerate Prisma client  
- `npm run db:migrate` — run migrations  
- `npm run db:seed` — seed DB  
- `npm run db:up` / `npm run db:down` — Docker PostgreSQL  
- `npm run prisma:studio` — Prisma Studio  

**Default login:** `admin@example.com` / `123456`

---

## 3. Progress: What’s Done vs. What’s Next

### Phase 0 – Foundation ✅  
- Next.js app, PostgreSQL, Docker, Prisma, JWT auth, login/logout, basic dashboard.

### Phase 1 – Multi-Company + Master Data ✅  
- **Companies**, **Projects**, **Vendors**, **Cost Heads**, **Payment Methods**, **Attachments**.  
- All company-scoped; RBAC enforced on APIs and UI.  
- CRUD APIs + dashboard pages for each master data entity.  
- Seed: default company, users (admin, accountant, data entry, viewer, engineer), cost heads, payment methods.

### Phase 2 – Accounting Backbone (Voucher Engine) ✅ **COMPLETE**  
- **Schema:** ✅ Done. `Account`, `Voucher`, `VoucherLine`, `AuditLog` + enums (`VoucherType`, `VoucherStatus`, `AccountType`) are in `schema.prisma`.  
- **Migration:** ⚠️ **Not yet applied.** A Phase 2 migration exists in concept but may need to be created/run (see “What to do next”).  
- **APIs:** ❌ Not built. No `/api/accounts`, `/api/vouchers`, etc.  
- **UI:** ❌ Not built. No Chart of Accounts page, Voucher list/create/view, or Post action.  
- **Seed:** Placeholder only (TODO for default Chart of Accounts). No account seeding yet.

### Phase 3 – Project Ledger + Cost Tracking ✅ **COMPLETE**
- **Schema:** ✅ Added `ProjectCostCategory` enum and `ProjectCostCategoryMap` model.
- **Migration:** ✅ Applied. Migration `20260123075403_add_phase3_project_cost_category_map` creates mapping table and indexes.
- **APIs:** ✅ Built.
  - `GET /api/projects/[id]/ledger` - Project ledger with filters (date, vendor, cost head, category, payment method, account, type) and pagination. **Only POSTED vouchers.**
  - `GET /api/projects/[id]/cost-summary` - Cost summary grouped by category (CIVIL, MATERIALS, MATI_KATA, DHALAI, OTHERS). **Only expense lines from POSTED vouchers.**
- **UI:** ✅ Built.
  - `/dashboard/projects/[id]/ledger` - Ledger view with filters, table, totals, pagination.
  - `/dashboard/projects/[id]/cost-summary` - Cost summary table with CSV export.
- **Seed:** ✅ Default cost category mappings seeded (Materials→MATERIALS, Labor→CIVIL, etc.).

### Future Phases (Not Started)
- Additional reports and analytics.
- Posted-voucher reversal option.

---

## 4. Features Implemented So Far

### Authentication & Authorization  
- **Login** (`/login`): email + password → JWT stored in httpOnly cookie.  
- **Logout** (`/api/auth/logout`): clears cookie.  
- **Me** (`/api/auth/me`): returns current user (used by frontend).  
- **Middleware:** Protects `/dashboard` and sub-routes; redirects to `/login` if unauthenticated.  
- **RBAC:** `requireAuth`, `requirePermission`, `requireAuthServer`, `requirePermissionServer` in `lib/rbac.ts`.  
- **Roles:** `ADMIN`, `ACCOUNTANT`, `ENGINEER`, `DATA_ENTRY`, `VIEWER`.  
- **Resources (Phase 1):** `companies`, `projects`, `vendors`, `costHeads`, `paymentMethods`.  
- **Actions:** `READ`, `WRITE`. Permissions defined in `lib/permissions.ts`.

### Companies (Admin-only)  
- **APIs:** `GET/POST /api/companies`, `GET/PATCH/DELETE /api/companies/[id]`.  
- **UI:** `/dashboard/companies` — list, create.  
- **Scoping:** All by `auth.companyId` (companies resource is special; typically admin views/manages).

### Projects  
- **APIs:** `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/[id]`.  
- **UI:** `/dashboard/projects`, `/dashboard/projects/new`, `/dashboard/projects/[id]`.  
- **Features:** Client name, site location, contract value, status (DRAFT/RUNNING/COMPLETED/CLOSED), attachments.  
- **RBAC:** READ — all roles; WRITE — ADMIN, ACCOUNTANT.

### Vendors  
- **APIs:** `GET/POST /api/vendors`, `GET/PATCH/DELETE /api/vendors/[id]`.  
- **UI:** `/dashboard/vendors`.  
- **RBAC:** Same as projects.

### Cost Heads  
- **APIs:** `GET/POST /api/cost-heads`, `GET/PATCH/DELETE /api/cost-heads/[id]`.  
- **UI:** `/dashboard/cost-heads`.  
- **RBAC:** Same as projects.

### Payment Methods  
- **APIs:** `GET/POST /api/payment-methods`, `GET/PATCH/DELETE /api/payment-methods/[id]`.  
- **UI:** `/dashboard/payment-methods`.  
- **RBAC:** Same as projects.

### Attachments  
- **API:** `POST /api/attachments` (and likely list).  
- **Usage:** Linked to projects (e.g. `AttachmentUploader` in project form).  
- **Storage:** URL-based (implementation may use local path or external storage).

### Project Ledger & Cost Tracking (Phase 3)  
- **APIs:** 
  - `GET /api/projects/[id]/ledger` - Returns all posted voucher lines for a project with filters (date range, vendor, cost head, category, payment method, account, type). Includes pagination and totals. **Hard rule: Only POSTED vouchers.**
  - `GET /api/projects/[id]/cost-summary` - Returns cost summary grouped by project cost categories. **Hard rule: Only expense lines from POSTED vouchers.**
- **UI:** 
  - `/dashboard/projects/[id]/ledger` - Full ledger view with comprehensive filters, sortable table, totals row, pagination.
  - `/dashboard/projects/[id]/cost-summary` - Summary table matching "Total Cost" PDF structure, with CSV export.
- **Data Model:** 
  - `ProjectCostCategoryMap` maps `CostHead` to categories (CIVIL, MATERIALS, MATI_KATA, DHALAI, OTHERS).
  - Cost calculation: `debit - credit` per line (returns reduce cost).
  - Project matching: Prefer `line.projectId`, fallback to `voucher.projectId` if line has null projectId.

### Forbidden & Layout  
- **`/forbidden`:** Shown when user lacks permission.  
- **Dashboard layout:** Sidebar with Dashboard, Companies, Projects, Vendors, Cost Heads, Payment Methods. Links respect RBAC (e.g. Companies only for admin).

---

## 5. Database: Current Schema (Summary)

**Enums:**  
`UserRole`, `ProjectStatus`, `PaymentMethodType`, `VoucherType`, `VoucherStatus`, `AccountType`.

**Phase 1 models (tables):**  
`Company`, `User`, `Project`, `Vendor`, `CostHead`, `PaymentMethod`, `Attachment`.  
All company-scoped where applicable.

**Phase 2 models:**  
- **Account:** Chart of accounts. `companyId`, `code`, `name`, `type` (ASSET/LIABILITY/INCOME/EXPENSE/EQUITY), `parentId` (self), `isActive`.  
- **Voucher:** `companyId`, `projectId?`, `voucherNo`, `date`, `status` (DRAFT/POSTED), `narration`, `createdByUserId`, `postedByUserId?`, `postedAt?`.  
- **VoucherLine:** `voucherId`, `companyId`, `accountId`, `projectId?`, `vendorId?`, `costHeadId?`, `paymentMethodId?`, `description`, `debit`, `credit`.  
- **AuditLog:** `companyId`, `entityType`, `entityId`, `action`, `actorUserId`, `before?`, `after?`.

**Phase 3 models:**  
- **ProjectCostCategoryMap:** Maps cost heads to project cost categories. `companyId`, `costHeadId`, `category` (CIVIL/MATERIALS/MATI_KATA/DHALAI/OTHERS), `isActive`.

**Conventions:**  
- `companyId` on all tenant data.  
- No `companyId` from client; always from auth.  
- FK relations: User → Company; Project/Vendor/CostHead/PaymentMethod/Attachment → Company; Account/Voucher/VoucherLine/AuditLog → Company; etc.

---

## 6. File Structure (Relevant Parts)

```
accounting_software_2/
├── package.json                 # Root scripts, workspaces
├── docker-compose.yml           # PostgreSQL
├── README.md                    # Setup, first run
├── PROJECT_OVERVIEW_FOR_AI.md   # This file
├── PHASE1_IMPLEMENTATION_PLAN.md
├── PHASE2_IMPLEMENTATION_PLAN.md
├── COMPANIES_MODULE_TEST_CHECKLIST.md
├── RBAC_TEST_CHECKLIST.md
├── MASTER_DATA_API_*.md
├── ATTACHMENTS_TEST_CHECKLIST.md
│
├── apps/web/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/login|logout|me/
│   │   │   ├── companies/     [+ route.ts, [id]/route.ts]
│   │   │   ├── projects/      [+ route.ts, [id]/route.ts]
│   │   │   ├── vendors/       [+ route.ts, [id]/route.ts]
│   │   │   ├── cost-heads/    [+ route.ts, [id]/route.ts]
│   │   │   ├── payment-methods/[+ route.ts, [id]/route.ts]
│   │   │   ├── chart-of-accounts/[+ route.ts, [id]/route.ts]
│   │   │   ├── vouchers/      [+ route.ts, [id]/route.ts, [id]/post/route.ts]
│   │   │   ├── projects/[id]/ledger/ [route.ts]
│   │   │   ├── projects/[id]/cost-summary/ [route.ts]
│   │   │   └── attachments/   [route.ts]
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── companies/     [page, components]
│   │   │   ├── projects/      [page, new, [id], components]
│   │   │   ├── vendors/       [page, components]
│   │   │   ├── cost-heads/    [page, components]
│   │   │   ├── payment-methods/[page, components]
│   │   │   ├── chart-of-accounts/ [page, new, components]
│   │   │   ├── vouchers/      [page, new, [id], components]
│   │   │   ├── projects/[id]/ledger/ [page, ProjectLedgerClient]
│   │   │   ├── projects/[id]/cost-summary/ [page, ProjectCostSummaryClient]
│   │   │   └── components/    [DashboardLayout, logout-button, types]
│   │   ├── login/page.tsx
│   │   ├── forbidden/page.tsx
│   │   ├── layout.tsx, globals.css, page.tsx
│   ├── lib/
│   │   ├── auth.ts            # JWT sign/verify, getAuthUser, cookie options
│   │   ├── rbac.ts            # requireAuth, requirePermission, etc.
│   │   └── permissions.ts     # Resource/Action, can()
│   ├── middleware.ts          # Protect /dashboard, redirect to /login
│   └── next.config.js, tailwind, etc.
│
└── packages/
    ├── db/
    │   ├── prisma/
    │   │   ├── schema.prisma   # Full schema including Phase 2
    │   │   ├── seed.ts         # Company, users, cost heads, payment methods; TODO accounts
    │   │   └── migrations/     # Phase 1 migrations; Phase 2 TBD
    │   └── src/client.ts       # Prisma client + enum exports
    │
    └── shared/
        └── src/
            ├── index.ts        # Re-exports all schemas
            └── schemas/
                ├── company.ts
                ├── project.ts
                ├── vendor.ts
                ├── costHead.ts
                ├── paymentMethod.ts
                ├── account.ts
                ├── voucher.ts
                ├── projectLedger.ts
                └── attachment.ts
```

**Phase 2 & 3 files:**  
- ✅ `app/api/chart-of-accounts`, `app/api/vouchers`, etc.  
- ✅ `app/dashboard/chart-of-accounts`, `app/dashboard/vouchers`, etc.  
- ✅ `lib/audit.ts` and `lib/voucher.ts`.  
- ✅ `Account`/`Voucher`/`ProjectLedger` Zod schemas in `packages/shared`.

---

## 7. What to Do Next (Recommended Order)

**Phase 2 & 3 are complete.** Future work may include:

1. **Additional Reports & Analytics**
   - Financial statements (Balance Sheet, P&L).
   - Project profitability analysis.
   - Vendor payment tracking.

2. **Voucher Reversal**
   - Allow reversal of posted vouchers (create contra entries).
   - Maintain audit trail.

3. **Advanced Cost Tracking**
   - Budget vs. actual comparisons.
   - Cost forecasting.
   - Multi-project cost allocation.

4. **Performance Optimizations**
   - Caching for frequently accessed reports.
   - Database query optimization for large datasets.
   - Pagination improvements for very large ledgers.

---

## 8. Rules to Follow

- **Multi-tenancy:** Always scope by `auth.companyId`. Never use `companyId` from request body or query.
- **RBAC:** Use `requirePermission(request, resource, action)` in API routes and `requirePermissionServer(resource, action)` in server components. Redirect to `/forbidden` when lacking permission.
- **Validation:** Use Zod schemas from `@accounting/shared` for API inputs.
- **Audit:** Log create/update/post (and possibly delete) for vouchers and accounts in `AuditLog`.
- **Vouchers:** Enforce `debit === credit` (with small tolerance if needed). Only POSTED vouchers affect reports. Block editing posted vouchers (reversal later).
- **Phase 3 Reporting:** All ledger and cost summary queries **must** filter by `voucher.status = POSTED`. Never include DRAFT vouchers in reports. All totals computed from `VoucherLine` (joined with `Voucher` and `Account`), never from cached numbers.

---

## 9. Quick Reference: Roles & Permissions (Phase 1)

| Resource        | READ | WRITE |
|----------------|------|-------|
| companies      | ADMIN | ADMIN |
| projects       | ADMIN, ACCOUNTANT, ENGINEER, DATA_ENTRY, VIEWER | ADMIN, ACCOUNTANT |
| vendors        | same as projects | ADMIN, ACCOUNTANT |
| costHeads      | same | ADMIN, ACCOUNTANT |
| paymentMethods | same | ADMIN, ACCOUNTANT |

Phase 2 will add `chartOfAccounts` and `vouchers` with similar READ for all and WRITE/POST for ADMIN and ACCOUNTANT (see PHASE2_IMPLEMENTATION_PLAN.md).

---

*This overview is intended for AI agents (or new devs) to onboard quickly and continue implementation correctly.*
