# New Purchase Page — Questions Answered (Before Implementation)

This document answers the questions raised before changing the New Purchase page. It is based on the current codebase and business logic.

---

## A) Purchase Line Items — What should each row represent now?

### A1) Should every row be treated as MATERIAL (no SERVICE/OTHER)?

**Recommendation: YES — treat every row as a material line.**

- **If YES:** We can stop using `lineType` in the **UI** and in **validation**. In the **DB/API** we have two options:
  - **Option A (minimal):** Keep the `lineType` column and enum in DB/API but always send/store `MATERIAL` for new/updated lines. No Prisma migration. Old SERVICE/OTHER records remain viewable.
  - **Option B (clean):** Remove `lineType` from the API payload and Zod schema; in DB keep the column with a default of `MATERIAL` (or migrate later to remove the enum). New UI only deals with “material name + qty + unit + rate + amount.”

- **If NO (keep SERVICE/OTHER):** “Typed text only” would mean: for MATERIAL you type the material name (no dropdown); for SERVICE/OTHER you keep typing description only. So we’d still need a way to distinguish line type (e.g. hidden or single dropdown) and different validation (e.g. SERVICE/OTHER might not have qty/unit/rate). The user explicitly asked to remove the “Line Type” column and to have users type material name manually, which points to **material-only lines**.

**Conclusion:** Treat every row as a material line. We can **ignore** `lineType` in the new UI (and always send `MATERIAL` from the form if we keep the field for backwards compatibility), or **remove** it from the schema/API and rely on DB default.

---

### A2) New columns per row (exact set)

| Column         | Type   | Notes |
|----------------|--------|--------|
| **Material Name** | Text   | Free text; user types. No dropdown. Replaces “Item/Description” (no selection from StockItem). |
| **Qty**        | Number | Required, > 0. |
| **Unit**       | Text   | Free text (e.g. "Pcs", "Kg"). No dropdown in codebase today for unit; keep as text input. |
| **Unit Rate**  | Number | Required, ≥ 0. |
| **Amount**     | Number | Auto: `Qty * Unit Rate`. Can be read-only in UI. |

**Additional fields (optional):**

- **Description / Notes** — Optional text per line (current `description` on `PurchaseLine`). Useful for brand, size, notes. Recommend keeping as one optional “Notes” or “Description” field.

**Summary:** Each row = **Material Name** (text) + **Qty** + **Unit** + **Unit Rate** + **Amount** (auto) + optional **Description/Notes**. No “Line Type” column, no item dropdown.

---

## B) Stock / Inventory impact

### B3) When user types a material name, do we…?

**Current behavior:** Stock is only affected for lines with `lineType === 'MATERIAL'` **and** `stockItemId` set. So today: dropdown selection → `stockItemId` → on POST, stock can be updated.

**Options:**

- **Option 1 — Create/resolve StockItem and increase stock:**  
  When user types a material name, we could create a new `StockItem` (or match by name) and set `stockItemId` so that when the purchase is posted, stock increases. This would need: create-or-find StockItem by name, link line to it, existing stock logic stays.

- **Option 2 — Do NOT touch stock:**  
  Purchases are expense records only. We do not create or link to `StockItem`; we do not run stock movements. We could still post to ledger (expense account). Simpler, but no inventory impact.

- **Option 3 — User chooses “Add to Stock” per line (or per purchase):**  
  If “Add to Stock” is on: same as Option 1 (create/find StockItem, post to stock when posted). If off: same as Option 2.

**Recommendation:** Decide this as a product/business choice. **Option 2** is simplest and matches “just type material name” without committing to inventory. **Option 3** is more flexible. **Option 1** gives automatic inventory but requires create-or-find by name and clear rules (e.g. exact match vs. create new).

---

### B4) If stock should be affected

- **Company-wide vs project-specific:**  
  In the codebase, `StockBalance` and `StockMovement` are keyed by `companyId` (+ `stockItemId`). So stock is **company-wide**, not project-specific. Project is stored on the purchase and movement for reference only.

