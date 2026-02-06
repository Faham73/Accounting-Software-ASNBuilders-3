import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import DashboardLayout from '../../components/DashboardLayout';
import PurchaseForm from '../components/PurchaseForm';

export default async function NewPurchasePage() {
  try {
    await requirePermissionServer('purchases', 'WRITE');
  } catch {
    redirect('/forbidden');
  }

  return (
    <DashboardLayout title="New Purchase">
      <PurchaseForm />
    </DashboardLayout>
  );
}
