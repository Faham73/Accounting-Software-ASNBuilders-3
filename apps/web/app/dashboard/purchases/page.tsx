import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import DashboardLayout from '../components/DashboardLayout';
import Link from 'next/link';
import PurchasesList from './components/PurchasesList';

export default async function PurchasesPage() {
  let auth;
  try {
    auth = await requirePermissionServer('purchases', 'READ');
  } catch {
    redirect('/forbidden');
  }

  const canWrite = can(auth.role, 'purchases', 'WRITE');

  return (
    <DashboardLayout
      title="Purchases"
      actions={
        canWrite ? (
          <Link
            href="/dashboard/purchases/new"
            className="w-full sm:w-auto min-h-[40px] py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center justify-center"
          >
            New Purchase
          </Link>
        ) : null
      }
    >
      <PurchasesList canWrite={canWrite} />
    </DashboardLayout>
  );
}