- **Edit/delete purchase:**  
  Today, stock is updated only when a purchase is **POSTED** (in workflow). There is no automatic stock update on **edit** or **delete** of a draft purchase. For **REVERSE**, the workflow calls `reverseStockMovementsForPurchase`, which creates reversing OUT movements. So: **edit/delete before post:** no stock impact. **After post:** only reversal via REVERSE workflow, not via simple edit/delete.

---

## C) Vendor + Payment side

### C5) Vendor selection

**Vendor stays as dropdown.** The user only asked to remove the **item** dropdown (materials). Vendor is still required and selected from the list.

**Vendor dropdown empty:**  
`GET /api/vendors` defaults to `active=true`. If the list is empty, it’s because there are no (active) vendors. The form already shows: “No vendors found. Click '+ Add Vendor' to create one.” So no bug identified; if you see empty dropdown in a real environment, we can add a check (e.g. ensure `active` filter isn’t over-restrictive or add a clearer message).

---

### C6) Paid Amount / Due Amount

- **Current behavior:**  
  - Total = Subtotal − Discount.  
  - Due = Total − Paid.  
  - Paid is optional (can be 0).  
  - **Payment account is required when Paid > 0** (Zod + API validation).

- **Recommendation:** Keep this. When Paid > 0, “Account Type + Account Number” (payment account) is required for correct ledger posting (credit to Cash/Bank).

---

## D) “Account Type + Account Number” — Where and what?

### D7) Where do they appear?

They appear **once**, in the **payment/summary** section of the purchase form, not on each line:

- **Location in UI:** `PurchaseForm.tsx` — one field labeled “Account Type + Account Number”, implemented as a **single dropdown** bound to `paymentAccountId` (payment account).
- So: **header/summary** (payment section), not per line. There are no separate “Account Type + Account Number” fields per line in the UI.

---

### D8) Purpose in code

- **Stored as:** `Purchase.paymentAccountId` → `Account` (Chart of Accounts).
- **Used when building the voucher:**  
  In `purchaseAccounting.server.ts`, when creating voucher lines from a purchase:
  - **Debit lines:** One per purchase line — expense account by **line type** (MATERIAL → 5010 Direct Materials, SERVICE → 5020, OTHER → 5030/5090).
  - **Credit lines:**  
    - If Paid > 0: **Credit to `paymentAccountId`** (Cash/Bank).  
    - If Due > 0: **Credit to AP (2010).**
- So the “Account Type + Account Number” field is the **payment account** used for **ledger posting** when there is a cash/bank payment. It is **not** used for the expense side; expense accounts are chosen by the server from system accounts (5010, 5020, etc.) by line type.

---

### D9) Business rule: Do we post purchases to the ledger?

**YES.** When a voucher is created and then submitted/approved/posted, the purchase is posted to the ledger. The payment account is required when Paid > 0 so that the credit side of the entry is correct (Cash/Bank). So we **must keep** the payment account field when Paid > 0.

---

### D10) Default accounting and whether user can change

- **Debit:** Materials/expense per line — today: MATERIAL → 5010 (Direct Materials), SERVICE → 5020 (Direct Labor), OTHER → 5030/5090 (Overhead/Misc). These are **system defaults**, not chosen by the user in the form.
- **Credit:**  
  - Paid portion → **payment account** (user-selected; typically Cash/Bank).  
  - Due portion → **2010 Accounts Payable** (system).
- **Can user change?** The user can only choose the **payment account** (the one dropdown). They cannot currently choose the expense accounts per line; those are fixed by line type in code. So: **keep “Account Type + Account Number”** as the payment-account selector; no change needed for default debit rules unless you later add per-line account override.

---

## E) Data migration / backwards compatibility

### E11) Existing purchase records

- **Old line types (SERVICE/OTHER) and old item references:**  
  Existing purchases have `lineType` and some have `stockItemId`. List and detail views (e.g. `PurchasesList.tsx`, `purchases/[id]/page.tsx`) still show `lineType` and derive item name from `stockItem?.name` or `description`.

