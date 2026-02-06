import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { prisma } from '@accounting/db';
import DashboardLayout from '../../../components/DashboardLayout';
import ProjectCostSummaryClient from './ProjectCostSummaryClient';

export default async function ProjectCostSummaryPage({
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
    },
  });

  if (!project) {
    redirect('/dashboard/projects');
  }

  return (
    <DashboardLayout title={`Project Cost Summary: ${project.name}`}>
      <ProjectCostSummaryClient projectId={params.id} projectName={project.name} />
    </DashboardLayout>
  );
}
