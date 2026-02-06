import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { prisma } from '@accounting/db';
import DashboardLayout from '../../../components/DashboardLayout';
import ProjectStockClient from './components/ProjectStockClient';
import Link from 'next/link';

export default async function ProjectStockPage({
  params,
}: {
  params: { id: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('stock', 'READ');
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
    <DashboardLayout
      title="Stock"
      actions={
        <div className="flex gap-2 flex-wrap items-center">
          <Link
            href={`/dashboard/projects/${params.id}`}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Project
          </Link>
        </div>
      }
    >
      <div className="mb-4">
        <p className="text-sm text-gray-500">Project stock movements</p>
      </div>
      <ProjectStockClient projectId={params.id} projectName={project.name} />
    </DashboardLayout>
  );
}
