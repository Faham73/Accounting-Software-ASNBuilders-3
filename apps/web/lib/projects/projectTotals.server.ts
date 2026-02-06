import { prisma } from '@accounting/db';
import { Prisma } from '@prisma/client';
import { getProjectTotalCredit, getCompanyTotalCredit } from '../credits/creditTotals.server';

export interface LaborByType {
  DAY: number;
  MONTHLY: number;
  CONTRACT: number;
}

export interface ProjectTotals {
  purchases: number;
  stocks: number;
  investments: number;
  labor: number;
  laborByType: LaborByType;
  debit: number;
  credit: number;
}

export type DebitVoucherStatusFilter = 'POSTED' | 'ALL';

/**
 * Compute totals for a specific project ONLY (not company-wide)
 * All queries MUST filter by both companyId AND projectId to ensure project-scoped totals.
 * 
 * For purchases: If viewing a sub-project, only count purchases where projectId matches
 * the main project AND subProjectId matches the current sub-project.
 * If viewing a main project, count all purchases where projectId matches (regardless of subProjectId).
 *
 * debitVoucherStatus: when 'POSTED' (default for dashboards), only voucher lines from POSTED vouchers
 * are included in debit total. Use 'ALL' to include DRAFT/SUBMITTED/APPROVED/POSTED.
 */
export async function getProjectTotals(
  projectId: string,
  companyId: string,
  options?: { debitVoucherStatus?: DebitVoucherStatusFilter }
): Promise<ProjectTotals> {
  const debitVoucherStatus = options?.debitVoucherStatus ?? 'POSTED';
  // Verify project belongs to company
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId,
    },
    select: {
      id: true,
      isMain: true,
      parentProjectId: true,
    },
  });

  if (!project) {
    throw new Error('Project not found or does not belong to company');
  }

  // Build purchase where clause: for sub-projects, also filter by subProjectId
  const purchaseWhere: any = {
    companyId,
  };
  
  if (project.isMain) {
    // Main project: count all purchases where projectId = main project
    purchaseWhere.projectId = projectId;
  } else {
    // Sub-project: count purchases where projectId = parent AND subProjectId = current sub-project
    purchaseWhere.projectId = project.parentProjectId;
    purchaseWhere.subProjectId = projectId;
  }

  // Compute all totals in parallel - ALL queries filter by companyId + projectId
  const [purchasesTotal, stocksTotal, investmentsTotal, laborTotal, debitTotal, creditTotal] =
    await Promise.all([
      // Purchases total (sum of total field) - PROJECT SCOPED
      prisma.purchase.aggregate({
        where: purchaseWhere,
        _sum: {
          total: true,
        },
      }),

      // Stocks total (sum of qty * unitCost for project-related stock movements) - PROJECT SCOPED
      prisma.stockMovement.aggregate({
        where: {
          projectId, // PROJECT SCOPED: only movements for this project
          companyId,
          type: 'IN', // Only count stock received
        },
        _sum: {
          qty: true,
        },
      }).then(async (result) => {
        // Get total valuation: sum of (qty * unitCost) for all IN movements - PROJECT SCOPED
        const movements = await prisma.stockMovement.findMany({
          where: {
            projectId, // PROJECT SCOPED: only movements for this project
            companyId,
            type: 'IN',
            unitCost: { not: null },
          },
          select: {
            qty: true,
            unitCost: true,
          },
        });

        return movements.reduce((sum, m) => {
          if (m.unitCost) {
            return sum + m.qty.toNumber() * m.unitCost.toNumber();
          }
          return sum;
        }, 0);
      }),

      // Investments total - PROJECT SCOPED
      prisma.projectInvestment.aggregate({
        where: {
          projectId, // PROJECT SCOPED: only investments for this project
          companyId,
        },
        _sum: {
          amount: true,
        },
      }),

      // Labor total - PROJECT SCOPED
      prisma.projectLabor.aggregate({
        where: {
          projectId, // PROJECT SCOPED: only labor entries for this project
          companyId,
        },
        _sum: {
          amount: true,
        },
      }),

      // Debit total (from voucher lines with this project) - PROJECT SCOPED
      // Dashboard: only POSTED vouchers; optional ALL for other views
      // Match if voucherLine.projectId OR voucher.projectId matches (handles null voucherLine.projectId)
      prisma.voucherLine.aggregate({
        where: {
          companyId,
          OR: [
            { projectId },
            { voucher: { projectId } },
          ],
          ...(debitVoucherStatus === 'POSTED' && {
            voucher: { status: 'POSTED' },
          }),
        },
        _sum: {
          debit: true,
        },
      }),

      // Credit total (from voucher lines with this project) - PROJECT SCOPED
      // Use dedicated function that excludes company-level credits
      getProjectTotalCredit(projectId, companyId),
    ]);

  // Labor by type: DAY, MONTHLY, CONTRACT
  let laborByType: LaborByType = { DAY: 0, MONTHLY: 0, CONTRACT: 0 };
  try {
    const [dayAgg, monthlyAgg, contractAgg] = await Promise.all([
      prisma.projectLabor.aggregate({
        where: { projectId, companyId, type: 'DAY' },
        _sum: { amount: true },
      }),
      prisma.projectLabor.aggregate({
        where: { projectId, companyId, type: 'MONTHLY' },
        _sum: { amount: true },
      }),
      prisma.projectLabor.aggregate({
        where: { projectId, companyId, type: 'CONTRACT' },
        _sum: { amount: true },
      }),
    ]);
    laborByType = {
      DAY: dayAgg._sum.amount?.toNumber() ?? 0,
      MONTHLY: monthlyAgg._sum.amount?.toNumber() ?? 0,
      CONTRACT: contractAgg._sum.amount?.toNumber() ?? 0,
    };
  } catch {
    laborByType = {
      DAY: laborTotal._sum.amount?.toNumber() ?? 0,
      MONTHLY: 0,
      CONTRACT: 0,
    };
  }

  return {
    purchases: purchasesTotal._sum.total?.toNumber() || 0,
    stocks: stocksTotal,
    investments: investmentsTotal._sum.amount?.toNumber() || 0,
    labor: laborTotal._sum.amount?.toNumber() || 0,
    laborByType,
    debit: debitTotal._sum.debit?.toNumber() || 0,
    credit: creditTotal, // Already a number from getProjectTotalCredit
  };
}

