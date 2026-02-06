import { prisma } from '@accounting/db';
import { Prisma } from '@prisma/client';

export interface LastPurchaseItem {
  id: string;
  date: Date;
  challanNo: string | null;
  total: number;
  paidAmount: number;
  dueAmount: number;
  vendorName: string;
}

export interface ProjectPurchasesOverview {
  pendingBills: number;
  advancePaid: number;
  lastPurchases: LastPurchaseItem[];
}

/**
 * Build purchase where clause for a project (main or sub-project).
 */
function buildPurchaseWhere(projectId: string, companyId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true, isMain: true, parentProjectId: true },
  }).then((project) => {
    if (!project) return null;
    const where: Prisma.PurchaseWhereInput = { companyId };
    if (project.isMain) {
      where.projectId = projectId;
    } else {
      where.projectId = project.parentProjectId ?? projectId;
      where.subProjectId = projectId;
    }
    return where;
  });
}

/**
 * Pending bills = sum(dueAmount) for purchases where dueAmount > 0.
 * Advance paid: not stored separately, returns 0.
 * Last 5 purchases: date desc, with vendor name, total, paid, due, challan no.
 */
export async function getProjectPurchasesOverview(
  projectId: string,
  companyId: string
): Promise<ProjectPurchasesOverview> {
  const baseWhere = await buildPurchaseWhere(projectId, companyId);
  if (!baseWhere) {
    throw new Error('Project not found or does not belong to company');
  }

  const pendingWhere = {
    ...baseWhere,
    dueAmount: { gt: new Prisma.Decimal(0) },
  };

  const [pendingAgg, lastPurchasesRows] = await Promise.all([
    prisma.purchase.aggregate({
      where: pendingWhere,
      _sum: { dueAmount: true },
    }),
    prisma.purchase.findMany({
      where: baseWhere,
      orderBy: { date: 'desc' },
      take: 5,
      select: {
        id: true,
        date: true,
        challanNo: true,
        total: true,
        paidAmount: true,
        dueAmount: true,
        supplierVendor: { select: { name: true } },
      },
    }),
  ]);

  const pendingBills = pendingAgg._sum.dueAmount?.toNumber() ?? 0;
  const lastPurchases: LastPurchaseItem[] = lastPurchasesRows.map((p) => ({
    id: p.id,
    date: p.date,
    challanNo: p.challanNo,
    total: p.total.toNumber(),
    paidAmount: p.paidAmount.toNumber(),
    dueAmount: p.dueAmount.toNumber(),
    vendorName: p.supplierVendor.name,
  }));

  return {
    pendingBills,
    advancePaid: 0,
    lastPurchases,
  };
}
