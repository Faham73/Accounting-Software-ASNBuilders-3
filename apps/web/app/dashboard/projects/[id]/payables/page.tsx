import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { prisma } from '@accounting/db';
import DashboardLayout from '../../../components/DashboardLayout';
import Link from 'next/link';
import ProjectPayablesClient from './components/ProjectPayablesClient';

export default async function ProjectPayablesPage({
  params,
}: {
  params: { id: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('projects', 'READ');
  } catch {
    redirect('/forbidden');
  }

  const project = await prisma.project.findFirst({
    where: {
      id: params.id,
      companyId: auth.companyId,
    },
    select: { id: true, name: true },
  });

  if (!project) {
    redirect('/dashboard/projects');
  }

  return (
    <DashboardLayout
      title={`Supplier Payables - ${project.name}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/projects/${params.id}`}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Project Dashboard
          </Link>
          <Link
            href={`/dashboard/projects/${params.id}/purchases`}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Purchases
          </Link>
        </div>
      }
    >
      <ProjectPayablesClient projectId={params.id} projectName={project.name} />
    </DashboardLayout>
  );
}
