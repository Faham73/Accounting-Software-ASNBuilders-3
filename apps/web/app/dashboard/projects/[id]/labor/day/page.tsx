import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { prisma } from '@accounting/db';
import DashboardLayout from '../../../../components/DashboardLayout';
import Link from 'next/link';
import ProjectLaborClient from '../components/ProjectLaborClient';

export default async function DayLaborPage({
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
      title={`Day Labor - ${project.name}`}
      actions={
        <div className="flex gap-2">
          <Link
            href={`/dashboard/projects/${params.id}`}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Project
          </Link>
          <Link
            href={`/dashboard/projects/${params.id}/labor/monthly`}
            className="py-2 px-4 border border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100"
          >
            Monthly Employee
          </Link>
          <Link
            href={`/dashboard/projects/${params.id}/labor/contract`}
            className="py-2 px-4 border border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100"
          >
            Contract Workers
          </Link>
        </div>
      }
    >
      <ProjectLaborClient
        projectId={params.id}
        projectName={project.name}
        laborType="DAY"
      />
    </DashboardLayout>
  );
}
