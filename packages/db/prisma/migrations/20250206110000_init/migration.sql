-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ACCOUNTANT', 'ENGINEER', 'DATA_ENTRY', 'VIEWER');

-- CreateEnum
CREATE TYPE "InviteTokenPurpose" AS ENUM ('INVITE', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'PLANNING', 'RUNNING', 'ON_HOLD', 'COMPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CASH', 'BANK', 'CHEQUE', 'MOBILE');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('PROJECT_EXPENSE', 'OFFICE_EXPENSE');

-- CreateEnum
CREATE TYPE "OverheadAllocationMethod" AS ENUM ('PERCENT', 'CONTRACT_VALUE');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY');

-- CreateEnum
CREATE TYPE "ProjectCostCategory" AS ENUM ('CIVIL', 'MATERIALS', 'MATI_KATA', 'DHALAI', 'BROKERAGE', 'OTHERS');

-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('WAREHOUSE', 'LABOR');

-- CreateEnum
CREATE TYPE "ProjectLaborType" AS ENUM ('DAY', 'MONTHLY', 'CONTRACT');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateEnum
CREATE TYPE "StockMovementKind" AS ENUM ('OPENING', 'RECEIVE', 'ISSUE', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN_IN', 'WASTAGE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PurchaseLineType" AS ENUM ('MATERIAL', 'SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "PurchasePaymentMethod" AS ENUM ('CASH', 'BANK');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "company_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "purpose" "InviteTokenPurpose" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client_name" TEXT,
    "client_contact" TEXT,
    "site_location" TEXT,
    "start_date" TIMESTAMP(3),
    "expected_end_date" TIMESTAMP(3),
    "contract_value" DECIMAL(15,2),
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "assigned_manager" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "address" TEXT,
    "project_manager" TEXT,
    "project_engineer" TEXT,
    "company_site_name" TEXT,
    "reference" TEXT,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "parent_project_id" TEXT,
    "total_floors" INTEGER,
    "total_units" INTEGER,
    "budget_total" DECIMAL(15,2),
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "parent_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "locked" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_id" TEXT,
    "voucher_no" TEXT NOT NULL,
    "type" "VoucherType" DEFAULT 'JOURNAL',
    "expense_type" "ExpenseType",
    "date" TIMESTAMP(3) NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "narration" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "submitted_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "posted_by_user_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "reversal_of_id" TEXT,
    "reversed_by_id" TEXT,
    "reversed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_lines" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "description" TEXT,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "project_id" TEXT,
    "is_company_level" BOOLEAN NOT NULL DEFAULT false,
    "vendor_id" TEXT,
    "payment_method_id" TEXT,
    "work_details" TEXT,
    "paid_by" TEXT,
    "received_by" TEXT,
    "file_ref" TEXT,
    "voucher_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voucher_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_allocations" (
    "id" TEXT NOT NULL,
    "payment_voucher_id" TEXT NOT NULL,
    "source_line_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "action" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "metadata" JSONB,
    "before" JSONB,
    "after" JSONB,
    "diff_json" JSONB,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_attempts" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overhead_allocation_rules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "method" "OverheadAllocationMethod" NOT NULL,
    "allocations" JSONB,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overhead_allocation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overhead_allocation_results" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "OverheadAllocationMethod" NOT NULL,
    "source_overhead_total" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overhead_allocation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_files" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_documents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "challan_no" TEXT,
    "project_id" TEXT NOT NULL,
    "sub_project_id" TEXT,
    "supplier_vendor_id" TEXT NOT NULL,
    "reference" TEXT,
    "discount_percent" DECIMAL(5,2),
    "subtotal" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "due_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "payment_method" "PurchasePaymentMethod",
    "payment_account_id" TEXT,
    "voucher_id" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_lines" (
    "id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "stock_item_id" TEXT,
    "lineType" "PurchaseLineType" NOT NULL DEFAULT 'OTHER',
    "quantity" DECIMAL(18,3),
    "unit" TEXT,
    "unit_rate" DECIMAL(18,2),
    "description" TEXT,
    "material_name" TEXT,
    "line_total" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_attachments" (
    "id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_txns" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "stock_item_id" TEXT,
    "purchase_id" TEXT,
    "project_id" TEXT,
    "qty_in" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "qty_out" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(18,2) NOT NULL,
    "total_cost" DECIMAL(18,2) NOT NULL,
    "txn_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_txns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "main_project_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category_id" TEXT NOT NULL,
    "source" "ExpenseSource" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paid_by_user_id" TEXT NOT NULL,
    "paid_to" TEXT,
    "vendor_id" TEXT,
    "payment_method_id" TEXT NOT NULL,
    "debit_account_id" TEXT NOT NULL,
    "credit_account_id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "reorder_level" DECIMAL(18,3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "on_hand_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "avg_cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "movement_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "StockMovementType" NOT NULL,
    "movement_kind" "StockMovementKind",
    "qty" DECIMAL(18,3) NOT NULL,
    "unit_cost" DECIMAL(18,2),
    "reference_type" TEXT,
    "reference_id" TEXT,
    "notes" TEXT,
    "project_id" TEXT,
    "source_project_id" TEXT,
    "destination_project_id" TEXT,
    "vendor_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "reason" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_investments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "note" TEXT,
    "investor_name" TEXT,
    "received_by" TEXT,
    "payment_method" "PaymentMethodType",
    "voucher_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_labors" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "ProjectLaborType" NOT NULL DEFAULT 'DAY',
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "note" TEXT,
    "worker_name" TEXT,
    "employee_name" TEXT,
    "month" INTEGER,
    "year" INTEGER,
    "team_leader" TEXT,
    "paid" DECIMAL(18,2),
    "due" DECIMAL(18,2),
    "rating" INTEGER,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_labors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_stock_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "min_qty" DECIMAL(18,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_stock_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credits" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_id" TEXT,
    "project_snapshot_name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "paidBy" TEXT NOT NULL,
    "receivedBy" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "payment_ref" TEXT,
    "payment_account_id" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "note" TEXT DEFAULT 'Done',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateIndex
CREATE INDEX "invite_tokens_token_hash_idx" ON "invite_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "invite_tokens_user_id_idx" ON "invite_tokens"("user_id");

-- CreateIndex
CREATE INDEX "invite_tokens_company_id_idx" ON "invite_tokens"("company_id");

-- CreateIndex
CREATE INDEX "invite_tokens_expires_at_used_at_idx" ON "invite_tokens"("expires_at", "used_at");

-- CreateIndex
CREATE UNIQUE INDEX "invite_tokens_token_hash_key" ON "invite_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "projects_company_id_idx" ON "projects"("company_id");

-- CreateIndex
CREATE INDEX "projects_parent_project_id_idx" ON "projects"("parent_project_id");

-- CreateIndex
CREATE INDEX "projects_company_id_parent_project_id_idx" ON "projects"("company_id", "parent_project_id");

-- CreateIndex
CREATE INDEX "vendors_company_id_idx" ON "vendors"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_company_id_name_key" ON "payment_methods"("company_id", "name");

-- CreateIndex
CREATE INDEX "payment_methods_company_id_idx" ON "payment_methods"("company_id");

-- CreateIndex
CREATE INDEX "attachments_company_id_idx" ON "attachments"("company_id");

-- CreateIndex
CREATE INDEX "attachments_uploaded_by_user_id_idx" ON "attachments"("uploaded_by_user_id");

-- CreateIndex
CREATE INDEX "accounts_company_id_idx" ON "accounts"("company_id");

-- CreateIndex
CREATE INDEX "accounts_parent_id_idx" ON "accounts"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_company_id_code_key" ON "accounts"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_company_id_name_key" ON "accounts"("company_id", "name");

-- CreateIndex
CREATE INDEX "vouchers_company_id_date_idx" ON "vouchers"("company_id", "date");

-- CreateIndex
CREATE INDEX "vouchers_company_id_status_idx" ON "vouchers"("company_id", "status");

-- CreateIndex
CREATE INDEX "vouchers_company_id_type_idx" ON "vouchers"("company_id", "type");

-- CreateIndex
CREATE INDEX "vouchers_company_id_expense_type_idx" ON "vouchers"("company_id", "expense_type");

-- CreateIndex
CREATE INDEX "vouchers_reversal_of_id_idx" ON "vouchers"("reversal_of_id");

-- CreateIndex
CREATE INDEX "vouchers_company_id_status_date_idx" ON "vouchers"("company_id", "status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_company_id_voucher_no_key" ON "vouchers"("company_id", "voucher_no");

-- CreateIndex
CREATE INDEX "voucher_lines_voucher_id_idx" ON "voucher_lines"("voucher_id");

-- CreateIndex
CREATE INDEX "voucher_lines_company_id_idx" ON "voucher_lines"("company_id");

-- CreateIndex
CREATE INDEX "voucher_lines_account_id_idx" ON "voucher_lines"("account_id");

-- CreateIndex
CREATE INDEX "voucher_lines_vendor_id_idx" ON "voucher_lines"("vendor_id");

-- CreateIndex
CREATE INDEX "voucher_lines_company_id_project_id_idx" ON "voucher_lines"("company_id", "project_id");

-- CreateIndex
CREATE INDEX "voucher_lines_company_id_project_id_voucher_id_idx" ON "voucher_lines"("company_id", "project_id", "voucher_id");

-- CreateIndex
CREATE INDEX "voucher_lines_company_id_vendor_id_idx" ON "voucher_lines"("company_id", "vendor_id");

-- CreateIndex
CREATE INDEX "voucher_lines_company_id_is_company_level_idx" ON "voucher_lines"("company_id", "is_company_level");

-- CreateIndex
CREATE INDEX "vendor_allocations_payment_voucher_id_idx" ON "vendor_allocations"("payment_voucher_id");

-- CreateIndex
CREATE INDEX "vendor_allocations_source_line_id_idx" ON "vendor_allocations"("source_line_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_entity_type_entity_id_idx" ON "audit_logs"("company_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "rate_limit_attempts_identifier_endpoint_attempt_at_idx" ON "rate_limit_attempts"("identifier", "endpoint", "attempt_at");

-- CreateIndex
CREATE INDEX "rate_limit_attempts_attempt_at_idx" ON "rate_limit_attempts"("attempt_at");

-- CreateIndex
CREATE INDEX "overhead_allocation_rules_company_id_month_idx" ON "overhead_allocation_rules"("company_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "overhead_allocation_rules_company_id_month_key" ON "overhead_allocation_rules"("company_id", "month");

-- CreateIndex
CREATE INDEX "overhead_allocation_results_rule_id_idx" ON "overhead_allocation_results"("rule_id");

-- CreateIndex
CREATE INDEX "overhead_allocation_results_company_id_project_id_idx" ON "overhead_allocation_results"("company_id", "project_id");

-- CreateIndex
CREATE INDEX "overhead_allocation_results_company_id_project_id_created_a_idx" ON "overhead_allocation_results"("company_id", "project_id", "created_at");

-- CreateIndex
CREATE INDEX "project_files_company_id_idx" ON "project_files"("company_id");

-- CreateIndex
CREATE INDEX "project_files_project_id_idx" ON "project_files"("project_id");

-- CreateIndex
CREATE INDEX "project_files_company_id_project_id_idx" ON "project_files"("company_id", "project_id");

-- CreateIndex
CREATE INDEX "project_documents_company_id_idx" ON "project_documents"("company_id");

-- CreateIndex
CREATE INDEX "project_documents_project_id_idx" ON "project_documents"("project_id");

-- CreateIndex
CREATE INDEX "project_documents_company_id_project_id_idx" ON "project_documents"("company_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_voucher_id_key" ON "purchases"("voucher_id");

-- CreateIndex
CREATE INDEX "purchases_company_id_idx" ON "purchases"("company_id");

-- CreateIndex
CREATE INDEX "purchases_company_id_date_idx" ON "purchases"("company_id", "date");

-- CreateIndex
CREATE INDEX "purchases_challan_no_idx" ON "purchases"("challan_no");

-- CreateIndex
CREATE INDEX "purchases_company_id_project_id_idx" ON "purchases"("company_id", "project_id");

-- CreateIndex
CREATE INDEX "purchases_company_id_supplier_vendor_id_idx" ON "purchases"("company_id", "supplier_vendor_id");

-- CreateIndex
CREATE INDEX "purchases_voucher_id_idx" ON "purchases"("voucher_id");

-- CreateIndex
CREATE INDEX "purchases_company_id_status_idx" ON "purchases"("company_id", "status");

-- CreateIndex
CREATE INDEX "purchase_lines_purchase_id_idx" ON "purchase_lines"("purchase_id");

-- CreateIndex
CREATE INDEX "purchase_lines_stock_item_id_idx" ON "purchase_lines"("stock_item_id");

-- CreateIndex
CREATE INDEX "purchase_lines_purchase_id_lineType_idx" ON "purchase_lines"("purchase_id", "lineType");

-- CreateIndex
CREATE INDEX "purchase_attachments_purchase_id_idx" ON "purchase_attachments"("purchase_id");

-- CreateIndex
CREATE INDEX "inventory_txns_company_id_idx" ON "inventory_txns"("company_id");

-- CreateIndex
CREATE INDEX "inventory_txns_company_id_stock_item_id_idx" ON "inventory_txns"("company_id", "stock_item_id");

-- CreateIndex
CREATE INDEX "inventory_txns_company_id_purchase_id_idx" ON "inventory_txns"("company_id", "purchase_id");

-- CreateIndex
CREATE INDEX "inventory_txns_company_id_project_id_idx" ON "inventory_txns"("company_id", "project_id");

-- CreateIndex
CREATE INDEX "inventory_txns_txn_date_idx" ON "inventory_txns"("txn_date");

-- CreateIndex
CREATE INDEX "expense_categories_company_id_idx" ON "expense_categories"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_company_id_name_key" ON "expense_categories"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_voucher_id_key" ON "expenses"("voucher_id");

-- CreateIndex
CREATE INDEX "expenses_company_id_main_project_id_date_idx" ON "expenses"("company_id", "main_project_id", "date");

-- CreateIndex
CREATE INDEX "expenses_company_id_project_id_date_idx" ON "expenses"("company_id", "project_id", "date");

-- CreateIndex
CREATE INDEX "expenses_company_id_category_id_date_idx" ON "expenses"("company_id", "category_id", "date");

-- CreateIndex
CREATE INDEX "expenses_company_id_main_project_id_idx" ON "expenses"("company_id", "main_project_id");

-- CreateIndex
CREATE INDEX "stock_items_company_id_idx" ON "stock_items"("company_id");

-- CreateIndex
CREATE INDEX "stock_items_company_id_name_idx" ON "stock_items"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_company_id_name_key" ON "stock_items"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_company_id_sku_key" ON "stock_items"("company_id", "sku");

-- CreateIndex
CREATE INDEX "stock_balances_company_id_idx" ON "stock_balances"("company_id");

-- CreateIndex
CREATE INDEX "stock_balances_company_id_stock_item_id_idx" ON "stock_balances"("company_id", "stock_item_id");

-- CreateIndex
CREATE INDEX "stock_balances_stock_item_id_idx" ON "stock_balances"("stock_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_company_id_stock_item_id_key" ON "stock_balances"("company_id", "stock_item_id");

-- CreateIndex
CREATE INDEX "stock_movements_company_id_idx" ON "stock_movements"("company_id");

-- CreateIndex
CREATE INDEX "stock_movements_company_id_stock_item_id_idx" ON "stock_movements"("company_id", "stock_item_id");

-- CreateIndex
CREATE INDEX "stock_movements_company_id_stock_item_id_movement_date_idx" ON "stock_movements"("company_id", "stock_item_id", "movement_date");

-- CreateIndex
CREATE INDEX "stock_movements_company_id_movement_date_idx" ON "stock_movements"("company_id", "movement_date");

-- CreateIndex
CREATE INDEX "stock_movements_stock_item_id_idx" ON "stock_movements"("stock_item_id");

-- CreateIndex
CREATE INDEX "stock_movements_project_id_idx" ON "stock_movements"("project_id");

-- CreateIndex
CREATE INDEX "stock_movements_source_project_id_idx" ON "stock_movements"("source_project_id");

-- CreateIndex
CREATE INDEX "stock_movements_destination_project_id_idx" ON "stock_movements"("destination_project_id");

-- CreateIndex
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "stock_movements_company_id_project_id_idx" ON "stock_movements"("company_id", "project_id");

-- CreateIndex
CREATE INDEX "stock_movements_company_id_project_id_movement_kind_idx" ON "stock_movements"("company_id", "project_id", "movement_kind");

-- CreateIndex
CREATE UNIQUE INDEX "project_investments_voucher_id_key" ON "project_investments"("voucher_id");

-- CreateIndex
CREATE INDEX "project_investments_company_id_idx" ON "project_investments"("company_id");

-- CreateIndex
CREATE INDEX "project_investments_company_id_project_id_idx" ON "project_investments"("company_id", "project_id");

-- CreateIndex
CREATE INDEX "project_investments_company_id_project_id_date_idx" ON "project_investments"("company_id", "project_id", "date");

-- CreateIndex
CREATE INDEX "project_investments_project_id_idx" ON "project_investments"("project_id");

-- CreateIndex
CREATE INDEX "project_investments_voucher_id_idx" ON "project_investments"("voucher_id");

-- CreateIndex
CREATE INDEX "project_labors_company_id_idx" ON "project_labors"("company_id");

-- CreateIndex
CREATE INDEX "project_labors_company_id_project_id_idx" ON "project_labors"("company_id", "project_id");

-- CreateIndex
CREATE INDEX "project_labors_company_id_project_id_date_idx" ON "project_labors"("company_id", "project_id", "date");

-- CreateIndex
CREATE INDEX "project_labors_company_id_project_id_type_date_idx" ON "project_labors"("company_id", "project_id", "type", "date");

-- CreateIndex
CREATE INDEX "project_labors_project_id_idx" ON "project_labors"("project_id");

-- CreateIndex
CREATE INDEX "project_stock_settings_company_id_idx" ON "project_stock_settings"("company_id");

-- CreateIndex
CREATE INDEX "project_stock_settings_company_id_project_id_idx" ON "project_stock_settings"("company_id", "project_id");

-- CreateIndex
CREATE INDEX "project_stock_settings_project_id_idx" ON "project_stock_settings"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_stock_settings_project_id_stock_item_id_key" ON "project_stock_settings"("project_id", "stock_item_id");

-- CreateIndex
CREATE INDEX "credits_company_id_idx" ON "credits"("company_id");

-- CreateIndex
CREATE INDEX "credits_company_id_project_id_idx" ON "credits"("company_id", "project_id");

-- CreateIndex
CREATE INDEX "credits_company_id_date_idx" ON "credits"("company_id", "date");

-- CreateIndex
CREATE INDEX "credits_project_id_idx" ON "credits"("project_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_project_id_fkey" FOREIGN KEY ("parent_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_posted_by_user_id_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_allocations" ADD CONSTRAINT "vendor_allocations_payment_voucher_id_fkey" FOREIGN KEY ("payment_voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_allocations" ADD CONSTRAINT "vendor_allocations_source_line_id_fkey" FOREIGN KEY ("source_line_id") REFERENCES "voucher_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overhead_allocation_rules" ADD CONSTRAINT "overhead_allocation_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overhead_allocation_rules" ADD CONSTRAINT "overhead_allocation_rules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overhead_allocation_results" ADD CONSTRAINT "overhead_allocation_results_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "overhead_allocation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overhead_allocation_results" ADD CONSTRAINT "overhead_allocation_results_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overhead_allocation_results" ADD CONSTRAINT "overhead_allocation_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_sub_project_id_fkey" FOREIGN KEY ("sub_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_vendor_id_fkey" FOREIGN KEY ("supplier_vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_attachments" ADD CONSTRAINT "purchase_attachments_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_txns" ADD CONSTRAINT "inventory_txns_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_txns" ADD CONSTRAINT "inventory_txns_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_txns" ADD CONSTRAINT "inventory_txns_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_txns" ADD CONSTRAINT "inventory_txns_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_main_project_id_fkey" FOREIGN KEY ("main_project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_user_id_fkey" FOREIGN KEY ("paid_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_debit_account_id_fkey" FOREIGN KEY ("debit_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_credit_account_id_fkey" FOREIGN KEY ("credit_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_source_project_id_fkey" FOREIGN KEY ("source_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_destination_project_id_fkey" FOREIGN KEY ("destination_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_investments" ADD CONSTRAINT "project_investments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_investments" ADD CONSTRAINT "project_investments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_investments" ADD CONSTRAINT "project_investments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_investments" ADD CONSTRAINT "project_investments_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_labors" ADD CONSTRAINT "project_labors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_labors" ADD CONSTRAINT "project_labors_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_labors" ADD CONSTRAINT "project_labors_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stock_settings" ADD CONSTRAINT "project_stock_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stock_settings" ADD CONSTRAINT "project_stock_settings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stock_settings" ADD CONSTRAINT "project_stock_settings_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
