import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { prisma } from '@accounting/db';
import DashboardLayout from '../../components/DashboardLayout';
import ProjectHeaderCard from './components/ProjectHeaderCard';
import ProjectQuickActions from './components/ProjectQuickActions';
import ProjectFinancialSnapshot from './components/ProjectFinancialSnapshot';
import ProjectDashboardClient from './components/ProjectDashboardClient';
import ProjectLaborWorkforceSection from './components/ProjectLaborWorkforceSection';
import ProjectPurchasesPayables from './components/ProjectPurchasesPayables';
import ProjectStockStatus from './components/ProjectStockStatus';
import ProjectProgressVsCost from './components/ProjectProgressVsCost';
import ProjectRecentActivity from './components/ProjectRecentActivity';
import ProjectDocuments from './components/ProjectDocuments';
import ProjectStatementActions from './components/ProjectStatementActions';
import Link from 'next/link';

export default async function ProjectViewPage({
  params,
}: {
  params: { id: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('projects', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  // Fetch project and verify it belongs to user's company
  const project = await prisma.project.findFirst({
    where: {
      id: params.id,
      companyId: auth.companyId,
    },
    select: {
      id: true,
      name: true,
      clientName: true,
      status: true,
      siteLocation: true,
      startDate: true,
      expectedEndDate: true,
      projectManager: true,
      totalFloors: true,
      totalUnits: true,
    },
  });

  if (!project) {
    redirect('/dashboard/projects');
  }

  return (
    <DashboardLayout
      title={`Project: ${project.name}`}
      actions={
        <div className="flex gap-2 flex-wrap items-center">
          <Link
            href={`/dashboard/projects/${params.id}/edit`}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Edit Project
          </Link>
          <Link
            href={`/dashboard/projects/${params.id}/ledger`}
            className="py-2 px-4 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
          >
            View Ledger
          </Link>
          <Link
            href={`/dashboard/projects/${params.id}/cost-summary`}
            className="py-2 px-4 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100"
          >
            Cost Summary
          </Link>
          <ProjectStatementActions projectId={params.id} projectName={project.name} />
        </div>
      }
    >
      <ProjectHeaderCard
        name={project.name}
        location={project.siteLocation}
        startDate={project.startDate}
        expectedEndDate={project.expectedEndDate}
        status={project.status}
        managerName={project.projectManager}
        clientName={project.clientName}
        totalFloors={project.totalFloors}
        totalUnits={project.totalUnits}
      />
      <ProjectQuickActions projectId={params.id} />
      <ProjectFinancialSnapshot projectId={params.id} />
      <ProjectDashboardClient projectId={params.id} projectName={project.name} />
      <ProjectLaborWorkforceSection projectId={params.id} />
      <ProjectPurchasesPayables projectId={params.id} />
      <ProjectStockStatus projectId={params.id} />
      <ProjectProgressVsCost projectId={params.id} />
      <ProjectRecentActivity projectId={params.id} />
      <ProjectDocuments projectId={params.id} />
    </DashboardLayout>
  );
}