export type VoucherStatusForTotal = 'ALL' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED';

export interface GetCompanyTotalsOptions {
  /** For debit total: filter by voucher status. Default POSTED for dashboards. Use ALL to include all statuses. */
  debitVoucherStatus?: DebitVoucherStatusFilter;
  /** For debit total: when status filter is specific (e.g. DRAFT), total follows list filter. Overrides debitVoucherStatus when set. */
  voucherStatus?: VoucherStatusForTotal;
  /** When no projectId filter: if false, exclude company-level rows (projectId null) from debit total. Default true. */
  includeCompanyLevel?: boolean;
}

/**
 * Compute company-wide totals (aggregating all projects)
 * This function is for NAVIGATION pages (investments, debit, credit) that show company totals.
 * 
 * If projectId is provided, it acts as an optional filter (for filtering company totals by project).
 * If projectId is NOT provided, returns totals for the entire company.
 * 
 * DO NOT use this function for project view dashboard - use getProjectTotals() instead.
 */
export async function getCompanyTotals(
  companyId: string,
  projectId?: string,
  options?: GetCompanyTotalsOptions
): Promise<{
  purchases: number;
  stocks: number;
  investments: number;
  labor: number;
  debit: number;
  credit: number;
}> {
  // COMPANY SCOPED: filter by companyId only (projectId is optional filter)
  const whereClause: any = { companyId };
  if (projectId) {
    whereClause.projectId = projectId;
  }

  const voucherStatusFilter = options?.voucherStatus ?? options?.debitVoucherStatus ?? 'POSTED';
  const includeCompanyLevel = options?.includeCompanyLevel ?? true;

  const debitWhere: any = {
    companyId,
    debit: { gt: 0 },
  };
  
  // Build project filter and voucher status filter together
  if (projectId) {
    // When filtering by project: match if voucherLine.projectId OR voucher.projectId matches
    // This handles cases where voucherLine.projectId is null but voucher.projectId is set
    // Also apply voucher status filter if needed
    if (voucherStatusFilter !== 'ALL') {
      debitWhere.AND = [
        {
          OR: [
            { projectId },
            { voucher: { projectId } },
          ],
        },
        {
          voucher: { status: voucherStatusFilter },
        },
      ];
    } else {
      debitWhere.OR = [
        { projectId },
        { voucher: { projectId } },
      ];
    }
  } else {
    if (!includeCompanyLevel) {
      // Exclude company-level rows: exclude where BOTH voucherLine.projectId AND voucher.projectId are null
      // Include rows where voucherLine.projectId IS NOT NULL OR voucher.projectId IS NOT NULL
      if (voucherStatusFilter !== 'ALL') {
        debitWhere.AND = [
          {
            OR: [
              { projectId: { not: null } },
              { voucher: { projectId: { not: null } } },
            ],
          },
          {
            voucher: { status: voucherStatusFilter },
          },
        ];
      } else {
        debitWhere.OR = [
          { projectId: { not: null } },
          { voucher: { projectId: { not: null } } },
        ];
      }
    } else if (voucherStatusFilter !== 'ALL') {
      debitWhere.voucher = { status: voucherStatusFilter };
    }
  }

  const [
    purchasesTotal,
    stocksTotal,
    investmentsTotal,
    laborTotal,
    debitTotal,
    creditTotal,
  ] = await Promise.all([
    // Purchases total
    prisma.purchase.aggregate({
      where: whereClause,
      _sum: {
        total: true,
      },
    }),

    // Stocks total (valuation)
    (async () => {
      const stockWhere = { ...whereClause, type: 'IN' as const, unitCost: { not: null } };
      const movements = await prisma.stockMovement.findMany({
        where: stockWhere,
        select: {
          qty: true,
          unitCost: true,
        },
      });

      return movements.reduce((sum, m) => {
        if (m.unitCost) {
          return sum + m.qty.toNumber() * m.unitCost.toNumber();
        }
        return sum;
      }, 0);
    })(),

    // Investments total
    prisma.projectInvestment.aggregate({
      where: whereClause,
      _sum: {
        amount: true,
      },
    }),

    // Labor total
    prisma.projectLabor.aggregate({
      where: whereClause,
      _sum: {
        amount: true,
      },
    }),

    // Debit total (filter by voucher status and optional company-level)
    prisma.voucherLine.aggregate({
      where: debitWhere,
      _sum: {
        debit: true,
      },
    }),

    // Credit total - use company-wide function if no project filter, otherwise use project-specific
    projectId
      ? getProjectTotalCredit(projectId, companyId)
      : getCompanyTotalCredit(companyId),
  ]);

  return {
    purchases: purchasesTotal._sum.total?.toNumber() || 0,
    stocks: stocksTotal,
    investments: investmentsTotal._sum.amount?.toNumber() || 0,
    labor: laborTotal._sum.amount?.toNumber() || 0,
    debit: debitTotal._sum.debit?.toNumber() || 0,
    credit: creditTotal, // Already a number from getCompanyTotalCredit or getProjectTotalCredit
  };
}
