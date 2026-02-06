import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { getProjectProfitability } from '@/lib/reports/statements';
import { prisma } from '@accounting/db';
import DashboardLayout from '@/app/dashboard/components/DashboardLayout';
import ProjectProfitabilityClient from './ProjectProfitabilityClient';
import { dateRange, monthRange } from '@/lib/reports/helpers';

export default async function ProjectProfitabilityPage({
  searchParams,
}: {
  searchParams: { projectId?: string; from?: string; to?: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  // Get all projects
  const projects = await prisma.project.findMany({
    where: {
      companyId: auth.companyId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });

  // Parse dates or use current month
  const today = new Date();
  const fromDate = searchParams.from
    ? new Date(searchParams.from)
    : new Date(today.getFullYear(), today.getMonth(), 1);
  const toDate = searchParams.to
    ? new Date(searchParams.to)
    : new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const { from, to } = dateRange(fromDate, toDate);

  // Get profitability data
  const projectId = searchParams.projectId || undefined;
  const profitabilityData = await getProjectProfitability(
    auth.companyId,
    from,
    to,
    projectId
  );

  return (
    <DashboardLayout title="Project Profitability">
      <ProjectProfitabilityClient
        initialData={profitabilityData}
        availableProjects={projects}
        selectedProjectId={projectId || null}
        fromDate={fromDate.toISOString().split('T')[0]}
        toDate={toDate.toISOString().split('T')[0]}
      />
    </DashboardLayout>
  );
}
