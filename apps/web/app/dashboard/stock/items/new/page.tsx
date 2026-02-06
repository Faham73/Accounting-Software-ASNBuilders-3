import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import DashboardLayout from '../../../components/DashboardLayout';
import StockItemForm from '../components/StockItemForm';

export default async function NewStockItemPage() {
  try {
    await requirePermissionServer('stock', 'WRITE');
  } catch {
    redirect('/forbidden');
  }

  return (
    <DashboardLayout title="New Stock Item">
      <StockItemForm />
    </DashboardLayout>
  );
}
