import { redirect } from 'next/navigation';
import { requireAuthServer } from '@/lib/rbac';
import { ensureSystemAccounts } from '@/lib/systemAccounts.server';
import DashboardLayout from './components/DashboardLayout';
import CompanyDashboardClient from './components/CompanyDashboardClient';

export default async function DashboardPage() {
  let auth;
  try {
    auth = await requireAuthServer();
  } catch (error) {
    redirect('/login');
  }

  // Ensure system accounts exist for this company (idempotent)
  await ensureSystemAccounts(auth.companyId);

  return (
    <DashboardLayout title="Company Dashboard">
      <CompanyDashboardClient />
    </DashboardLayout>
  );
}
