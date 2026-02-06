import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import DashboardLayout from '../components/DashboardLayout';
import CreditClient from './CreditClient';

export default async function CreditPage() {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  return (
    <DashboardLayout title="Total Credit">
      <CreditClient />
    </DashboardLayout>
  );
}
