import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { prisma } from '@accounting/db';
import DashboardLayout from '@/app/dashboard/components/DashboardLayout';
import ProjectForm from '@/app/dashboard/projects/components/ProjectForm';
import ProjectStatementActions from '@/app/dashboard/projects/[id]/components/ProjectStatementActions';
import Link from 'next/link';

export default async function EditProjectPage({
  params,
}: {
  params: { id: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('projects', 'WRITE');
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
      clientContact: true,
      siteLocation: true,
      startDate: true,
      expectedEndDate: true,
      contractValue: true,
      status: true,
      assignedManager: true,
      isActive: true,
      address: true,
      projectManager: true,
      projectEngineer: true,
      companySiteName: true,
      reference: true,
      isMain: true,
      parentProjectId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!project) {
    redirect('/dashboard/projects');
  }

  return (
    <DashboardLayout
      title={`Edit Project: ${project.name}`}
      actions={
        <div className="flex gap-2 flex-wrap items-center">
          <Link
            href={`/dashboard/projects/${params.id}`}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            View Project
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
      <ProjectForm project={project as any} />
    </DashboardLayout>
  );
}
