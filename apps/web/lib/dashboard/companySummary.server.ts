/**
 * Company Dashboard Summary
 * Aggregates company-wide totals, health metrics, and per-project overview.
 * All totals respect date range except stock value (current valuation).
 */

import { prisma } from '@accounting/db';
import { SYSTEM_ACCOUNT_CODES } from '@/lib/systemAccounts';
import { getProjectTotalCredit } from '@/lib/credits/creditTotals.server';

export interface CompanySummaryOptions {
  dateFrom?: Date;
  dateTo?: Date;
}

export interface CompanySummary {
  companyName: string;
  range: {
    dateFrom: string | null;
    dateTo: string | null;
  };
  kpis: {
    projects: {
      total: number;
      running: number;
      completed: number;
      onHold: number;
    };
  };
  totals: {
    purchases: number;
    stockValue: number;
    investments: number;
    labor: number;
    debit: number;
    credit: number;
  };
  health: {
    netPosition: number;
    cashBalance: number;
    bankBalance: number;
    payables: number;
    receivables: number;
  };
  projectOverview: Array<{
    projectId: string;
    name: string;
    status: string;
    purchases: number;
    debit: number;
    credit: number;
    labor: number;
    netPosition: number;
  }>;
}

function toYMD(d: Date | undefined): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

/**
 * Compute company-wide totals with optional date range.
 * Stock value: current valuation (no date filter).
 * Cash/Bank balance: sum of voucher lines for Cash (1010) and Bank (1020) accounts.
 */
