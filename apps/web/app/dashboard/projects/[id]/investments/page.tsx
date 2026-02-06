import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { prisma } from '@accounting/db';
import DashboardLayout from '../../../components/DashboardLayout';
import ProjectInvestmentsClient from './ProjectInvestmentsClient';

export default async function ProjectInvestmentsPage({
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

  // Verify project exists and belongs to company
  const project = await prisma.project.findFirst({
    where: {
      id: params.id,
      companyId: auth.companyId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!project) {
    redirect('/dashboard/projects');
  }

  return (
    <DashboardLayout title={`Investments - ${project.name}`}>
      <ProjectInvestmentsClient projectId={params.id} projectName={project.name} />
    </DashboardLayout>
  );
}
