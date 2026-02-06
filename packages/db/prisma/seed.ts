/**
 * Comprehensive seed script for accounting app.
 * Idempotent: safe to re-run. Uses upserts / findFirst+create.
 *
 * Run: npx prisma db seed
 * Or:  npm run db:seed (from root) / npm run db:seed (from packages/db)
 *
 * Production: Seed is blocked when NODE_ENV=production unless SEED_ALLOW_PRODUCTION=1.
 * Do not run seed in production.
 */

import {
  PrismaClient,
  Prisma,
  UserRole,
  PaymentMethodType,
  AccountType,
  ProjectCostCategory,
  ProjectStatus,
  VoucherType,
  VoucherStatus,
  ExpenseType,
  OverheadAllocationMethod,
  ExpenseSource,
  StockMovementType,
  PurchaseLineType,
  PurchaseStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

faker.seed(1234);

const PASSWORD = 'password123';
let passwordHash: string;

// Bangladeshi-style vendor names (deterministic with faker seed)
const BANGLADESHI_NAMES = [
  'Abdul Karim Traders',
  'Rahim Steel & Hardware',
  'Fatema Construction Supplies',
  'Hassan Cement Ltd',
  'Jahanara Building Materials',
  'Mannan Brick Works',
  'Nazma Electric & Plumbing',
  'Sultan Timber Mart',
  'Habib Sand & Stone',
  'Shirin Paint House',
];

const COMPANY_NAMES = ['ASN Builders', 'Demo Construction Ltd'] as const;

interface SeedContext {
  companyId: string;
  userIds: string[];
  projectIds: { main: string; subs: string[] };
  vendorIds: string[];
  paymentMethodIds: string[];
  accountIdsByCode: Record<string, string>;
  voucherNos: Set<string>;
  expenseCategoryIds: string[];
  expenseCategoryIdToName: Record<string, string>;
}

async function getOrCreateCompany(name: string) {
  let company = await prisma.company.findFirst({ where: { name } });
  if (!company) {
    company = await prisma.company.create({ data: { name, isActive: true } });
  }
  return company;
}

function nextVoucherNo(ctx: SeedContext, prefix: string): string {
  let n = 1;
  let no: string;
  do {
    no = `${prefix}-${String(n).padStart(4, '0')}`;
    n++;
  } while (ctx.voucherNos.has(no));
  ctx.voucherNos.add(no);
  return no;
}

async function seedCompany(name: string): Promise<SeedContext> {
  const company = await getOrCreateCompany(name);
  const ctx: SeedContext = {
    companyId: company.id,
    userIds: [],
    projectIds: { main: '', subs: [] },
    vendorIds: [],
    paymentMethodIds: [],
    accountIdsByCode: {},
    voucherNos: new Set(),
    expenseCategoryIds: [],
    expenseCategoryIdToName: {},
  };

  const slug = name.replace(/\s+/g, '').toLowerCase().slice(0, 8);
  const roles: UserRole[] = [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ENGINEER, UserRole.DATA_ENTRY, UserRole.VIEWER, UserRole.DATA_ENTRY];
  const roleNames: Record<UserRole, string> = {
    [UserRole.ADMIN]: 'Admin',
    [UserRole.ACCOUNTANT]: 'Accountant',
    [UserRole.ENGINEER]: 'Engineer',
    [UserRole.DATA_ENTRY]: 'Data Entry',
    [UserRole.VIEWER]: 'Viewer',
  };

  for (let i = 0; i < 6; i++) {
    const role = roles[i];
    const email = `${slug}-${role.toLowerCase().replace(/\s+/, '')}-${i + 1}@example.com`;
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: `${roleNames[role]} ${i + 1}`,
        passwordHash,
        role,
        companyId: company.id,
        isActive: true,
      },
    });
    ctx.userIds.push(u.id);
  }

  let main = await prisma.project.findFirst({
    where: { companyId: company.id, isMain: true, name: { contains: 'Main' } },
  });
  if (!main) {
    main = await prisma.project.create({
      data: {
        companyId: company.id,
        name: `${name} – Main Project`,
        clientName: 'Demo Client Ltd',
        clientContact: '+880 1XXX-XXXXXX',
        siteLocation: faker.location.streetAddress(),
        startDate: faker.date.past({ years: 1 }),
        expectedEndDate: faker.date.future({ years: 1 }),
        contractValue: 5_000_000,
        status: ProjectStatus.RUNNING,
        projectManager: 'Kamal Hossain',
        projectEngineer: 'Rupa Akter',
        isMain: true,
        isActive: true,
      },
    });
  }
  const mainId = main.id;
  ctx.projectIds.main = mainId;

  const subNames = ['Block A', 'Block B', 'Site Office'];
  const existingSubs = await prisma.project.findMany({
    where: { companyId: company.id, parentProjectId: mainId },
  });
  for (let i = 0; i < subNames.length; i++) {
    if (existingSubs[i]) {
      ctx.projectIds.subs.push(existingSubs[i].id);
      continue;
    }
    const sp = await prisma.project.create({
      data: {
        companyId: company.id,
        name: `${name} – ${subNames[i]}`,
        clientName: 'Demo Client Ltd',
        siteLocation: faker.location.streetAddress(),
        startDate: faker.date.past({ years: 1 }),
        expectedEndDate: faker.date.future({ years: 1 }),
        contractValue: 500_000 + faker.number.int({ min: 0, max: 200_000 }),
        status: ProjectStatus.RUNNING,
        projectManager: 'Site Manager',
        projectEngineer: 'Site Engineer',
        isMain: false,
        parentProjectId: mainId,
        isActive: true,
      },
    });
    ctx.projectIds.subs.push(sp.id);
  }

  for (let i = 0; i < 10; i++) {
    let v = await prisma.vendor.findFirst({
      where: { companyId: company.id, name: BANGLADESHI_NAMES[i] },
    });
    if (!v) {
      v = await prisma.vendor.create({
        data: {
          companyId: company.id,
          name: BANGLADESHI_NAMES[i],
          phone: `+880 1${faker.string.numeric(9)}`,
          address: faker.location.streetAddress() + ', Dhaka',
          isActive: true,
        },
      });
    }
    ctx.vendorIds.push(v.id);
  }


  const paymentMethods: { name: string; type: PaymentMethodType }[] = [
    { name: 'Cash', type: PaymentMethodType.CASH },
    { name: 'Bank-DBBL', type: PaymentMethodType.BANK },
    { name: 'Bank-Islami', type: PaymentMethodType.BANK },
    { name: 'Cheque', type: PaymentMethodType.CHEQUE },
    { name: 'bKash', type: PaymentMethodType.MOBILE },
  ];
  for (const pm of paymentMethods) {
    const p = await prisma.paymentMethod.upsert({
      where: { companyId_name: { companyId: company.id, name: pm.name } },
      update: {},
      create: { companyId: company.id, name: pm.name, type: pm.type, isActive: true },
    });
    ctx.paymentMethodIds.push(p.id);
  }

  type AccountDef = { code: string; name: string; type: AccountType; parentCode?: string };
  const accounts: AccountDef[] = [
    { code: '1000', name: 'Assets', type: AccountType.ASSET },
    { code: '1010', name: 'Cash', type: AccountType.ASSET, parentCode: '1000' },
    { code: '1020', name: 'Bank', type: AccountType.ASSET, parentCode: '1000' },
    { code: '1030', name: 'Accounts Receivable', type: AccountType.ASSET, parentCode: '1000' },
    { code: '1040', name: 'Equipment', type: AccountType.ASSET, parentCode: '1000' },
    { code: '2000', name: 'Liabilities', type: AccountType.LIABILITY },
    { code: '2010', name: 'Accounts Payable', type: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2020', name: 'Advance from Client', type: AccountType.LIABILITY, parentCode: '2000' },
    { code: '3000', name: 'Equity', type: AccountType.EQUITY },
    { code: '3010', name: 'Retained Earnings', type: AccountType.EQUITY, parentCode: '3000' },
    { code: '3020', name: 'Capital', type: AccountType.EQUITY, parentCode: '3000' },
    { code: '4000', name: 'Income', type: AccountType.INCOME },
    { code: '4010', name: 'Contract Revenue', type: AccountType.INCOME, parentCode: '4000' },
    { code: '5000', name: 'Expenses', type: AccountType.EXPENSE },
    { code: '5010', name: 'Direct Materials', type: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5020', name: 'Direct Labor', type: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5030', name: 'Site Overhead', type: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5040', name: 'Office Rent', type: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5050', name: 'Utilities', type: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5060', name: 'Fuel', type: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5070', name: 'Equipment Rental', type: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5090', name: 'Misc Expense', type: AccountType.EXPENSE, parentCode: '5000' },
  ];

  // Create system accounts (all accounts are system-managed)
  for (const a of accounts) {
    const parentId = a.parentCode ? (ctx.accountIdsByCode[a.parentCode] ?? null) : null;
    const acc = await prisma.account.upsert({
      where: { companyId_code: { companyId: company.id, code: a.code } },
      update: {
        parentId: parentId ?? undefined,
        isSystem: true,
        locked: true,
        isActive: true,
      },
      create: {
        companyId: company.id,
        code: a.code,
        name: a.name,
        type: a.type,
        parentId,
        isSystem: true,
        locked: true,
        isActive: true,
      },
    });
    ctx.accountIdsByCode[a.code] = acc.id;
  }

  const allProjectIds = [ctx.projectIds.main, ...ctx.projectIds.subs];
  const getAccount = (code: string) => ctx.accountIdsByCode[code];
  const creator = () => faker.helpers.arrayElement(ctx.userIds);
  const pickProject = () => (faker.number.float({ min: 0, max: 1 }) < 0.6 ? faker.helpers.arrayElement(allProjectIds) : null);
  const pickVendor = () => faker.helpers.arrayElement(ctx.vendorIds);
  const pickPaymentMethod = () => faker.helpers.arrayElement(ctx.paymentMethodIds);

  const existingVouchers = await prisma.voucher.findMany({
    where: { companyId: company.id },
    select: { voucherNo: true },
  });
  existingVouchers.forEach((v) => ctx.voucherNos.add(v.voucherNo));

  const now = new Date();
  const past90 = new Date(now);
  past90.setDate(past90.getDate() - 90);

  const journalApCreditLines: { id: string; vendorId: string; amount: number }[] = [];
  const paymentVouchersWithVendor: { voucherId: string; vendorId: string; amount: number }[] = [];
  const vouchersToCreate = Math.max(0, 30 - existingVouchers.length);
  if (vouchersToCreate === 0) {
    // Skip voucher creation; we may still need to create allocations if we have payment vouchers and source lines
  }

  for (let i = 0; i < vouchersToCreate; i++) {
    const date = faker.date.between({ from: past90, to: now });
    const type = faker.helpers.arrayElement([VoucherType.JOURNAL, VoucherType.PAYMENT, VoucherType.RECEIPT, VoucherType.CONTRA]);
    const expenseType = faker.helpers.arrayElement([ExpenseType.PROJECT_EXPENSE, ExpenseType.OFFICE_EXPENSE]);
    const projectId = expenseType === ExpenseType.PROJECT_EXPENSE ? pickProject() : null;
    const status = faker.helpers.arrayElement([VoucherStatus.DRAFT, VoucherStatus.SUBMITTED, VoucherStatus.APPROVED, VoucherStatus.POSTED]);
    const voucherNo = nextVoucherNo(ctx, type === VoucherType.JOURNAL ? 'JV' : type === VoucherType.PAYMENT ? 'PV' : type === VoucherType.RECEIPT ? 'RV' : 'CV');

    const createdBy = creator();
    let submittedById: string | null = null;
    let approvedById: string | null = null;
    let postedById: string | null = null;
    let submittedAt: Date | null = null;
    let approvedAt: Date | null = null;
    let postedAt: Date | null = null;
    if (status !== VoucherStatus.DRAFT) {
      submittedById = createdBy;
      submittedAt = new Date(date.getTime() + 60_000);
      if (status !== VoucherStatus.SUBMITTED) {
        approvedById = ctx.userIds[0];
        approvedAt = new Date(date.getTime() + 120_000);
        if (status === VoucherStatus.POSTED) {
          postedById = ctx.userIds[0];
          postedAt = new Date(date.getTime() + 180_000);
        }
      }
    }

    const voucher = await prisma.voucher.create({
      data: {
        companyId: company.id,
        projectId,
        voucherNo,
        type,
        expenseType,
        date,
        status,
        narration: faker.lorem.sentence(),
        createdByUserId: createdBy,
        submittedById,
        submittedAt,
        approvedById,
        approvedAt,
        postedByUserId: postedById,
        postedAt,
      },
    });

    let debitTotal = 0;
    let creditTotal = 0;
    const lines: { accountId: string; debit: number; credit: number; description?: string; projectId?: string; vendorId?: string; paymentMethodId?: string }[] = [];

    let journalApVendorId: string | null = null;
    let journalApAmount = 0;
    if (type === VoucherType.JOURNAL && expenseType === ExpenseType.PROJECT_EXPENSE && projectId) {
      const amt = faker.number.int({ min: 5000, max: 50000 });
      journalApVendorId = pickVendor();
      journalApAmount = amt;
      lines.push({ accountId: getAccount('5010'), debit: amt, credit: 0, description: 'Materials', projectId, vendorId: journalApVendorId });
      lines.push({ accountId: getAccount('2010'), debit: 0, credit: amt, vendorId: journalApVendorId });
      debitTotal += amt;
      creditTotal += amt;
    } else if (type === VoucherType.JOURNAL && expenseType === ExpenseType.OFFICE_EXPENSE) {
      const amt = faker.number.int({ min: 2000, max: 15000 });
      lines.push({ accountId: getAccount('5040'), debit: amt, credit: 0, description: 'Office rent' });
      lines.push({ accountId: getAccount('2010'), debit: 0, credit: amt });
      debitTotal += amt;
      creditTotal += amt;
    } else if (type === VoucherType.PAYMENT) {
      const amt = faker.number.int({ min: 3000, max: 40000 });
      const vid = pickVendor();
      const pmId = pickPaymentMethod();
      lines.push({ accountId: getAccount('2010'), debit: amt, credit: 0, description: 'Payment to vendor', vendorId: vid });
      lines.push({ accountId: getAccount('1020'), debit: 0, credit: amt, paymentMethodId: pmId });
      debitTotal += amt;
      creditTotal += amt;
    } else if (type === VoucherType.RECEIPT) {
      const amt = faker.number.int({ min: 10000, max: 100000 });
      lines.push({ accountId: getAccount('1010'), debit: amt, credit: 0, description: 'Cash received' });
      lines.push({ accountId: getAccount('4010'), debit: 0, credit: amt });
      debitTotal += amt;
      creditTotal += amt;
    } else {
      const amt = faker.number.int({ min: 5000, max: 30000 });
      lines.push({ accountId: getAccount('1010'), debit: amt, credit: 0, description: 'Contra' });
      lines.push({ accountId: getAccount('1020'), debit: 0, credit: amt });
      debitTotal += amt;
      creditTotal += amt;
    }

    for (const ln of lines) {
      const vl = await prisma.voucherLine.create({
        data: {
          voucherId: voucher.id,
          companyId: company.id,
          accountId: ln.accountId,
          debit: ln.debit,
          credit: ln.credit,
          description: ln.description,
          projectId: ln.projectId ?? null,
          vendorId: ln.vendorId ?? null,
          paymentMethodId: ln.paymentMethodId ?? null,
        },
      });
      if (type === VoucherType.JOURNAL && journalApVendorId && ln.credit > 0 && getAccount('2010') === ln.accountId) {
        journalApCreditLines.push({ id: vl.id, vendorId: journalApVendorId, amount: journalApAmount });
      }
      if (type === VoucherType.PAYMENT && ln.vendorId && ln.debit > 0 && getAccount('2010') === ln.accountId) {
        paymentVouchersWithVendor.push({ voucherId: voucher.id, vendorId: ln.vendorId, amount: ln.debit });
      }
    }
  }

  const usedSourceIds = new Set<string>();
  for (const pv of paymentVouchersWithVendor.slice(0, 8)) {
    const sl = journalApCreditLines.find((s) => s.vendorId === pv.vendorId && !usedSourceIds.has(s.id));
    if (!sl) continue;
    const existing = await prisma.vendorAllocation.findFirst({
      where: { paymentVoucherId: pv.voucherId, sourceLineId: sl.id },
    });
    if (existing) continue;
    await prisma.vendorAllocation.create({
      data: {
        paymentVoucherId: pv.voucherId,
        sourceLineId: sl.id,
        amount: Math.min(sl.amount, pv.amount),
      },
    });
    usedSourceIds.add(sl.id);
  }

  const reversalCount = await prisma.voucher.count({
    where: { companyId: company.id, reversalOfId: { not: null } },
  });
  const posted = await prisma.voucher.findMany({
    where: { companyId: company.id, status: VoucherStatus.POSTED },
    take: Math.min(2, 2 - reversalCount),
  });
  for (const orig of posted) {
    const revNo = nextVoucherNo(ctx, 'REV');
    const revBy = creator();
    const revAt = new Date(orig.date.getTime() + 2 * 24 * 60 * 60 * 1000);
    const rev = await prisma.voucher.create({
      data: {
        companyId: company.id,
        voucherNo: revNo,
        type: orig.type,
        expenseType: orig.expenseType,
        projectId: orig.projectId,
        date: revAt,
        status: VoucherStatus.REVERSED,
        narration: `Reversal of ${orig.voucherNo}`,
        createdByUserId: revBy,
        reversalOfId: orig.id,
        reversedById: revBy,
        reversedAt: revAt,
      },
    });
    const origLines = await prisma.voucherLine.findMany({ where: { voucherId: orig.id } });
    for (const ol of origLines) {
      await prisma.voucherLine.create({
        data: {
          voucherId: rev.id,
          companyId: company.id,
          accountId: ol.accountId,
          debit: ol.credit,
          credit: ol.debit,
          description: `Rev: ${ol.description ?? ''}`,
          projectId: ol.projectId,
          vendorId: ol.vendorId,
          paymentMethodId: ol.paymentMethodId,
        },
      });
    }
    await prisma.voucher.update({
      where: { id: orig.id },
      data: { status: VoucherStatus.REVERSED, reversedById: revBy, reversedAt: revAt },
    });
  }

  const months = [
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
    new Date(now.getFullYear(), now.getMonth() - 2, 1),
  ];
  const allocJson: Record<string, number> = {};
  allocJson[ctx.projectIds.main] = 40;
  ctx.projectIds.subs.forEach((id, idx) => {
    allocJson[id] = [20, 25, 15][idx] ?? 20;
  });
  for (const m of months) {
    const method = m.getMonth() % 2 === 0 ? OverheadAllocationMethod.PERCENT : OverheadAllocationMethod.CONTRACT_VALUE;
    await prisma.overheadAllocationRule.upsert({
      where: { companyId_month: { companyId: company.id, month: m } },
      update: { method, allocations: method === OverheadAllocationMethod.PERCENT ? allocJson : undefined },
      create: {
        companyId: company.id,
        month: m,
        method,
        allocations: method === OverheadAllocationMethod.PERCENT ? allocJson : undefined,
        createdById: ctx.userIds[0],
      },
    });
    const rule = await prisma.overheadAllocationRule.findFirstOrThrow({
      where: { companyId: company.id, month: m },
    });
    await prisma.overheadAllocationResult.deleteMany({ where: { ruleId: rule.id } });
    const sourceTotal = 100000 + faker.number.int({ min: 0, max: 50000 });
    for (const pid of allProjectIds) {
      const pct = method === OverheadAllocationMethod.PERCENT ? (allocJson[pid] ?? 25) / 100 : 0.25;
      const amt = Math.round(sourceTotal * pct * 100) / 100;
      await prisma.overheadAllocationResult.create({
        data: {
          ruleId: rule.id,
          companyId: company.id,
          projectId: pid,
          amount: amt,
          method,
          sourceOverheadTotal: sourceTotal,
        },
      });
    }
  }

  const attCount = await prisma.attachment.count({ where: { companyId: company.id } });
  for (let i = attCount; i < 10; i++) {
    await prisma.attachment.create({
      data: {
        companyId: company.id,
        uploadedByUserId: faker.helpers.arrayElement(ctx.userIds),
        url: `https://example.com/files/${faker.string.alphanumeric(12)}.pdf`,
        fileName: `doc-${i + 1}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: faker.number.int({ min: 1024, max: 512000 }),
      },
    });
  }

  const pfCount = await prisma.projectFile.count({ where: { companyId: company.id } });
  for (let i = pfCount; i < 6; i++) {
    await prisma.projectFile.create({
      data: {
        companyId: company.id,
        projectId: faker.helpers.arrayElement(allProjectIds),
        filename: `project-file-${i + 1}.pdf`,
        url: `https://example.com/projects/${faker.string.alphanumeric(12)}.pdf`,
        mimeType: 'application/pdf',
        size: faker.number.int({ min: 2048, max: 256000 }),
      },
    });
  }

  const auditCount = await prisma.auditLog.count({ where: { companyId: company.id } });
  const entities = ['Project', 'Voucher', 'Vendor', 'Account', 'User'];
  for (let i = auditCount; i < 20; i++) {
    const entityType = faker.helpers.arrayElement(entities);
    const entityId = entityType === 'Project' ? faker.helpers.arrayElement(allProjectIds)
      : entityType === 'Voucher' ? (await prisma.voucher.findFirst({ where: { companyId: company.id }, select: { id: true } }))?.id ?? ctx.projectIds.main
      : entityType === 'Vendor' ? faker.helpers.arrayElement(ctx.vendorIds)
      : entityType === 'Account' ? (Object.values(ctx.accountIdsByCode))[i % Object.keys(ctx.accountIdsByCode).length]
      : faker.helpers.arrayElement(ctx.userIds);
    await prisma.auditLog.create({
      data: {
        companyId: company.id,
        entityType,
        entityId,
        action: faker.helpers.arrayElement(['CREATE', 'UPDATE', 'VIEW', 'DELETE']),
        actorUserId: faker.helpers.arrayElement(ctx.userIds),
        before: { old: faker.lorem.word() },
        after: { new: faker.lorem.word() },
        diffJson: { changed: ['name'] },
        metaJson: { ip: '127.0.0.1' },
      },
    });
  }

  // Seed expense categories (construction-oriented, with code and sortOrder)
  const defaultExpenseCategories: { name: string; code: string | null; sortOrder: number }[] = [
    { name: 'Land & Legal', code: 'LAND_LEGAL', sortOrder: 10 },
    { name: 'Design & Approvals', code: 'DESIGN', sortOrder: 20 },
    { name: 'Construction Material', code: 'MATERIAL', sortOrder: 30 },
    { name: 'Labor & Workforce', code: 'LABOR', sortOrder: 40 },
    { name: 'Machinery & Equipment', code: 'MACHINERY', sortOrder: 50 },
    { name: 'Sub-Contractor', code: 'SUBCONTRACTOR', sortOrder: 60 },
    { name: 'Utilities & Site Ops', code: 'UTILITIES', sortOrder: 70 },
    { name: 'Transport & Logistics', code: 'TRANSPORT', sortOrder: 80 },
    { name: 'Site Admin & Misc', code: 'SITE_ADMIN', sortOrder: 90 },
    { name: 'Finance & Statutory', code: 'FINANCE', sortOrder: 100 },
    { name: 'Marketing & Sales', code: 'MARKETING', sortOrder: 110 },
    { name: 'Head Office', code: 'HEAD_OFFICE', sortOrder: 120 },
    { name: 'Contingency', code: 'CONTINGENCY', sortOrder: 130 },
    { name: 'Uncategorized', code: 'UNCAT', sortOrder: 999 },
  ];
  for (const cat of defaultExpenseCategories) {
    const category = await prisma.expenseCategory.upsert({
      where: {
        companyId_name: {
          companyId: company.id,
          name: cat.name,
        },
      },
      update: { code: cat.code, sortOrder: cat.sortOrder },
      create: {
        companyId: company.id,
        name: cat.name,
        code: cat.code,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
    });
    ctx.expenseCategoryIds.push(category.id);
    ctx.expenseCategoryIdToName[category.id] = category.name;
  }

  // Map expense accounts to categories (by account code -> category name/code)
  const accountCodeToCategoryName: Record<string, string> = {
    '5010': 'Construction Material',  // Direct Materials
    '5020': 'Labor & Workforce',     // Direct Labor
    '5030': 'Utilities & Site Ops', // Site Overhead
    '5040': 'Head Office',          // Office Rent
    '5050': 'Utilities & Site Ops', // Utilities
    '5060': 'Transport & Logistics',// Fuel
    '5070': 'Machinery & Equipment', // Equipment Rental
    '5090': 'Site Admin & Misc',     // Misc Expense
  };
  const categoryNameToId = Object.fromEntries(
    (await prisma.expenseCategory.findMany({
      where: { companyId: company.id },
      select: { id: true, name: true },
    })).map((c) => [c.name, c.id])
  );
  for (const [accCode, catName] of Object.entries(accountCodeToCategoryName)) {
    const accId = ctx.accountIdsByCode[accCode];
    const catId = categoryNameToId[catName];
    if (accId && catId) {
      await prisma.account.update({
        where: { id: accId },
        data: { expenseCategoryId: catId },
      });
    }
  }

  // Seed expenses - create expenses across 2 projects including MATI KATA and MATERIALS
  const existingExpenses = await prisma.expense.count({ where: { companyId: company.id } });
  const expensesToCreate = Math.max(0, 10 - existingExpenses);
  
  const expenseSources: ExpenseSource[] = [ExpenseSource.WAREHOUSE, ExpenseSource.LABOR];
  
  // Get expense account IDs (debit accounts)
  const debitAccountIds = [
    ctx.accountIdsByCode['5010'], // Direct Materials
    ctx.accountIdsByCode['5020'], // Direct Labor
    ctx.accountIdsByCode['5030'], // Site Overhead
  ].filter(Boolean) as string[];

  // Get payment account IDs (credit accounts - cash/bank)
  const creditAccountIds = [
    ctx.accountIdsByCode['1010'], // Cash
    ctx.accountIdsByCode['1020'], // Bank
  ].filter(Boolean) as string[];

  for (let i = 0; i < expensesToCreate; i++) {
    const projectId = faker.helpers.arrayElement(allProjectIds);
    // Determine mainProjectId
    const selectedProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { parentProjectId: true },
    });
    const mainProjectId = selectedProject?.parentProjectId || projectId;
    
    const date = faker.date.between({ from: past90, to: now });
    const categoryId = faker.helpers.arrayElement(ctx.expenseCategoryIds);
    const source = faker.helpers.arrayElement(expenseSources);
    const amount = faker.number.float({ min: 1000, max: 50000, fractionDigits: 2 });
    const vendorId = faker.number.float({ min: 0, max: 1 }) < 0.7 ? faker.helpers.arrayElement(ctx.vendorIds) : null;
    const paymentMethodId = faker.helpers.arrayElement(ctx.paymentMethodIds);
    const debitAccountId = debitAccountIds.length > 0 ? faker.helpers.arrayElement(debitAccountIds) : debitAccountIds[0];
    const creditAccountId = creditAccountIds.length > 0 ? faker.helpers.arrayElement(creditAccountIds) : creditAccountIds[0];
    const paidByUserId = faker.helpers.arrayElement(ctx.userIds);
    
    // Generate voucher number
    const voucherNo = nextVoucherNo(ctx, 'PV');
    
    // Create expense with voucher in transaction
    await prisma.$transaction(async (tx) => {
      // Create voucher
      const voucher = await tx.voucher.create({
        data: {
          companyId: company.id,
          projectId,
          voucherNo,
          type: VoucherType.PAYMENT,
          date,
          status: VoucherStatus.POSTED,
          narration: `Expense: ${faker.lorem.sentence()}`,
          createdByUserId: paidByUserId,
          postedByUserId: paidByUserId,
          postedAt: new Date(),
          lines: {
            create: [
              {
                companyId: company.id,
                accountId: debitAccountId,
                description: 'Expense',
                debit: amount,
                credit: 0,
                projectId,
                paymentMethodId,
              },
              {
                companyId: company.id,
                accountId: creditAccountId,
                description: 'Payment',
                debit: 0,
                credit: amount,
                projectId,
                paymentMethodId,
                vendorId,
              },
            ],
          },
        },
      });

      // Create expense (with category snapshot for reporting)
      await tx.expense.create({
        data: {
          companyId: company.id,
          projectId,
          mainProjectId,
          date,
          categoryId,
          categoryNameSnapshot: ctx.expenseCategoryIdToName[categoryId] ?? null,
          source,
          amount,
          paidByUserId,
          paidTo: vendorId ? null : faker.company.name(),
          vendorId,
          paymentMethodId,
          debitAccountId,
          creditAccountId,
          voucherId: voucher.id,
          notes: faker.lorem.sentence(),
        },
      });
    });
  }

  // Seed stock items (only when SEED_STOCK=true; default: do not seed stock)
  const stockItemIds: string[] = [];
  if (process.env.SEED_STOCK === 'true') {
  const stockItemsData = [
    { name: 'Cement', sku: 'STK-CEM-001', unit: 'bag', category: 'Construction Materials', reorderLevel: 50 },
    { name: 'Steel Rod', sku: 'STK-STL-001', unit: 'kg', category: 'Construction Materials', reorderLevel: 500 },
    { name: 'Sand', sku: 'STK-SND-001', unit: 'cft', category: 'Construction Materials', reorderLevel: 100 },
    { name: 'Brick', sku: 'STK-BRK-001', unit: 'pcs', category: 'Construction Materials', reorderLevel: 1000 },
    { name: 'Stone Chips', sku: 'STK-STC-001', unit: 'cft', category: 'Construction Materials', reorderLevel: 50 },
    { name: 'Paint', sku: 'STK-PNT-001', unit: 'liter', category: 'Finishing Materials', reorderLevel: 20 },
    { name: 'Tiles', sku: 'STK-TIL-001', unit: 'sqft', category: 'Finishing Materials', reorderLevel: 200 },
    { name: 'PVC Pipe', sku: 'STK-PVC-001', unit: 'ft', category: 'Plumbing', reorderLevel: 100 },
    { name: 'Electrical Wire', sku: 'STK-ELC-001', unit: 'meter', category: 'Electrical', reorderLevel: 200 },
    { name: 'Wood', sku: 'STK-WOD-001', unit: 'cft', category: 'Construction Materials', reorderLevel: 30 },
    { name: 'Nails', sku: 'STK-NAI-001', unit: 'kg', category: 'Hardware', reorderLevel: 10 },
    { name: 'Screws', sku: 'STK-SCR-001', unit: 'kg', category: 'Hardware', reorderLevel: 5 },
  ];

  for (const itemData of stockItemsData) {
    const existing = await prisma.stockItem.findFirst({
      where: {
        companyId: company.id,
        name: itemData.name,
      },
    });

    let stockItem;
    if (existing) {
      stockItem = existing;
    } else {
      stockItem = await prisma.stockItem.create({
        data: {
          companyId: company.id,
          name: itemData.name,
          sku: itemData.sku,
          unit: itemData.unit,
          category: itemData.category,
          reorderLevel: itemData.reorderLevel ? new Prisma.Decimal(itemData.reorderLevel) : null,
          isActive: true,
        },
      });

      // Create initial balance
      await prisma.stockBalance.create({
        data: {
          companyId: company.id,
          stockItemId: stockItem.id,
          onHandQty: new Prisma.Decimal(0),
          avgCost: new Prisma.Decimal(0),
        },
      });
    }
    stockItemIds.push(stockItem.id);
  }

  // Create some stock movements (IN) to populate balances
  const userId = ctx.userIds[0]; // Use first user
  const stockNow = new Date();
  const past30 = new Date(stockNow.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Create IN movements for some items
  for (let i = 0; i < Math.min(8, stockItemIds.length); i++) {
    const stockItemId = stockItemIds[i];
    const itemData = stockItemsData[i];
    
    // Create 1-3 IN movements per item
    const numMovements = faker.number.int({ min: 1, max: 3 });
    
    for (let j = 0; j < numMovements; j++) {
      const qty = faker.number.float({ min: 10, max: 100, fractionDigits: 3 });
      const unitCost = faker.number.float({ min: 50, max: 500, fractionDigits: 2 });
      const movementDate = faker.date.between({ from: past30, to: stockNow });

      // Check if movement already exists (idempotency)
      const existing = await prisma.stockMovement.findFirst({
        where: {
          companyId: company.id,
          stockItemId,
          type: 'IN',
          referenceType: 'SEED',
        },
      });

      if (!existing) {
        // Create movement and update balance
        await prisma.$transaction(async (tx) => {
          // Create movement
          const movement = await tx.stockMovement.create({
            data: {
              companyId: company.id,
              stockItemId,
              movementDate,
              type: StockMovementType.IN,
              qty: new Prisma.Decimal(qty),
              unitCost: new Prisma.Decimal(unitCost),
              referenceType: 'SEED',
              referenceId: `seed-${stockItemId}-${j}`,
              notes: 'Seed data',
              createdById: userId,
            },
          });

          // Update balance
          const balance = await tx.stockBalance.findUnique({
            where: {
              companyId_stockItemId: {
                companyId: company.id,
                stockItemId,
              },
            },
          });

          if (balance) {
            const newQty = balance.onHandQty.plus(qty);
            const newAvgCost = balance.onHandQty.gt(0)
              ? balance.onHandQty.mul(balance.avgCost).plus(new Prisma.Decimal(qty).mul(unitCost)).div(newQty)
              : new Prisma.Decimal(unitCost);

            await tx.stockBalance.update({
              where: { id: balance.id },
              data: {
                onHandQty: newQty,
                avgCost: newAvgCost,
              },
            });
          }
        });
      }
    }
  }

  // Create a few OUT movements
  for (let i = 0; i < Math.min(3, stockItemIds.length); i++) {
    const stockItemId = stockItemIds[i];
    
    // Get current balance
    const balance = await prisma.stockBalance.findUnique({
      where: {
        companyId_stockItemId: {
          companyId: company.id,
          stockItemId,
        },
      },
    });

    if (balance && balance.onHandQty.gt(0)) {
      const availableQty = Number(balance.onHandQty);
      const qty = faker.number.float({ min: 1, max: Math.min(availableQty * 0.3, 20), fractionDigits: 3 });
      const movementDate = faker.date.between({ from: past30, to: stockNow });
      const projectId = faker.helpers.arrayElement([ctx.projectIds.main, ...ctx.projectIds.subs]);

      // Check if movement already exists
      const existing = await prisma.stockMovement.findFirst({
        where: {
          companyId: company.id,
          stockItemId,
          type: 'OUT',
          referenceType: 'SEED',
        },
      });

      if (!existing && qty > 0) {
        await prisma.$transaction(async (tx) => {
          // Create movement
          await tx.stockMovement.create({
            data: {
              companyId: company.id,
              stockItemId,
              movementDate,
              type: StockMovementType.OUT,
              qty: new Prisma.Decimal(qty),
              referenceType: 'SEED',
              referenceId: `seed-out-${stockItemId}`,
              projectId,
              notes: 'Seed data - stock issue',
              createdById: userId,
            },
          });

          // Update balance
          const updatedBalance = await tx.stockBalance.findUnique({
            where: {
              companyId_stockItemId: {
                companyId: company.id,
                stockItemId,
              },
            },
          });

          if (updatedBalance) {
            await tx.stockBalance.update({
              where: { id: updatedBalance.id },
              data: {
                onHandQty: updatedBalance.onHandQty.minus(qty),
              },
            });
          }
        });
      }
    }
  }
  }

  // Seed purchases with mixed line types (MATERIAL, SERVICE, OTHER)
  if (stockItemIds.length > 0 && ctx.vendorIds.length > 0) {
    const purchaseCount = 2;

    for (let i = 0; i < purchaseCount; i++) {
      const date = faker.date.between({ from: past90, to: now });
      const projectId = ctx.projectIds.main;
      const subProjectId = faker.helpers.arrayElement([...ctx.projectIds.subs, null]);
      const vendorId = faker.helpers.arrayElement(ctx.vendorIds);
      const challanNo = `CH-${String(i + 1).padStart(4, '0')}`;
      const discountPercent = faker.number.float({ min: 0, max: 5, fractionDigits: 2 });

      // Create purchase with mixed line types
      const purchase = await prisma.purchase.create({
        data: {
          companyId: company.id,
          date,
          challanNo,
          projectId,
          subProjectId,
          supplierVendorId: vendorId,
          reference: `Purchase ${i + 1}`,
          discountPercent: discountPercent > 0 ? new Prisma.Decimal(discountPercent) : null,
          subtotal: new Prisma.Decimal(0), // Will be computed
          total: new Prisma.Decimal(0), // Will be computed
          paidAmount: new Prisma.Decimal(0),
          dueAmount: new Prisma.Decimal(0),
          status: PurchaseStatus.DRAFT,
          lines: {
            create: [
              // MATERIAL line
              {
                lineType: PurchaseLineType.MATERIAL,
                stockItemId: faker.helpers.arrayElement(stockItemIds),
                quantity: new Prisma.Decimal(faker.number.float({ min: 10, max: 100, fractionDigits: 3 })),
                unit: 'bag', // Default unit, will be set from stockItem
                unitRate: new Prisma.Decimal(faker.number.float({ min: 50, max: 500, fractionDigits: 2 })),
                lineTotal: new Prisma.Decimal(0), // Will be computed
              },
              // SERVICE line
              {
                lineType: PurchaseLineType.SERVICE,
                description: 'Mason labor',
                quantity: new Prisma.Decimal(faker.number.float({ min: 1, max: 10, fractionDigits: 1 })),
                unit: 'day',
                unitRate: new Prisma.Decimal(faker.number.float({ min: 500, max: 2000, fractionDigits: 2 })),
                lineTotal: new Prisma.Decimal(0), // Will be computed
              },
              // OTHER line
              {
                lineType: PurchaseLineType.OTHER,
                description: 'Transport cost',
                lineTotal: new Prisma.Decimal(faker.number.float({ min: 500, max: 3000, fractionDigits: 2 })),
              },
            ],
          },
        },
        include: { lines: true },
      });

      // Compute line totals and purchase totals
      const lines = purchase.lines;
      const computedLines = lines.map((line) => {
        let lineTotal = line.lineTotal;
        if (line.lineType === PurchaseLineType.MATERIAL || line.lineType === PurchaseLineType.SERVICE) {
          if (line.quantity && line.unitRate) {
            lineTotal = line.quantity.mul(line.unitRate);
          }
        }
        return { ...line, lineTotal };
      });

      // Update lines with computed totals
      for (const line of computedLines) {
        if (!line.lineTotal.equals(purchase.lines.find((l) => l.id === line.id)!.lineTotal)) {
          await prisma.purchaseLine.update({
            where: { id: line.id },
            data: { lineTotal: line.lineTotal },
          });
        }
      }

      // Compute purchase totals
      const subtotal = computedLines.reduce((sum, line) => sum.plus(line.lineTotal), new Prisma.Decimal(0));
      const discount = discountPercent > 0 ? subtotal.mul(discountPercent).div(100) : new Prisma.Decimal(0);
      const total = subtotal.minus(discount);
      const paidAmount = new Prisma.Decimal(0);
      const dueAmount = total;

      await prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          subtotal,
          total,
          paidAmount,
          dueAmount,
        },
      });

      // POST the first purchase with MATERIAL lines to create stock movements
      if (i === 0) {
      // Reload purchase with MATERIAL lines and related data
      const purchaseToPost = await prisma.purchase.findUnique({
        where: {
          id: purchase.id,
          companyId: company.id,
        },
        include: {
          lines: {
            where: {
              lineType: PurchaseLineType.MATERIAL,
              stockItemId: { not: null },
              quantity: { gt: 0 },
            },
            include: {
              stockItem: true,
            },
          },
          supplierVendor: true,
        },
      });

      if (purchaseToPost && purchaseToPost.lines.length > 0) {
        // Create voucher for this purchase
        const voucherNo = nextVoucherNo(ctx, 'JV');
        const userId = ctx.userIds[0];
        const apAccountId = ctx.accountIdsByCode['2010'];
        const materialsAccountId = ctx.accountIdsByCode['5010'];

        if (apAccountId && materialsAccountId) {
          // Build voucher lines
          const voucherLines: any[] = [];
          let totalDebit = new Prisma.Decimal(0);

          for (const line of purchaseToPost.lines) {
            if (line.lineType === PurchaseLineType.MATERIAL && line.stockItemId && line.quantity && line.quantity.gt(0)) {
              const lineTotal = line.lineTotal || (line.quantity.mul(line.unitRate || 0));
              voucherLines.push({
                companyId: company.id,
                accountId: materialsAccountId,
                description: `${line.stockItem?.name || 'Material'} - ${line.quantity.toString()} ${line.stockItem?.unit || ''}`,
                debit: lineTotal,
                credit: new Prisma.Decimal(0),
                projectId: purchaseToPost.projectId,
                vendorId: purchaseToPost.supplierVendorId,
              });
              totalDebit = totalDebit.plus(lineTotal);
            }
          }

          // Add AP credit line
          voucherLines.push({
            companyId: company.id,
            accountId: apAccountId,
            description: `Accounts Payable - ${purchaseToPost.supplierVendor.name} - ${purchaseToPost.challanNo || purchaseToPost.id}`,
            debit: new Prisma.Decimal(0),
            credit: totalDebit,
            vendorId: purchaseToPost.supplierVendorId,
          });

          // Create and POST the voucher
          const voucher = await prisma.voucher.create({
            data: {
              companyId: company.id,
              projectId: purchaseToPost.projectId,
              voucherNo,
              type: VoucherType.JOURNAL,
              date: purchaseToPost.date,
              status: VoucherStatus.POSTED,
              narration: `Purchase: ${purchaseToPost.challanNo || 'N/A'} - ${purchaseToPost.supplierVendor.name}`,
              expenseType: ExpenseType.PROJECT_EXPENSE,
              createdByUserId: userId,
              postedByUserId: userId,
              postedAt: purchaseToPost.date,
              lines: {
                create: voucherLines,
              },
            },
          });

          // Link purchase to voucher and set status to POSTED
          await prisma.purchase.update({
            where: { id: purchaseToPost.id },
            data: {
              voucherId: voucher.id,
              status: PurchaseStatus.POSTED,
            },
          });

          // Create stock movements for MATERIAL lines
          for (const line of purchaseToPost.lines) {
            if (line.lineType === PurchaseLineType.MATERIAL && line.stockItemId && line.quantity && line.quantity.gt(0)) {
              // Check if movement already exists
              const existing = await prisma.stockMovement.findFirst({
                where: {
                  companyId: company.id,
                  stockItemId: line.stockItemId,
                  type: StockMovementType.IN,
                  referenceType: 'PURCHASE_VOUCHER',
                  referenceId: purchaseToPost.id,
                },
              });

              if (!existing) {
                const unitCost = line.unitRate || (line.lineTotal && line.quantity ? line.lineTotal.div(line.quantity) : new Prisma.Decimal(0));

                // Get or create balance
                let balance = await prisma.stockBalance.findUnique({
                  where: {
                    companyId_stockItemId: {
                      companyId: company.id,
                      stockItemId: line.stockItemId,
                    },
                  },
                });

                if (!balance) {
                  balance = await prisma.stockBalance.create({
                    data: {
                      companyId: company.id,
                      stockItemId: line.stockItemId,
                      onHandQty: new Prisma.Decimal(0),
                      avgCost: new Prisma.Decimal(0),
                    },
                  });
                }

                // Create movement
                await prisma.stockMovement.create({
                  data: {
                    companyId: company.id,
                    stockItemId: line.stockItemId,
                    movementDate: purchaseToPost.date,
                    type: StockMovementType.IN,
                    qty: line.quantity,
                    unitCost: unitCost,
                    referenceType: 'PURCHASE_VOUCHER',
                    referenceId: purchaseToPost.id,
                    projectId: purchaseToPost.projectId,
                    vendorId: purchaseToPost.supplierVendorId,
                    notes: `Purchase: ${purchaseToPost.challanNo || purchaseToPost.id}`,
                    createdById: userId,
                  },
                });

                // Update balance
                const newOnHandQty = balance.onHandQty.plus(line.quantity);
                const newAvgCost = balance.onHandQty.gt(0)
                  ? balance.onHandQty.mul(balance.avgCost).plus(line.quantity.mul(unitCost)).div(newOnHandQty)
                  : unitCost;

                await prisma.stockBalance.update({
                  where: { id: balance.id },
                  data: {
                    onHandQty: newOnHandQty,
                    avgCost: newAvgCost,
                  },
                });
              }
            }
          }

          console.log(`✅ Posted purchase ${purchaseToPost.challanNo || purchaseToPost.id} with ${purchaseToPost.lines.length} MATERIAL line(s)`);
        }
      }
      }
    }
  }

  return ctx;
}

