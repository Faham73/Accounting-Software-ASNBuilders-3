import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { prisma } from '@accounting/db';
import DashboardLayout from '../../../../../components/DashboardLayout';
import Link from 'next/link';
import WorkerLedgerClient from './components/WorkerLedgerClient';

export default async function WorkerLedgerPage({
  params,
}: {
  params: { id: string; workerKey: string };
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
      title="Worker Ledger"
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/projects/${params.id}`}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Project Dashboard
          </Link>
          <Link
            href={`/dashboard/projects/${params.id}/labor/day`}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Day Labor
          </Link>
          <Link
            href={`/dashboard/projects/${params.id}/labor/payables`}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Worker Payables
          </Link>
        </div>
      }
    >
      <WorkerLedgerClient
        projectId={params.id}
        projectName={project.name}
        workerKeyEncoded={params.workerKey}
      />
    </DashboardLayout>
  );
}
