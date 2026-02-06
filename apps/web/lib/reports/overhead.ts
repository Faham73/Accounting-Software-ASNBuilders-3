import { prisma } from '@accounting/db';
import { Decimal } from '@prisma/client/runtime/library';
import { decimalToNumber } from '@/lib/payables';

/**
 * Get monthly overhead vouchers
 */
export async function getMonthlyOverhead(
  companyId: string,
  month: Date,
  includeDraft: boolean = false
) {
  // Calculate month start and end
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);

  const where: any = {
    companyId,
    date: {
      gte: monthStart,
      lte: monthEnd,
    },
    OR: [
      { expenseType: 'OFFICE_EXPENSE' },
      { projectId: null, expenseType: null }, // Legacy: null projectId treated as office expense if no expenseType
    ],
  };

  if (!includeDraft) {
    where.status = { in: ['POSTED', 'REVERSED'] };
  }

  const vouchers = await prisma.voucher.findMany({
    where,
    include: {
      lines: {
        include: {
          account: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  // Calculate totals
  let totalOverhead = 0;
  const accountBreakdown = new Map<string, { code: string; name: string; amount: number }>();
  const vendorBreakdown = new Map<string, { id: string; name: string; amount: number }>();

  vouchers.forEach((voucher) => {
    voucher.lines.forEach((line) => {
      // Only count expense accounts (debit side for expenses)
      if (line.account.type === 'EXPENSE' && decimalToNumber(line.debit) > 0) {
        const amount = decimalToNumber(line.debit);
        totalOverhead += amount;

        // Account breakdown
        const accountKey = line.account.id;
        const existing = accountBreakdown.get(accountKey) || {
          code: line.account.code,
          name: line.account.name,
          amount: 0,
        };
        existing.amount += amount;
        accountBreakdown.set(accountKey, existing);

        // Vendor breakdown
        if (line.vendor) {
          const vendorKey = line.vendor.id;
          const existingVendor = vendorBreakdown.get(vendorKey) || {
            id: line.vendor.id,
            name: line.vendor.name,
            amount: 0,
          };
          existingVendor.amount += amount;
          vendorBreakdown.set(vendorKey, existingVendor);
        }
      }
    });
  });

  return {
    vouchers,
    totalOverhead,
    accountBreakdown: Array.from(accountBreakdown.values()).sort((a, b) => b.amount - a.amount),
    vendorBreakdown: Array.from(vendorBreakdown.values()).sort((a, b) => b.amount - a.amount),
    monthStart,
    monthEnd,
  };
}

/**
 * Compute overhead allocation
 */
export async function computeAllocation(
  companyId: string,
  month: Date,
  method: 'PERCENT' | 'CONTRACT_VALUE',
  allocations?: Record<string, number> // For PERCENT method: { projectId: percent }
) {
  const warnings: string[] = [];
  const results: Array<{ projectId: string; projectName: string; amount: number; percent?: number }> = [];

  // Get monthly overhead total
  const overheadData = await getMonthlyOverhead(companyId, month, false);
  const totalOverhead = overheadData.totalOverhead;

  if (totalOverhead === 0) {
    warnings.push('No overhead expenses found for this month');
    return { results, warnings, totalOverhead };
  }

  if (method === 'PERCENT') {
    if (!allocations) {
      warnings.push('Allocation percentages are required for PERCENT method');
      return { results, warnings, totalOverhead };
    }

    // Validate percentages sum to 100
    const totalPercent = Object.values(allocations).reduce((sum, p) => sum + p, 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      warnings.push(`Percentages sum to ${totalPercent}% instead of 100%`);
    }

    // Get projects
    const projectIds = Object.keys(allocations);
    const projects = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Compute allocations
    for (const projectId of projectIds) {
      const percent = allocations[projectId];
      const project = projects.find((p) => p.id === projectId);
      if (!project) {
        warnings.push(`Project ${projectId} not found`);
        continue;
      }

      const amount = (totalOverhead * percent) / 100;
      results.push({
        projectId: project.id,
        projectName: project.name,
        amount,
        percent,
      });
    }
  } else if (method === 'CONTRACT_VALUE') {
    // Get all active projects with contract values
    const projects = await prisma.project.findMany({
      where: {
        companyId,
        isActive: true,
        status: { in: ['DRAFT', 'RUNNING'] },
      },
      select: {
        id: true,
        name: true,
        contractValue: true,
      },
    });

    if (projects.length === 0) {
      warnings.push('No active projects found for allocation');
      return { results, warnings, totalOverhead };
    }

    // Calculate total contract value
    let totalContractValue = 0;
    const projectValues = new Map<string, number>();

    projects.forEach((project) => {
      const contractValue = project.contractValue ? decimalToNumber(project.contractValue) : 0;
      if (contractValue === 0) {
        warnings.push(`Project ${project.name} has no contract value`);
      }
      projectValues.set(project.id, contractValue);
      totalContractValue += contractValue;
    });

    if (totalContractValue === 0) {
      warnings.push('Total contract value is zero, cannot allocate');
      return { results, warnings, totalOverhead };
    }

    // Allocate proportionally
    projects.forEach((project) => {
      const contractValue = projectValues.get(project.id) || 0;
      const percent = totalContractValue > 0 ? (contractValue / totalContractValue) * 100 : 0;
      const amount = totalContractValue > 0 ? (totalOverhead * contractValue) / totalContractValue : 0;

      results.push({
        projectId: project.id,
        projectName: project.name,
        amount,
        percent,
      });
    });
  }

  return { results, warnings, totalOverhead };
}

/**
 * Save allocation results
 */
export async function saveAllocation(
  companyId: string,
  userId: string,
  month: Date,
  method: 'PERCENT' | 'CONTRACT_VALUE',
  results: Array<{ projectId: string; amount: number; percent?: number }>,
  totalOverhead: number
) {
  // Use first day of month for consistency
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);

  // Delete existing rule and results for this month
  await prisma.$transaction(async (tx) => {
    const existingRule = await tx.overheadAllocationRule.findUnique({
      where: {
        companyId_month: {
          companyId,
          month: monthStart,
        },
      },
    });

    if (existingRule) {
      await tx.overheadAllocationResult.deleteMany({
        where: { ruleId: existingRule.id },
      });
      await tx.overheadAllocationRule.delete({
        where: { id: existingRule.id },
      });
    }

    // Create new rule
    const allocationsJson = method === 'PERCENT' ? results.reduce((acc, r) => {
      if (r.percent !== undefined) {
        acc[r.projectId] = r.percent;
      }
      return acc;
    }, {} as Record<string, number>) : null;

    const rule = await tx.overheadAllocationRule.create({
      data: {
        companyId,
        month: monthStart,
        method,
        allocations: allocationsJson ?? undefined,
        createdById: userId,
      },
    });

    // Create results
    await tx.overheadAllocationResult.createMany({
      data: results.map((r) => ({
        ruleId: rule.id,
        companyId,
        projectId: r.projectId,
        amount: r.amount,
        method,
        sourceOverheadTotal: totalOverhead,
      })),
    });

    return rule;
  });
}

/**
 * Get allocation results for a month
 */
export async function getAllocationResults(companyId: string, month: Date) {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);

  const rule = await prisma.overheadAllocationRule.findUnique({
    where: {
      companyId_month: {
        companyId,
        month: monthStart,
      },
    },
    include: {
      results: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          amount: 'desc',
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return rule;
}

/**
 * Get allocated overhead for a project in a month
 */
export async function getProjectAllocatedOverhead(
  companyId: string,
  projectId: string,
  month: Date
): Promise<number> {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);

  const result = await prisma.overheadAllocationResult.findFirst({
    where: {
      companyId,
      projectId,
      rule: {
        month: monthStart,
      },
    },
    select: {
      amount: true,
    },
  });

  return result ? decimalToNumber(result.amount) : 0;
}
