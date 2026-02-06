import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { getMonthlyOverhead, getAllocationResults } from '@/lib/reports/overhead';
import DashboardLayout from '@/app/dashboard/components/DashboardLayout';
import OverheadReportClient from './OverheadReportClient';

export default async function OverheadReportPage({
  searchParams,
}: {
  searchParams: { month?: string; includeDraft?: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  // Parse month from search params or use current month
  const monthParam = searchParams.month;
  const month = monthParam ? new Date(monthParam) : new Date();
  const includeDraft = searchParams.includeDraft === 'true';

  const overheadData = await getMonthlyOverhead(auth.companyId, month, includeDraft);
  const allocationResults = await getAllocationResults(auth.companyId, month);

  return (
    <DashboardLayout title="Monthly Overhead Report">
      <OverheadReportClient
        initialData={overheadData}
        allocationResults={allocationResults}
        selectedMonth={month}
        includeDraft={includeDraft}
      />
    </DashboardLayout>
  );
}