async function main() {
  const isProduction = process.env.NODE_ENV === 'production';
  const forceProduction = process.env.SEED_ALLOW_PRODUCTION === '1' || process.env.SEED_ALLOW_PRODUCTION === 'true';
  if (isProduction && !forceProduction) {
    console.error('❌ Do not run seed in production. Seed creates/overwrites demo data.');
    console.error('   To override (use with caution), set SEED_ALLOW_PRODUCTION=1');
    process.exit(1);
  }

  console.log('🌱 Starting comprehensive seed...');
  passwordHash = await bcrypt.hash(PASSWORD, 10);

  const companies: { name: string; ctx: SeedContext }[] = [];
  for (const name of COMPANY_NAMES) {
    const ctx = await seedCompany(name);
    companies.push({ name, ctx });
  }

  const totalUsers = companies.reduce((s, c) => s + c.ctx.userIds.length, 0);
  const totalProjects = companies.reduce((s, c) => s + 1 + c.ctx.projectIds.subs.length, 0);
  const totalVouchers = await prisma.voucher.count();
  const totalStockItems = await prisma.stockItem.count();
  const totalStockMovements = await prisma.stockMovement.count();

  console.log('\n✅ Seed complete.\n');
  console.log('Summary:');
  console.log(`  Companies: ${companies.length} (${COMPANY_NAMES.join(', ')})`);
  console.log(`  Users: ${totalUsers} (password: ${PASSWORD})`);
  console.log(`  Projects: ${totalProjects} (1 main + 3 sub per company)`);
  console.log(`  Vouchers: ${totalVouchers}`);
  console.log(`  Stock Items: ${totalStockItems}`);
  console.log(`  Stock Movements: ${totalStockMovements}`);
  console.log('\nRun `npx prisma db seed` or `npm run db:seed` to re-seed.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
