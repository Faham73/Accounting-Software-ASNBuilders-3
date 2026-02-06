import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { getTrialBalance } from '@/lib/reports/statements';
import DashboardLayout from '@/app/dashboard/components/DashboardLayout';
import TrialBalanceClient from './TrialBalanceClient';

export default async function TrialBalancePage({
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

  const trialBalance = await getTrialBalance(auth.companyId, asOf);

  return (
    <DashboardLayout title="Trial Balance">
      <TrialBalanceClient
        initialData={trialBalance}
        asOfDate={asOf.toISOString().split('T')[0]}
      />
    </DashboardLayout>
  );
}