export async function getCompanySummary(
  companyId: string,
  options?: CompanySummaryOptions
): Promise<CompanySummary> {
  const dateFrom = options?.dateFrom;
  const dateTo = options?.dateTo;

  // Build date filter for period-based aggregations
  const purchaseDateFilter = dateFrom != null && dateTo != null
    ? { date: { gte: dateFrom, lte: dateTo } }
    : {};
  const voucherWhere: { status: 'POSTED'; date?: { gte: Date; lte: Date } } = { status: 'POSTED' };
  if (dateFrom != null && dateTo != null) {
    voucherWhere.date = { gte: dateFrom, lte: dateTo };
  }
  const creditDateFilter = dateFrom != null && dateTo != null
    ? { date: { gte: dateFrom, lte: dateTo } }
    : {};
  const laborDateFilter = dateFrom != null && dateTo != null
    ? { date: { gte: dateFrom, lte: dateTo } }
    : {};
  const investmentDateFilter = dateFrom != null && dateTo != null
    ? { date: { gte: dateFrom, lte: dateTo } }
    : {};

  // Company name
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });
  const companyName = company?.name ?? 'Company';

  // Project KPIs (no date filter - counts all projects by status)
  const [projectCounts, purchasesAgg, stockValue, investmentsAgg, laborAgg, debitAgg, creditAgg] =
    await Promise.all([
      // Project counts by status
      prisma.project.groupBy({
        where: { companyId, isActive: true },
        by: ['status'],
        _count: { id: true },
      }),

      // Purchases total (date-filtered)
      prisma.purchase.aggregate({
        where: {
          companyId,
          ...purchaseDateFilter,
        },
        _sum: { total: true },
      }),

      // Stock value (current valuation - no date filter)
      (async () => {
        try {
          const movements = await prisma.stockMovement.findMany({
            where: {
              companyId,
              type: 'IN',
              unitCost: { not: null },
            },
            select: { qty: true, unitCost: true },
          });
          return movements.reduce((sum, m) => {
            if (m.unitCost) return sum + m.qty.toNumber() * m.unitCost.toNumber();
            return sum;
          }, 0);
        } catch {
          return 0;
        }
      })(),

      // Investments total (date-filtered)
      prisma.projectInvestment.aggregate({
        where: {
          companyId,
          ...investmentDateFilter,
        },
        _sum: { amount: true },
      }),

      // Labor total (date-filtered)
      prisma.projectLabor.aggregate({
        where: {
          companyId,
          ...laborDateFilter,
        },
        _sum: { amount: true },
      }),

      // Debit total (voucher lines from POSTED vouchers, date-filtered)
      prisma.voucherLine.aggregate({
        where: {
          companyId,
          debit: { gt: 0 },
          voucher: voucherWhere,
        },
        _sum: { debit: true },
      }),

      // Credit total (date-filtered) - use Credit table
      prisma.credit.aggregate({
        where: {
          companyId,
          ...creditDateFilter,
        },
        _sum: { amount: true },
      }),
    ]);

  // Build project KPIs
  const kpiCounts = { total: 0, running: 0, completed: 0, onHold: 0 };
  for (const g of projectCounts) {
    kpiCounts.total += g._count.id;
    if (g.status === 'RUNNING') kpiCounts.running += g._count.id;
    else if (g.status === 'COMPLETED' || g.status === 'CLOSED') kpiCounts.completed += g._count.id;
    else if (g.status === 'ON_HOLD') kpiCounts.onHold += g._count.id;
  }

  const purchases = purchasesAgg._sum.total?.toNumber() ?? 0;
  const debit = debitAgg._sum.debit?.toNumber() ?? 0;
  const credit = creditAgg._sum.amount?.toNumber() ?? 0;

  // Cash and Bank balances (from voucher lines, POSTED vouchers only)
  const [cashBalance, bankBalance] = await Promise.all([
    getAccountBalance(companyId, SYSTEM_ACCOUNT_CODES.CASH),
    getAccountBalance(companyId, SYSTEM_ACCOUNT_CODES.BANK),
  ]);

  // TODO: AP/AR - If the system has AP/AR computed from vouchers, implement here.
  // For now return 0.
  const payables = 0;
  const receivables = 0;

  // Project overview: per-project totals (date-filtered)
  const projects = await prisma.project.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true, status: true, isMain: true, parentProjectId: true },
    orderBy: [
      { status: 'asc' }, // RUNNING before COMPLETED etc.
      { name: 'asc' },
    ],
  });

  const projectOverview: CompanySummary['projectOverview'] = [];
  for (const proj of projects) {
    const purchaseWhere: any = { companyId };
    if (proj.isMain) {
      purchaseWhere.projectId = proj.id;
    } else {
      purchaseWhere.projectId = proj.parentProjectId ?? proj.id;
      purchaseWhere.subProjectId = proj.id;
    }
    if (dateFrom != null && dateTo != null) {
      purchaseWhere.date = { gte: dateFrom, lte: dateTo };
    }

    const projVoucherWhere: { status: 'POSTED'; projectId?: string; date?: { gte: Date; lte: Date } } = {
      status: 'POSTED',
    };
    if (dateFrom != null && dateTo != null) {
      projVoucherWhere.date = { gte: dateFrom, lte: dateTo };
    }
    const debitWhere = {
      companyId,
      voucher: projVoucherWhere,
      OR: [{ projectId: proj.id }, { voucher: { projectId: proj.id } }],
    };

    const [pProjPurchases, pProjDebit, pProjLabor] = await Promise.all([
      prisma.purchase.aggregate({
        where: purchaseWhere,
        _sum: { total: true },
      }),
      prisma.voucherLine.aggregate({
        where: debitWhere,
        _sum: { debit: true },
      }),
      prisma.projectLabor.aggregate({
        where: {
          companyId,
          projectId: proj.id,
          ...laborDateFilter,
        },
        _sum: { amount: true },
      }),
    ]);

    const projectCredit = await getProjectTotalCredit(proj.id, companyId);
    // For project credit, we need date filtering - getProjectTotalCredit doesn't support it.
    // Use direct aggregate for date-filtered credit
    const creditWhere: any = { companyId, projectId: proj.id };
    if (dateFrom != null && dateTo != null) {
      creditWhere.date = { gte: dateFrom, lte: dateTo };
    }
    const pProjCreditAgg = await prisma.credit.aggregate({
      where: creditWhere,
      _sum: { amount: true },
    });
    const pProjCredit = pProjCreditAgg._sum.amount?.toNumber() ?? 0;

    const pPurchases = pProjPurchases._sum.total?.toNumber() ?? 0;
    const pDebit = pProjDebit._sum.debit?.toNumber() ?? 0;
    const pLabor = pProjLabor._sum.amount?.toNumber() ?? 0;
    const pNetPosition = pProjCredit - pDebit;

    projectOverview.push({
      projectId: proj.id,
      name: proj.name,
      status: proj.status,
      purchases: pPurchases,
      debit: pDebit,
      credit: pProjCredit,
      labor: pLabor,
      netPosition: pNetPosition,
    });
  }

  // Sort: RUNNING first, then by name
  const statusOrder: Record<string, number> = {
    RUNNING: 0,
    PLANNING: 1,
    DRAFT: 2,
    ON_HOLD: 3,
    COMPLETED: 4,
    CLOSED: 5,
  };
  projectOverview.sort((a, b) => {
    const oa = statusOrder[a.status] ?? 99;
    const ob = statusOrder[b.status] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  return {
    companyName,
    range: {
      dateFrom: toYMD(dateFrom ?? undefined),
      dateTo: toYMD(dateTo ?? undefined),
    },
    kpis: {
      projects: kpiCounts,
    },
    totals: {
      purchases,
      stockValue,
      investments: investmentsAgg._sum.amount?.toNumber() ?? 0,
      labor: laborAgg._sum.amount?.toNumber() ?? 0,
      debit,
      credit,
    },
    health: {
      netPosition: credit - debit,
      cashBalance,
      bankBalance,
      payables,
      receivables,
    },
    projectOverview,
  };
}

/** Sum debit - credit for an account (balance for ASSET accounts) */
async function getAccountBalance(companyId: string, accountCode: string): Promise<number> {
  try {
    const account = await prisma.account.findUnique({
      where: { companyId_code: { companyId, code: accountCode } },
      select: { id: true },
    });
    if (!account) return 0;

    const lines = await prisma.voucherLine.findMany({
      where: {
        companyId,
        accountId: account.id,
        voucher: { status: 'POSTED' },
      },
      select: { debit: true, credit: true },
    });

    return lines.reduce((sum, l) => {
      return sum + (l.debit.toNumber() - l.credit.toNumber());
    }, 0);
  } catch {
    return 0;
  }
}
