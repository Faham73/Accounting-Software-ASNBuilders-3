# Debit Structure & Behavior — Answers

## 1. Current DB structure for debit

**There is no separate `Debit` table.** Debit amounts are stored as rows on **`VoucherLine`**.

- **Table:** `voucher_lines` (Prisma model `VoucherLine`)
- **Parent:** Each line belongs to one `Voucher` (`vouchers` table).

Relevant schema (from `packages/db/prisma/schema.prisma`):

```prisma
model VoucherLine {
  id             String   @id @default(cuid())
  voucherId      String   @map("voucher_id")
  companyId      String   @map("company_id")
  accountId      String   @map("account_id")
  description    String?
  debit          Decimal  @default(0) @db.Decimal(18, 2)
  credit         Decimal  @default(0) @db.Decimal(18, 2)
  projectId      String?  @map("project_id")
  isCompanyLevel Boolean  @default(false) @map("is_company_level")
  vendorId       String?  @map("vendor_id")
  paymentMethodId String? @map("payment_method_id")
  // PDF fields
  workDetails    String?  @map("work_details")
  paidBy         String?  @map("paid_by")
  receivedBy     String?  @map("received_by")
  fileRef        String?  @map("file_ref")
  voucherRef     String?  @map("voucher_ref")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  // relations: voucher, company, account, project?, vendor?, paymentMethod?
}
```

**Voucher** (header) has: `companyId`, `projectId?`, `voucherNo`, `date`, `status`, `narration`, `expenseType?`, workflow fields, etc. **Date** is on the voucher, not on the line.

---

## 2. Which table stores debit rows?

**`VoucherLine`** stores debit rows. Each row has `debit` and `credit`; a “debit row” in the UI is a line where `debit > 0`.

- **companyId** — yes (`VoucherLine.companyId`)
- **projectId** — yes, nullable (`VoucherLine.projectId`)
- **subProjectId** — **no**; there is no `subProjectId` on `VoucherLine`
- **voucherId** — yes (`VoucherLine.voucherId`)
- **amount** — stored as `debit` (and `credit` for the other side)
- **date** — on **Voucher** (`voucher.date`), not on the line
- **description** — yes (`VoucherLine.description`)
- Plus: `accountId`, `isCompanyLevel`, `vendorId`, `paymentMethodId`, and PDF fields (`workDetails`, `paidBy`, `receivedBy`, `fileRef`, `voucherRef`)

---

## 3. Is subProjectId stored separately or only via projectId?

**Only via projectId.** There is no `subProjectId` on `VoucherLine` or `Voucher`.

- Subprojects are **Project** records with `parentProjectId` set (parent = main project).
- A line is attached to “a project” via **`VoucherLine.projectId`** — that project can be a main project or a subproject (both are `Project` rows).
- So “subproject debit” = line with `projectId` = the subproject’s project id.

---

## 4. How are debits created right now?

Debits are created only as **voucher lines** when creating or editing vouchers:

1. **Manual vouchers:** **POST /api/vouchers** — creates a **Voucher** and its **VoucherLines** in one transaction. User sends `lines[]` with `accountId`, `debit`, `credit`, `projectId?`, etc.
2. **Expenses:** **POST /api/expenses** — creates an **Expense**, one **Voucher** (with two lines: one debit, one credit), and links the expense to that voucher. This is the only flow that creates a voucher with **POSTED** status directly.
3. **Import:** Import flow creates vouchers (and thus lines) as **DRAFT**.

There is **no** dedicated **POST /api/debit** (or similar). The debit list is read-only from the debit page; creation is via vouchers (or expenses).

---

## 5. Which API route creates a debit?

- **POST /api/vouchers** — creates a **Voucher + VoucherLines** (including debit lines). Body includes `lines[]` with `debit`/`credit`, `accountId`, `projectId?`, etc.
- **POST /api/expenses** — creates an **Expense** and a **Voucher** with two lines (one debit to expense account, one credit to payment account); that voucher is created **POSTED**.

