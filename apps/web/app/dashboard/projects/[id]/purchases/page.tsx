import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { can } from '@/lib/permissions';
import DashboardLayout from '../../../components/DashboardLayout';
import Link from 'next/link';
import ProjectPurchasesList from './components/ProjectPurchasesList';

export default async function ProjectPurchasesPage({
  params,
}: {
  params: { id: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('purchases', 'READ');
  } catch {
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
      isMain: true,
      parentProjectId: true,
    },
  });

  if (!project) {
    redirect('/dashboard/projects');
  }

  const canWrite = can(auth.role, 'purchases', 'WRITE');

  return (
    <DashboardLayout
      title={`Purchases - ${project.name}`}
      actions={
        <div className="flex gap-2">
          <Link
            href={`/dashboard/projects/${params.id}`}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Project
          </Link>
          {canWrite && (
            <Link
              href={`/dashboard/purchases/new?projectId=${params.id}&returnTo=/dashboard/projects/${params.id}/purchases`}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Add New Purchase
            </Link>
          )}
        </div>
      }
    >
      <ProjectPurchasesList projectId={params.id} project={project} canWrite={canWrite} />
    </DashboardLayout>
  );
}
