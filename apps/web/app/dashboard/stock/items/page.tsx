import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import DashboardLayout from '../../components/DashboardLayout';
import Link from 'next/link';
import StockItemsList from './components/StockItemsList';

export default async function StockItemsPage() {
  let auth;
  try {
    auth = await requirePermissionServer('stock', 'READ');
  } catch {
    redirect('/forbidden');
  }

  const canWrite = can(auth.role, 'stock', 'WRITE');

  return (
    <DashboardLayout
      title="Stock Items"
      actions={
        canWrite ? (
          <Link
            href="/dashboard/stock/items/new"
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            New Stock Item
          </Link>
        ) : null
      }
    >
      <StockItemsList canWrite={canWrite} />
    </DashboardLayout>
  );
}
