import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import DashboardLayout from '../../components/DashboardLayout';
import CreateVoucherForm from '../components/CreateVoucherForm';

export default async function NewVoucherPage() {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'WRITE');
  } catch (error) {
    redirect('/forbidden');
  }

  return (
    <DashboardLayout title="New Voucher">
      <CreateVoucherForm />
    </DashboardLayout>
  );
}
