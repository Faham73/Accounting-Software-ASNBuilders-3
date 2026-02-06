import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import { prisma } from '@accounting/db';
import DashboardLayout from '../../components/DashboardLayout';
import VoucherDetail from './components/VoucherDetail';

export default async function VoucherDetailPage({ params }: { params: { id: string } }) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  const voucher = await prisma.voucher.findUnique({
    where: { id: params.id },
    include: {
      project: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      submittedBy: {
        select: { id: true, name: true, email: true },
      },
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
      postedBy: {
        select: { id: true, name: true, email: true },
      },
      reversedBy: {
        select: { id: true, name: true, email: true },
      },
      originalVoucher: {
        select: { id: true, voucherNo: true, date: true },
      },
      reversalVouchers: {
        select: { id: true, voucherNo: true, date: true },
      },
      lines: {
        include: {
          account: {
            select: { id: true, code: true, name: true, type: true },
          },
          project: {
            select: { id: true, name: true },
          },
          vendor: {
            select: { id: true, name: true },
          },
          paymentMethod: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      allocations: {
        include: {
          sourceLine: {
            include: {
              voucher: {
                select: { id: true, voucherNo: true, date: true },
              },
              account: {
                select: { id: true, code: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!voucher || voucher.companyId !== auth.companyId) {
    redirect('/dashboard/vouchers');
  }

  const canWrite = can(auth.role, 'vouchers', 'WRITE');
  const canPost = can(auth.role, 'vouchers', 'POST');
  const canApprove = can(auth.role, 'vouchers', 'APPROVE');
  const canEdit = voucher.status === 'DRAFT' && canWrite;
  const canSubmit = voucher.status === 'DRAFT';
  const canApproveVoucher = voucher.status === 'SUBMITTED' && canApprove;
  const canPostVoucher = voucher.status === 'APPROVED' && canPost;
  const canReverse = voucher.status === 'POSTED' && canPost;

  return (
    <DashboardLayout title={`Voucher ${voucher.voucherNo}`}>
      <VoucherDetail
        voucher={voucher as any}
        canEdit={canEdit}
        canSubmit={canSubmit}
        canApprove={canApproveVoucher}
        canPost={canPostVoucher}
        canReverse={canReverse}
        currentUserId={auth.userId}
      />
    </DashboardLayout>
  );
}
