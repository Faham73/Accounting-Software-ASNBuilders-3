import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import DashboardLayout from '../../../components/DashboardLayout';
import CreatePaymentVoucherForm from './CreatePaymentVoucherForm';

export default async function NewPaymentVoucherPage({
  searchParams,
}: {
  searchParams: { vendorId?: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'WRITE');
  } catch (error) {
    redirect('/forbidden');
  }

  return (
    <DashboardLayout title="New Payment Voucher">
      <CreatePaymentVoucherForm initialVendorId={searchParams.vendorId} />
    </DashboardLayout>
  );
}