So: **Yes**, creation is “Voucher + VoucherLines”; there is no separate “create debit” endpoint.

---

## 6. What default accounts does it post to for debit/credit?

- **Manual vouchers (POST /api/vouchers):** No default accounts. The user chooses accounts (and debit/credit per line) in **CreateVoucherForm**; the API validates that accounts exist and belong to the company.
- **Expenses (POST /api/expenses):** The request body has **debitAccountId** (expense account) and **creditAccountId** (payment account, e.g. Cash/Bank). Those are the two accounts used for the two voucher lines. So “default” for expenses is whatever the user selects as debit and credit accounts for that expense.

---

## 7. Why can’t you edit debit rows?

Because **voucher lines** are only editable when the **voucher** is **DRAFT**. Once the voucher is SUBMITTED / APPROVED / POSTED / REVERSED, the line cannot be edited (or deleted) via the normal PATCH/DELETE voucher-line APIs.

---

## 8. Where is this error thrown?

**“Cannot edit voucher line. Voucher status is POSTED. Only DRAFT vouchers can be edited.”**

- **File:** `apps/web/app/api/voucher-lines/[lineId]/route.ts`
- **Handler:** **PATCH** (update voucher line), around line 51–57.
- **Logic:** After loading the voucher line and its voucher, it calls `canEditVoucher(voucherLine.voucher.status)`. That is `status === 'DRAFT'`. If not DRAFT, it returns 400 with the message above.

The same file’s **DELETE** handler returns a similar message: **“Cannot delete voucher line. Voucher status is … . Only DRAFT vouchers can be edited.”**

---

## 9. Is every debit automatically POSTED on create? Or DRAFT then POST?

- **Manual vouchers (POST /api/vouchers):** Created with **status: 'DRAFT'**. They are **not** auto-posted; user must submit → approve → post (workflow).
- **Expenses (POST /api/expenses):** The voucher is created with **status: 'POSTED'** and `postedByUserId` / `postedAt` set. So expense debits are **POSTED** on create.
- **Import:** Vouchers (and thus debit lines) are created as **DRAFT**.

So: **Manual debit lines start DRAFT; expense debit lines are POSTED on create.**

---

## 10. How is “Total Debit” calculated for the project dashboard card?

- **Function:** `getProjectTotals(projectId, companyId)` in **`apps/web/lib/projects/projectTotals.server.ts`**.
- **Query:** It runs several aggregates in parallel. Debit is:

  ```ts
  prisma.voucherLine.aggregate({
    where: {
      projectId,  // PROJECT SCOPED
      companyId,
    },
    _sum: { debit: true },
  })
  ```

- So **Total Debit** = sum of `VoucherLine.debit` for that `companyId` and `projectId`. It does **not** filter by `debit > 0` (credit-only lines have `debit = 0`, so they don’t change the sum). It also **does not** filter by voucher status (DRAFT/POSTED/etc.) — all voucher lines for the project are included.

**Does it filter by projectId correctly?** Yes. The project dashboard loads totals via `ProjectDashboardClient`, which gets data from the project view; the server uses `getProjectTotals(projectId, companyId)`, and the debit aggregate is explicitly scoped by `projectId` and `companyId`.

---

## 11. How is the company “Total Debit” page built?

- **Route:** **/dashboard/debit** (page: `apps/web/app/dashboard/debit/page.tsx`, client: `DebitClient.tsx`).
- **API:** **GET /api/debit** (`apps/web/app/api/debit/route.ts`).
  - Lists voucher lines with `companyId` and `debit > 0`.
  - Optional query: `projectId`, `dateFrom`, `dateTo`, `page`, `pageSize`.
  - Totals come from **`getCompanyTotals(auth.companyId, filters.projectId)`** in the same route. So:
    - **Company-level (no project):** Same endpoint, no `projectId` → all company debit lines; total = company-wide debit sum.
    - **Filtered by project:** Same endpoint with `projectId` → list and total scoped to that project.

