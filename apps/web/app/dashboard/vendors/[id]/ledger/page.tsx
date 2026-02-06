import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import { getVendorLedger, getVendorGLBalance, getVendorOpenBalance } from '@/lib/payables';
import DashboardLayout from '../../../components/DashboardLayout';
import VendorLedgerClient from './VendorLedgerClient';

export default async function VendorLedgerPage({ params }: { params: { id: string } }) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  const canWrite = can(auth.role, 'vouchers', 'WRITE');

  try {
    const ledgerData = await getVendorLedger(params.id, auth.companyId);
    const glBalance = await getVendorGLBalance(params.id, auth.companyId);
    const openBalance = await getVendorOpenBalance(params.id, auth.companyId);

    return (
      <DashboardLayout title={`Vendor Ledger - ${ledgerData.vendor.name}`}>
        <VendorLedgerClient
          vendor={ledgerData.vendor}
          lines={ledgerData.lines}
          glBalance={glBalance}
          openBalance={openBalance}
          vendorId={params.id}
          canCreatePayment={canWrite}
        />
      </DashboardLayout>
    );
  } catch (error) {
    redirect('/dashboard/vendors');
  }
}
