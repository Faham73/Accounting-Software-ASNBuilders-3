import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { prisma } from '@accounting/db';

/**
 * Edit Debit Voucher: redirect to existing voucher edit page when status is DRAFT.
 * When not DRAFT, redirect back to debit details.
 */
export default async function DebitEditPage({
  params,
}: {
  params: { voucherId: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'WRITE');
  } catch {
    redirect('/forbidden');
  }

  const voucher = await prisma.voucher.findFirst({
    where: {
      id: params.voucherId,
      companyId: auth.companyId,
    },
    select: { id: true, status: true },
  });

  if (!voucher) {
    redirect('/dashboard/debit');
  }

  if (voucher.status !== 'DRAFT') {
    redirect(`/dashboard/debit/${params.voucherId}`);
  }

  redirect(`/dashboard/vouchers/${params.voucherId}/edit`);
}
