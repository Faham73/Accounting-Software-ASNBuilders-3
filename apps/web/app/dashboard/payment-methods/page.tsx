import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import { prisma } from '@accounting/db';
import DashboardLayout from '../components/DashboardLayout';
import PaymentMethodsList from './components/PaymentMethodsList';

export default async function PaymentMethodsPage() {
  let auth;
  try {
    auth = await requirePermissionServer('paymentMethods', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  const canWrite = can(auth.role, 'paymentMethods', 'WRITE');

  const paymentMethods = await prisma.paymentMethod.findMany({
    where: {
      companyId: auth.companyId,
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      type: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return (
    <DashboardLayout title="Payment Methods">
      <PaymentMethodsList
        initialPaymentMethods={paymentMethods as any}
        canWrite={canWrite}
      />
    </DashboardLayout>
  );
}
