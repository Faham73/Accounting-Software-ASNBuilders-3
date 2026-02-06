import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import DashboardLayout from '../components/DashboardLayout';
import StockOverviewClient from './components/StockOverviewClient';

export default async function StockPage() {
  let auth;
  try {
    auth = await requirePermissionServer('stock', 'READ');
  } catch {
    redirect('/forbidden');
  }

  const canWrite = can(auth.role, 'stock', 'WRITE');

  return (
    <DashboardLayout title="Stock Overview">
      <StockOverviewClient canWrite={canWrite} />
    </DashboardLayout>
  );
}
