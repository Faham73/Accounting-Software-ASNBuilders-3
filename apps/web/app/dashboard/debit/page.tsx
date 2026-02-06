import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import DashboardLayout from '../components/DashboardLayout';
import DebitClient from './DebitClient';
import Link from 'next/link';

export default async function DebitPage({
  searchParams = {},
}: {
  searchParams?: { projectId?: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  const canWrite = can(auth.role, 'vouchers', 'WRITE');
  const projectId = searchParams?.projectId;

  // When filtered by project, DebitClient shows its own Add Expense button; avoid duplicate
  const showHeaderAddButton = canWrite && !projectId;

  return (
    <DashboardLayout
      title="Total Expense"
      actions={
        showHeaderAddButton ? (
          <Link
            href="/dashboard/vouchers/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            + Add Expense
          </Link>
        ) : null
      }
    >
      <DebitClient />
    </DashboardLayout>
  );
}
