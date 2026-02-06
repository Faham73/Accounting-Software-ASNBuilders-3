import { prisma } from '@accounting/db';

/**
 * Get company-wide total credit
 * Includes:
 * - All project credits (projectId != null)
 * - All company-level credits (projectId is null)
 */
export async function getCompanyTotalCredit(companyId: string): Promise<number> {
  const result = await prisma.credit.aggregate({
    where: {
      companyId,
    },
    _sum: {
      amount: true,
    },
  });

  return result._sum.amount?.toNumber() || 0;
}

/**
 * Get project-specific total credit
 * Returns sum of credits where:
 * - projectId = given projectId
 */
export async function getProjectTotalCredit(
  projectId: string,
  companyId: string
): Promise<number> {
  // Verify project belongs to company
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId,
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    throw new Error('Project not found or does not belong to company');
  }

  const result = await prisma.credit.aggregate({
    where: {
      companyId,
      projectId,
    },
    _sum: {
      amount: true,
    },
  });

  return result._sum.amount?.toNumber() || 0;
}
