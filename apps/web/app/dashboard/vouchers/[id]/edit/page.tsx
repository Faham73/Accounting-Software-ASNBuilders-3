import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requirePermissionServer } from '@/lib/rbac';
import { prisma } from '@accounting/db';
import DashboardLayout from '@/app/dashboard/components/DashboardLayout';
import CreateVoucherForm from '@/app/dashboard/vouchers/components/CreateVoucherForm';

export default async function EditVoucherPage({
  params,
}: {
  params: { id: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'WRITE');
  } catch (error) {
    redirect('/forbidden');
  }

  const voucher = await prisma.voucher.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { id: true, name: true } },
      lines: {
        include: {
          account: { select: { id: true, code: true, name: true, type: true } },
          project: { select: { id: true, name: true } },
          vendor: { select: { id: true, name: true } },
          paymentMethod: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  });

  if (!voucher || voucher.companyId !== auth.companyId) {
    redirect('/dashboard/vouchers');
  }

  if (voucher.status === 'POSTED') {
    return (
      <DashboardLayout title={`Edit Voucher ${voucher.voucherNo}`}>
        <div className="rounded-md bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            This voucher cannot be edited because it has been posted.
          </p>
          <Link
            href={`/dashboard/vouchers/${params.id}`}
            className="mt-3 inline-block text-sm font-medium text-amber-800 hover:underline"
          >
            Back to View
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Edit Voucher ${voucher.voucherNo}`}>
      <CreateVoucherForm voucher={voucher as any} voucherId={params.id} />
    </DashboardLayout>
  );
}
