import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { getProfitAndLoss } from '@/lib/reports/statements';
import DashboardLayout from '@/app/dashboard/components/DashboardLayout';
import ProfitLossClient from './ProfitLossClient';
import { dateRange } from '@/lib/reports/helpers';

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  // Parse dates or use current month
  const today = new Date();
  const fromDate = searchParams.from
    ? new Date(searchParams.from)
    : new Date(today.getFullYear(), today.getMonth(), 1);
  const toDate = searchParams.to
    ? new Date(searchParams.to)
    : new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const { from, to } = dateRange(fromDate, toDate);

  const pnlData = await getProfitAndLoss(auth.companyId, from, to);

  return (
    <DashboardLayout title="Profit & Loss Statement">
      <ProfitLossClient
        initialData={pnlData}
        fromDate={fromDate.toISOString().split('T')[0]}
        toDate={toDate.toISOString().split('T')[0]}
      />
    </DashboardLayout>
  );
}
