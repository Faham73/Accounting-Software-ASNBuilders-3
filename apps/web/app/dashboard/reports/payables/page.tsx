import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { getPayablesSummary } from '@/lib/payables';
import DashboardLayout from '../../components/DashboardLayout';
import PayablesSummaryClient from './PayablesSummaryClient';

export default async function PayablesSummaryPage({
  searchParams,
}: {
  searchParams: { showZero?: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  const showZeroBalances = searchParams.showZero === 'true';
  const summary = await getPayablesSummary(auth.companyId, showZeroBalances);

  return (
    <DashboardLayout title="Payables Summary">
      <PayablesSummaryClient initialData={summary} showZeroBalances={showZeroBalances} />
    </DashboardLayout>
  );
}
