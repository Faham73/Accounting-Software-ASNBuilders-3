-- Expense category improvements: categories have code/sort_order; accounts link to category; expenses store category snapshot.
-- After applying: run backfill from packages/db: npm run backfill:expense-category

-- AlterTable: expense_categories - add code and sort_order
ALTER TABLE "expense_categories" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "expense_categories" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: unique (company_id, code) - allows multiple NULLs in PostgreSQL
CREATE UNIQUE INDEX IF NOT EXISTS "expense_categories_company_id_code_key" ON "expense_categories"("company_id", "code");

-- AlterTable: accounts - add expense_category_id
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "expense_category_id" TEXT;

-- AddForeignKey (manual): accounts.expense_category_id -> expense_categories.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_expense_category_id_fkey'
  ) THEN
    ALTER TABLE "accounts" ADD CONSTRAINT "accounts_expense_category_id_fkey"
      FOREIGN KEY ("expense_category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "accounts_expense_category_id_idx" ON "accounts"("expense_category_id");

-- AlterTable: expenses - add category_name_snapshot
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "category_name_snapshot" TEXT;

-- Indexes for expenses (project_id, category_id, date) and (debit_account_id)
CREATE INDEX IF NOT EXISTS "expenses_project_id_category_id_date_idx" ON "expenses"("project_id", "category_id", "date");
CREATE INDEX IF NOT EXISTS "expenses_debit_account_id_idx" ON "expenses"("debit_account_id");
