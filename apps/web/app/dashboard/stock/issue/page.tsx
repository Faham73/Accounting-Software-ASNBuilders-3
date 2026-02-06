import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import DashboardLayout from '../../components/DashboardLayout';
import IssueStockForm from './components/IssueStockForm';

export default async function IssueStockPage() {
  try {
    await requirePermissionServer('stock', 'WRITE');
  } catch {
    redirect('/forbidden');
  }

  return (
    <DashboardLayout title="Issue Stock (OUT)">
      <IssueStockForm />
    </DashboardLayout>
  );
}
