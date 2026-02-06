import { prisma } from '@accounting/db';

export interface ProjectFinancialSnapshotBreakdown {
  materialsCost: number;
  laborCost: number;
  otherExpenses: number;
  consultantCost: number;
  machineryCost: number;
}

export interface ProjectFinancialSnapshot {
  budgetTotal: number | null;
  spent: number;
  remaining: number | null;
  overBudget: boolean;
  /** Manual progress 0–100 */
  progressPercent: number;
  /** (spent / budgetTotal) * 100 when budgetTotal > 0, else 0 */
  costUsedPercent: number;
  breakdown: ProjectFinancialSnapshotBreakdown;
}

export interface GetProjectFinancialSnapshotOptions {
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Total Spent = purchases + debit + labor (investment and credit are not "spent").
 * Fetches project budget and expense totals, optionally filtered by date range.
 */
export async function getProjectFinancialSnapshot(
  projectId: string,
  companyId: string,
  options?: GetProjectFinancialSnapshotOptions
): Promise<ProjectFinancialSnapshot> {
  const { dateFrom, dateTo } = options ?? {};

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId,
    },
    select: {
      id: true,
      isMain: true,
      parentProjectId: true,
      budgetTotal: true,
      progressPercent: true,
    },
  });

  if (!project) {
    throw new Error('Project not found or does not belong to company');
  }

  const budgetTotal = project.budgetTotal ? project.budgetTotal.toNumber() : null;
  const progressPercent = project.progressPercent ?? 0;

  const purchaseWhere: {
    companyId: string;
    projectId: string;
    subProjectId?: string;
    date?: { gte: Date; lte: Date };
  } = {
    companyId,
    projectId: project.isMain ? projectId : (project.parentProjectId ?? projectId),
  };
  if (!project.isMain && project.parentProjectId) {
    purchaseWhere.subProjectId = projectId;
  }
  if (dateFrom != null && dateTo != null) {
    purchaseWhere.date = { gte: dateFrom, lte: dateTo };
  }

  const debitWhere: {
    projectId: string;
    companyId: string;
    voucher: { status: 'POSTED'; date?: { gte: Date; lte: Date } };
  } = {
    projectId,
    companyId,
    voucher: { status: 'POSTED' },
  };
  if (dateFrom != null && dateTo != null) {
    debitWhere.voucher.date = { gte: dateFrom, lte: dateTo };
  }

  const laborWhere: {
    projectId: string;
    companyId: string;
    date?: { gte: Date; lte: Date };
  } = {
    projectId,
    companyId,
  };
  if (dateFrom != null && dateTo != null) {
    laborWhere.date = { gte: dateFrom, lte: dateTo };
  }

  const [purchasesAgg, debitAgg, laborAgg] = await Promise.all([
    prisma.purchase.aggregate({
      where: purchaseWhere,
      _sum: { total: true },
    }),
    prisma.voucherLine.aggregate({
      where: debitWhere,
      _sum: { debit: true },
    }),
    prisma.projectLabor.aggregate({
      where: laborWhere,
      _sum: { amount: true },
    }),
  ]);

  const materialsCost = purchasesAgg._sum.total?.toNumber() ?? 0;
  const otherExpenses = debitAgg._sum.debit?.toNumber() ?? 0;
  const laborCost = laborAgg._sum.amount?.toNumber() ?? 0;

  const spent = materialsCost + laborCost + otherExpenses;
  const remaining = budgetTotal !== null ? budgetTotal - spent : null;
  const overBudget = budgetTotal !== null ? spent > budgetTotal : false;
  const costUsedPercent =
    budgetTotal !== null && budgetTotal > 0 ? (spent / budgetTotal) * 100 : 0;

  return {
    budgetTotal,
    spent,
    remaining,
    overBudget,
    progressPercent,
    costUsedPercent,
    breakdown: {
      materialsCost,
      laborCost,
      otherExpenses,
      consultantCost: 0,
      machineryCost: 0,
    },
  };
}
