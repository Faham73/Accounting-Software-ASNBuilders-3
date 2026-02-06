import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import DashboardLayout from '../components/DashboardLayout';
import InvestmentsClient from './InvestmentsClient';

export default async function InvestmentsPage() {
  let auth;
  try {
    auth = await requirePermissionServer('projects', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  return (
    <DashboardLayout title="Total Investment">
      <InvestmentsClient />
    </DashboardLayout>
  );
}
