/**
 * @accounting/shared
 * 
 * Shared Zod schemas and TypeScript types for Phase 1 models
 */

// Company schemas
export {
  CompanyCreateSchema,
  CompanyUpdateSchema,
  type CompanyCreate,
  type CompanyUpdate,
} from './schemas/company';

// Project schemas
export {
  ProjectCreateSchema,
  ProjectUpdateSchema,
  ProjectStatusEnum,
  type ProjectCreate,
  type ProjectUpdate,
  type ProjectStatus,
} from './schemas/project';

// Vendor schemas
export {
  VendorCreateSchema,
  VendorUpdateSchema,
  type VendorCreate,
  type VendorUpdate,
} from './schemas/vendor';

// PaymentMethod schemas
export {
  PaymentMethodCreateSchema,
  PaymentMethodUpdateSchema,
  PaymentMethodTypeEnum,
  type PaymentMethodCreate,
  type PaymentMethodUpdate,
  type PaymentMethodType,
} from './schemas/paymentMethod';

// Attachment schemas
export {
  AttachmentCreateSchema,
  AttachmentListFiltersSchema,
  type AttachmentCreate,
  type AttachmentListFilters,
} from './schemas/attachment';

// Account schemas
export {
  AccountCreateSchema,
  AccountUpdateSchema,
  AccountListFiltersSchema,
  AccountTypeEnum,
  type AccountCreate,
  type AccountUpdate,
  type AccountListFilters,
  type AccountType,
} from './schemas/account';

// Voucher schemas
export {
  VoucherCreateSchema,
  VoucherUpdateSchema,
  VoucherListFiltersSchema,
  VoucherLineCreateSchema,
  VoucherLineUpdateSchema,
  VoucherStatusEnum,
  type VoucherCreate,
  type VoucherUpdate,
  type VoucherListFilters,
  type VoucherLineCreate,
  type VoucherLineUpdate,
  type VoucherStatus,
} from './schemas/voucher';

// Project ledger schemas
export {
  ProjectLedgerFiltersSchema,
  ProjectCostSummaryFiltersSchema,
  type ProjectLedgerFilters,
  type ProjectCostSummaryFilters,
} from './schemas/projectLedger';

// Purchase schemas
export {
  PurchaseCreateSchema,
  PurchaseUpdateSchema,
  PurchaseListFiltersSchema,
  PurchaseLineCreateSchema,
  PurchaseAttachmentCreateSchema,
  PurchaseStatusEnum,
  PurchaseLineTypeEnum,
  PurchasePaymentMethodEnum,
  type PurchaseCreate,
  type PurchaseUpdate,
  type PurchaseListFilters,
  type PurchaseLineCreate,
  type PurchaseAttachmentCreate,
  type PurchaseStatus,
  type PurchaseLineType,
  type PurchasePaymentMethod,
} from './schemas/purchase';

// Expense schemas
export {
  ExpenseCreateSchema,
  ExpenseUpdateSchema,
  ExpenseListFiltersSchema,
  ExpenseSourceEnum,
  type ExpenseCreate,
  type ExpenseUpdate,
  type ExpenseListFilters,
  type ExpenseSource,
} from './schemas/expense';

// Stock schemas
export {
  StockItemCreateSchema,
  StockItemUpdateSchema,
  StockItemListFiltersSchema,
  StockMovementInSchema,
  StockMovementOutSchema,
  StockMovementAdjustSchema,
  StockBalanceListFiltersSchema,
  StockMovementListFiltersSchema,
  type StockItemCreate,
  type StockItemUpdate,
  type StockItemListFilters,
  type StockMovementIn,
  type StockMovementOut,
  type StockMovementAdjust,
  type StockBalanceListFilters,
  type StockMovementListFilters,
} from './schemas/stock';

// Investment schemas
export {
  ProjectInvestmentCreateSchema,
  ProjectInvestmentUpdateSchema,
  ProjectInvestmentListFiltersSchema,
  type ProjectInvestmentCreate,
  type ProjectInvestmentUpdate,
  type ProjectInvestmentListFilters,
} from './schemas/investment';

// Labor schemas
export {
  ProjectLaborCreateSchema,
  ProjectLaborUpdateSchema,
  ProjectLaborListFiltersSchema,
  ProjectLaborTypeEnum,
  type ProjectLaborCreate,
  type ProjectLaborUpdate,
  type ProjectLaborListFilters,
  type ProjectLaborType,
} from './schemas/labor';

// Credit schemas
export {
  CreditCreateSchema,
  CreditUpdateSchema,
  CreditListFiltersSchema,
  type CreditCreate,
  type CreditUpdate,
  type CreditListFilters,
} from './schemas/credit';
