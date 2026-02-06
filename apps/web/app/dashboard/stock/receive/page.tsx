import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import DashboardLayout from '../../components/DashboardLayout';
import ReceiveStockForm from './components/ReceiveStockForm';

export default async function ReceiveStockPage() {
  try {
    await requirePermissionServer('stock', 'WRITE');
  } catch {
    redirect('/forbidden');
  }

  return (
    <DashboardLayout title="Receive Stock (IN)">
      <ReceiveStockForm />
    </DashboardLayout>
  );
}
