import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import DashboardLayout from '../../components/DashboardLayout';
import StockLedgerClient from './components/StockLedgerClient';

export default async function StockLedgerPage() {
  try {
    await requirePermissionServer('stock', 'READ');
  } catch {
    redirect('/forbidden');
  }

  return (
    <DashboardLayout title="Stock Ledger">
      <StockLedgerClient />
    </DashboardLayout>
  );
}
