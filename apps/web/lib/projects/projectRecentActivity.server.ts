import { prisma } from '@accounting/db';
import { Prisma } from '@prisma/client';

export type ActivityType = 'purchase' | 'stock_in' | 'stock_out' | 'labor' | 'debit' | 'credit';

export interface ActivityItem {
  date: Date;
  type: ActivityType;
  title: string;
  amount: number | null;
  link: string;
}

const ACTIVITY_LIMIT_PER_SOURCE = 20;
const COMBINED_LIMIT = 15;

function buildPurchaseWhere(projectId: string, companyId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { isMain: true, parentProjectId: true },
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
 * Unified activity feed: last 20 from purchases, stock, labor, debit, credit;
 * normalize to { date, type, title, amount, link }, sort by date desc, return last 15.
 */
export async function getProjectRecentActivity(
  projectId: string,
  companyId: string
): Promise<ActivityItem[]> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });
  if (!project) {
    throw new Error('Project not found or does not belong to company');
  }

  const purchaseWhere = await buildPurchaseWhere(projectId, companyId);
  if (!purchaseWhere) {
    throw new Error('Project not found or does not belong to company');
  }

  const [purchases, stockMovements, labors, voucherLines, credits] = await Promise.all([
    prisma.purchase.findMany({
      where: purchaseWhere,
      orderBy: { date: 'desc' },
      take: ACTIVITY_LIMIT_PER_SOURCE,
      select: {
        id: true,
        date: true,
        total: true,
        supplierVendor: { select: { name: true } },
      },
    }),
    prisma.stockMovement.findMany({
      where: {
        companyId,
        OR: [{ projectId }, { destinationProjectId: projectId }],
      },
      orderBy: { movementDate: 'desc' },
      take: ACTIVITY_LIMIT_PER_SOURCE,
      select: {
        id: true,
        movementDate: true,
        type: true,
        qty: true,
        unitCost: true,
        stockItem: { select: { name: true } },
      },
    }),
    prisma.projectLabor.findMany({
      where: { projectId, companyId },
      orderBy: { date: 'desc' },
      take: ACTIVITY_LIMIT_PER_SOURCE,
      select: { id: true, date: true, amount: true, type: true },
    }),
    prisma.voucherLine.findMany({
      where: { projectId, companyId },
      orderBy: { voucher: { date: 'desc' } },
      take: ACTIVITY_LIMIT_PER_SOURCE,
      select: {
        id: true,
        debit: true,
        voucher: { select: { id: true, date: true } },
      },
    }),
    prisma.credit.findMany({
      where: { projectId, companyId },
      orderBy: { date: 'desc' },
      take: ACTIVITY_LIMIT_PER_SOURCE,
      select: { id: true, date: true, amount: true, purpose: true },
    }),
  ]);

  const items: ActivityItem[] = [];

  for (const p of purchases) {
    items.push({
      date: p.date,
      type: 'purchase',
      title: `Purchase from ${p.supplierVendor.name}`,
      amount: p.total.toNumber(),
      link: `/dashboard/purchases/${p.id}`,
    });
  }

  for (const s of stockMovements) {
    const qty = s.qty.toNumber();
    const value = s.unitCost ? qty * s.unitCost.toNumber() : null;
    const label = s.type === 'IN' ? 'Stock received' : 'Stock used';
    items.push({
      date: s.movementDate,
      type: s.type === 'IN' ? 'stock_in' : 'stock_out',
      title: `${label}: ${s.stockItem.name}`,
      amount: value,
      link: `/dashboard/projects/${projectId}/stock`,
    });
  }

  for (const l of labors) {
    items.push({
      date: l.date,
      type: 'labor',
      title: l.type === 'DAY' ? 'Day labor' : 'Monthly labor',
      amount: l.amount.toNumber(),
      link: l.type === 'DAY'
        ? `/dashboard/projects/${projectId}/labor/day`
        : `/dashboard/projects/${projectId}/labor/monthly`,
    });
  }

  for (const line of voucherLines) {
    items.push({
      date: line.voucher.date,
      type: 'debit',
      title: 'Debit',
      amount: line.debit.toNumber(),
      link: `/dashboard/debit/${line.voucher.id}`,
    });
  }

  for (const c of credits) {
    items.push({
      date: c.date,
      type: 'credit',
      title: c.purpose || 'Credit',
      amount: c.amount.toNumber(),
      link: `/dashboard/credit?projectId=${projectId}`,
    });
  }

  items.sort((a, b) => b.date.getTime() - a.date.getTime());
  return items.slice(0, COMBINED_LIMIT);
}