So the company “Total Debit” page uses the **same** endpoint as the project-filtered view; the only difference is whether `projectId` is passed.

---

## 12. Do you support “Company-level debit” (no project)?

**Yes.**

- **VoucherLine.projectId** is **nullable**. A line with `projectId = null` is company-level (and `isCompanyLevel` can be set accordingly).
- **Voucher.projectId** is also nullable (e.g. office expenses without a project).
- **GET /api/debit** does not require `projectId`; without it, you get all company debit lines (and company total). So company-level debit is supported.

Not every debit must be attached to a project.

---

## 13. Subproject relationship reality check

- **“Subproject”** is not a separate table. It is a **Project** row with **parentProjectId** set to the main project. So: main project has `parentProjectId = null`, subproject has `parentProjectId = <main project id>` (and `Project` has `isMain`, `parentProject`, `subProjects` relations).
- Debits attach via **VoucherLine.projectId** (and optionally voucher’s `projectId`). So:
  - To attach to the **main** project: `projectId` = main project id.
  - To attach to a **subproject**: `projectId` = subproject (child project) id.
- There is **no** `subProjectId` on `VoucherLine`; the only link is `projectId`, which can point to either a main or a child project.

---

## 14. Frontend routing

- **Company debit:** **/dashboard/debit** — single page for “Total Debit”; can optionally pass `?projectId=...` to filter (DebitClient reads `projectId` from URL/state and sends it to GET /api/debit).
- **Project debit:** There is **no** dedicated route like **/dashboard/projects/[id]/debit**. The project dashboard shows a “Total Debit” card that links to **/dashboard/debit** (without `projectId`). So from a project dashboard you currently go to the company debit page and see **all** company debits, not pre-filtered by that project. (By contrast, “Total Credit” links to `/dashboard/credit?projectId=${projectId}`.)
- **Subproject debit:** No separate subproject debit page; you would use the same **/dashboard/debit** with `projectId` = subproject id if you add that filter in the UI.

---

## 15. Permission / RBAC

- **Debit list (GET /api/debit):** `requirePermission(request, 'vouchers', 'READ')`.
- **Voucher line update/delete (PATCH/DELETE /api/voucher-lines/[lineId]):** `requirePermission(request, 'vouchers', 'WRITE')`.
- **Debit page (server):** `requirePermissionServer('vouchers', 'READ')`; failure redirects to `/forbidden`.

So debit listing uses **vouchers READ**; editing/deleting debit (voucher) lines uses **vouchers WRITE**. There are no extra “debit”-specific permissions; it’s all under **vouchers**.

---

## Summary table

| Topic | Answer |
|-------|--------|
| Table for debit rows | **VoucherLine** (no separate Debit table) |
| Key fields | companyId, projectId?, voucherId, accountId, debit, credit, description, date (on Voucher), PDF fields |
| subProjectId | Not stored; only projectId (can point to main or sub project) |
| Create debit | Via **POST /api/vouchers** (Voucher + VoucherLines) or **POST /api/expenses** |
| Default accounts | None for manual vouchers; for expenses: debitAccountId + creditAccountId from request |
| Edit blocked when | Voucher status ≠ DRAFT (error in **api/voucher-lines/[lineId]** PATCH/DELETE) |
| Auto POSTED? | Manual: DRAFT on create. Expenses: POSTED on create. |
| Total Debit (project card) | `getProjectTotals()` → `voucherLine.aggregate` by projectId + companyId, _sum debit |
| Company Total Debit page | **/dashboard/debit**, GET **/api/debit**, same endpoint with/without projectId |
| Company-level debit | Yes; projectId nullable on VoucherLine / Voucher |
| Subproject | Project with parentProjectId; debits use projectId only |
| Project debit route | No /dashboard/projects/[id]/debit; card links to /dashboard/debit (no projectId) |
| Permissions | vouchers READ (list), vouchers WRITE (edit/delete lines) |
