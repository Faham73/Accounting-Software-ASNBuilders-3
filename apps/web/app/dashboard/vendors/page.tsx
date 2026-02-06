import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import { prisma } from '@accounting/db';
import DashboardLayout from '../components/DashboardLayout';
import VendorsList from './components/VendorsList';

export default async function VendorsPage() {
  let auth;
  try {
    auth = await requirePermissionServer('vendors', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  const canWrite = can(auth.role, 'vendors', 'WRITE');

  const vendors = await prisma.vendor.findMany({
    where: {
      companyId: auth.companyId,
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      notes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <DashboardLayout title="Vendors">
      <VendorsList initialVendors={vendors as any} canWrite={canWrite} />
    </DashboardLayout>
  );
}
