import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { getBalanceSheet } from '@/lib/reports/statements';
import DashboardLayout from '@/app/dashboard/components/DashboardLayout';
import BalanceSheetClient from './BalanceSheetClient';

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: { asOf?: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  // Parse asOf date or use today
  const asOf = searchParams.asOf ? new Date(searchParams.asOf) : new Date();
  asOf.setHours(23, 59, 59, 999);

  const balanceSheet = await getBalanceSheet(auth.companyId, asOf);

  return (
    <DashboardLayout title="Balance Sheet">
      <BalanceSheetClient
        initialData={balanceSheet}
        asOfDate={asOf.toISOString().split('T')[0]}
      />
    </DashboardLayout>
  );
}
