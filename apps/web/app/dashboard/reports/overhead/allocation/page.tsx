import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import { getMonthlyOverhead, getAllocationResults, computeAllocation } from '@/lib/reports/overhead';
import { prisma } from '@accounting/db';
import DashboardLayout from '@/app/dashboard/components/DashboardLayout';
import OverheadAllocationClient from './OverheadAllocationClient';

export default async function OverheadAllocationPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  // Check if user can manage allocations
  const canManage = can(auth.role, 'vouchers', 'WRITE');

  // Parse month from search params or use current month
  const monthParam = searchParams.month;
  const month = monthParam ? new Date(monthParam + '-01') : new Date();
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);

  const overheadData = await getMonthlyOverhead(auth.companyId, month, false);
  const allocationResults = await getAllocationResults(auth.companyId, month);

  // Get active projects for allocation
  const projects = await prisma.project.findMany({
    where: {
      companyId: auth.companyId,
      isActive: true,
      status: { in: ['DRAFT', 'RUNNING'] },
    },
    select: {
      id: true,
      name: true,
      contractValue: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return (
    <DashboardLayout title="Overhead Allocation">
      <OverheadAllocationClient
        initialOverhead={overheadData.totalOverhead}
        projects={projects}
        allocationResults={allocationResults}
        selectedMonth={monthStart}
        canManage={canManage}
      />
    </DashboardLayout>
  );
}