- **Recommendation:**  
  - **New form:** No Line Type column; only material name (text) + qty + unit + rate + amount.  
  - **Old records:** Keep **viewing** them as-is: continue to read `lineType` and `stockItemId`/`description` and show them in list/detail so old data is still meaningful (e.g. “MATERIAL”, “SERVICE”, “Unknown material”, description). So: **graceful display of old records** after UI changes; no need to migrate old rows.

---

### E12) Prisma migration — what we can do

- **Remove `lineType` column/enum:**  
  Possible but breaking for existing data and for any code that still expects `lineType`. Safer: **keep** the column and enum; in new UI we don’t show it and we always send `MATERIAL` for new/updated lines. Optionally later: migration to drop the column once all consumers are updated.

- **Replace `stockItemId` with free-text `materialName`:**  
  - **Option 1:** Add a new column `materialName` (String, optional). New UI sends `materialName`; we can leave `stockItemId` null for new lines. Old lines keep `stockItemId` and we can keep displaying them (e.g. from `stockItem.name` or `description`). No need to drop `stockItemId`.  
  - **Option 2:** Add `materialName` and eventually stop using `stockItemId` for new flows; keep both in DB for backwards compatibility.  
  Migration: add `materialName` only is non-breaking. Removing or renaming `stockItemId` would be a larger migration and would affect stock logic; not recommended unless you fully move to “no stock” or “create StockItem from name”.

- **Summary:**  
  - **Allowed without breaking old data:** Add `materialName` (optional), keep `lineType` and `stockItemId`. New UI: send `materialName`, send `lineType: 'MATERIAL'`, and leave `stockItemId` null (or implement create/find by name later).  
  - **Optional later:** Remove `lineType` from enum/column after deprecation.  
  - **Avoid for now:** Removing or repurposing `stockItemId` until stock behavior (B3) is decided.

---

## Implementation checklist (once you confirm)

- [ ] **UI:** Remove “Line Type” column. Replace “Item/Description” with a single text input “Material Name” (no dropdown). Keep Qty, Unit (text), Unit Rate, Amount (auto). Optionally keep one “Description/Notes” per line.
- [ ] **UI:** Ensure totals (subtotal, discount, total, paid, due) still compute correctly.
- [ ] **API (Zod):** Update line schema: require material name (or description) as the display name; make `stockItemId` optional; keep or default `lineType` to `MATERIAL` for backwards compatibility.
- [ ] **API (server):** Create/update: accept `materialName` (or store in `description`); stop requiring `stockItemId` for “material” lines; if you add DB column `materialName`, persist it.
- [ ] **DB:** Optional migration: add `materialName` to `PurchaseLine`; do not remove `lineType`/`stockItemId` yet.
- [ ] **List/Detail views:** Keep showing existing purchases with `lineType` and item from `stockItem?.name` or `description` so old records display correctly.
- [ ] **Vendor:** Keep as dropdown; no change unless you want to restrict to system accounts only in the payment-account dropdown.
- [ ] **Payment account:** Keep “Account Type + Account Number” (payment account) when Paid > 0; keep validation and voucher building as-is for that field.
- [ ] **Stock:** Leave behavior as-is (only MATERIAL + stockItemId) until you decide B3; then implement Option 1, 2, or 3.

---

## Summary table

| Topic | Answer |
|-------|--------|
| Line type column | Remove from UI; treat every row as material. |
| Item/Description | Replace with free-text “Material Name” (no dropdown). |
| Account Type + Number | Keep. It’s the **payment account** (one field in payment section); required when Paid > 0. |
| Per-row columns | Material Name, Qty, Unit (text), Unit Rate, Amount (auto), optional Notes. |
| Vendor | Keep as dropdown. |
| Paid/Due | Keep; payment account required when Paid > 0. |
| Stock | No change until you choose Option 1/2/3; then implement. |
| Old data | Keep displaying with current logic (lineType + stockItem/description). |
| DB migration | Prefer: add `materialName` only; keep `lineType` and `stockItemId` for now. |

Once you confirm these answers (and your choice for B3 — stock behavior), implementation can proceed as in the checklist above.
