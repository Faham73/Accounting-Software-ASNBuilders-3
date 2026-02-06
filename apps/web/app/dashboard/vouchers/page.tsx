import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import DashboardLayout from '../components/DashboardLayout';
import VouchersList from './components/VouchersList';
import Link from 'next/link';

export default async function VouchersPage() {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  const canWrite = can(auth.role, 'vouchers', 'WRITE');
  const canPost = can(auth.role, 'vouchers', 'POST');
  const canApprove = can(auth.role, 'vouchers', 'APPROVE');

  return (
    <DashboardLayout
      title="Vouchers"
      actions={
        canWrite ? (
          <Link
            href="/dashboard/vouchers/new"
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            New Voucher
          </Link>
        ) : null
      }
    >
      <VouchersList canWrite={canWrite} canPost={canPost} canApprove={canApprove} />
    </DashboardLayout>
  );
}
