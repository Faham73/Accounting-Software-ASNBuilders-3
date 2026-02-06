import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import DashboardLayout from '@/app/dashboard/components/DashboardLayout';
import ImportTransactionsClient from './ImportTransactionsClient';

export default async function ImportTransactionsPage() {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'WRITE');
  } catch (error) {
    redirect('/forbidden');
  }

  return (
    <DashboardLayout title="Import Transactions">
      <ImportTransactionsClient />
    </DashboardLayout>
  );
}
