# Project Budget Implementation - File Resources

## Summary
Add optional `budgetAmount` field to Project model so Financial Snapshot doesn't show Budget=0 when no budget is set.

## Files Identified

### 1. Database Schema
**File:** `packages/db/prisma/schema.prisma`
- **Line 213:** `budgetTotal Decimal @default(0) @map("budget_total") @db.Decimal(15, 2)`
- **Change:** Make optional: `budgetTotal Decimal? @map("budget_total") @db.Decimal(15, 2)`
- **Note:** Remove `@default(0)` to allow null values

### 2. Project Form Component
**File:** `apps/web/app/dashboard/projects/components/ProjectForm.tsx`
- **Current:** No budgetTotal field in form
- **Change:** Add budgetTotal input field (number input, optional)
- **Lines to modify:** 
  - Add to formData state (line 42-61)
  - Add to payload (line 86-105)
  - Add form field in JSX (around line 253-266, near contractValue)

### 3. Project Create API Route
**File:** `apps/web/app/api/projects/route.ts`
- **Line 131:** Uses `ProjectCreateSchema.parse(body)`
- **Line 163:** `contractValue: validatedData.contractValue,` - need to add budgetTotal
- **Change:** Add `budgetTotal: validatedData.budgetTotal,` in create data

### 4. Project Update API Route
**File:** `apps/web/app/api/projects/[id]/route.ts`
- **Line 91:** Uses `ProjectUpdateSchema.parse(body)`
- **Line 152-153:** contractValue handling - need to add budgetTotal
- **Change:** Add budgetTotal handling in updateData object (around line 152)

### 5. Shared Validation Schema
**File:** `packages/shared/src/schemas/project.ts`
- **Line 11-34:** `ProjectCreateSchema` - need to add budgetTotal
- **Line 39-62:** `ProjectUpdateSchema` - need to add budgetTotal
- **Change:** Add `budgetTotal: z.number().nonnegative().optional().nullable()` to both schemas

### 6. Financial Snapshot Server Logic
**File:** `apps/web/lib/projects/projectFinancialSnapshot.server.ts`
- **Line 48:** `budgetTotal: true,` - already selects it
- **Line 57:** `const budgetTotal = project.budgetTotal?.toNumber() ?? 0;` - already handles null
- **Line 121:** `const remaining = budgetTotal - spent;` - calculates remaining
- **Line 122:** `const overBudget = spent > budgetTotal;` - checks over budget
- **Change:** Update logic to handle null budgetTotal (don't show Budget=0, don't calculate remaining/overBudget if null)

### 7. Financial Snapshot UI Component
**File:** `apps/web/app/dashboard/projects/[id]/components/ProjectFinancialSnapshot.tsx`
- **Line 14:** `budgetTotal: number;` - interface expects number
- **Line 85:** `const { budgetTotal, spent, remaining, overBudget, breakdown } = data;`
- **Line 96:** `<p className="text-xl font-bold text-slate-800">{formatCurrency(budgetTotal)}</p>`
- **Change:** 
  - Update interface to allow null: `budgetTotal: number | null;`
  - Conditionally render Budget card only if budgetTotal is not null
  - Conditionally render Remaining and Over budget only if budgetTotal is not null

### 8. Currency Formatter
**File:** `apps/web/app/dashboard/projects/[id]/components/ProjectFinancialSnapshot.tsx`
- **Line 25-32:** `formatCurrency` function - already exists and works correctly
- **No changes needed**

### 9. API Response Types
**Files:** 
- `apps/web/app/api/projects/route.ts` - GET response (line 76-102) - may need to include budgetTotal
- `apps/web/app/api/projects/[id]/route.ts` - GET response (line 28-49) - may need to include budgetTotal
- **Change:** Ensure budgetTotal is included in select statements

## Implementation Steps

1. Update Prisma schema (make budgetTotal optional, remove default)
2. Run migration: `npm run db:migrate`
3. Update shared Zod schemas (add budgetTotal to create/update)
4. Update API routes (handle budgetTotal in create/update)
5. Update ProjectForm component (add budgetTotal input)
6. Update Financial Snapshot server logic (handle null budgetTotal)
7. Update Financial Snapshot UI component (conditionally render budget-related cards)
8. Test: Create project without budget, verify Financial Snapshot doesn't show Budget=0
