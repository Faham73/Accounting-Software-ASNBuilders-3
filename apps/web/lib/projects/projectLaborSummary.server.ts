import { prisma } from '@accounting/db';

export interface ProjectLaborSummary {
  workersToday: number;
  dailyCost: number;
  monthlyCost: number;
  contractCost: number;
  totalLaborCost: number;
  pendingWages: number;
}

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Labor totals by type (DAY / MONTHLY / CONTRACT), workers today count, and pending wages.
 * totalLaborCost = dailyCost + monthlyCost + contractCost.
 */
export async function getProjectLaborSummary(
  projectId: string,
  companyId: string
): Promise<ProjectLaborSummary> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });

  if (!project) {
    throw new Error('Project not found or does not belong to company');
  }

  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [dayAgg, monthlyAgg, contractAgg, workersTodayCount] = await Promise.all([
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
    prisma.projectLabor.count({
      where: {
        projectId,
        companyId,
        type: 'DAY',
        date: { gte: todayStart, lte: todayEnd },
      },
    }),
  ]);

  const dailyCost = dayAgg._sum.amount?.toNumber() ?? 0;
  const monthlyCost = monthlyAgg._sum.amount?.toNumber() ?? 0;
  const contractCost = contractAgg._sum.amount?.toNumber() ?? 0;
  const totalLaborCost = dailyCost + monthlyCost + contractCost;

  return {
    workersToday: workersTodayCount,
    dailyCost,
    monthlyCost,
    contractCost,
    totalLaborCost,
    pendingWages: 0,
  };
}
