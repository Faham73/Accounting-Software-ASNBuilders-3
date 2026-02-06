import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { prisma } from '@accounting/db';
import DashboardLayout from '../../../components/DashboardLayout';
import PurchaseForm from '../../components/PurchaseForm';

export default async function EditPurchasePage({ params }: { params: { id: string } }) {
  let auth;
  try {
    auth = await requirePermissionServer('purchases', 'WRITE');
  } catch {
    redirect('/forbidden');
  }

  const purchase = await prisma.purchase.findUnique({
    where: {
      id: params.id,
      companyId: auth.companyId,
    },
    include: {
      voucher: {
        select: {
          id: true,
          status: true,
        },
      },
      project: {
        select: { id: true, name: true },
      },
      subProject: {
        select: { id: true, name: true },
      },
      supplierVendor: {
        select: { id: true, name: true },
      },
      paymentAccount: {
        select: { id: true, code: true, name: true, type: true },
      },
      lines: {
        include: {
          stockItem: {
            select: { id: true, name: true, unit: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      attachments: {
        orderBy: { uploadedAt: 'desc' },
      },
    },
  });

  if (!purchase) {
    redirect('/dashboard/purchases');
  }

  // Prevent editing if voucher exists and is not DRAFT
  if (purchase.voucherId && purchase.voucher && purchase.voucher.status !== 'DRAFT') {
    redirect(`/dashboard/purchases/${purchase.id}?error=Purchase cannot be edited when voucher is ${purchase.voucher.status}`);
  }

  // Prevent editing if purchase status is not DRAFT
  if (purchase.status !== 'DRAFT') {
    redirect(`/dashboard/purchases/${purchase.id}?error=Purchase cannot be edited when status is ${purchase.status}`);
  }

  // Convert Prisma Decimal to number for form
  const purchaseData = {
    ...purchase,
    date: purchase.date.toISOString(),
    total: Number(purchase.total),
    paidAmount: Number(purchase.paidAmount),
    dueAmount: Number(purchase.dueAmount),
    discountPercent: purchase.discountPercent ? Number(purchase.discountPercent) : null,
    lines: purchase.lines.map((line) => ({
      ...line,
      lineType: (line.lineType || 'OTHER') as 'MATERIAL' | 'SERVICE' | 'OTHER',
      stockItemId: line.stockItemId || null,
      quantity: line.quantity ? Number(line.quantity) : null,
      unit: line.unit || null,
      unitRate: line.unitRate ? Number(line.unitRate) : null,
      description: line.description || null,
      // Legacy fields for backward compatibility
      unitPrice: line.unitRate ? Number(line.unitRate) : (line.quantity && line.quantity.gt(0) ? Number(line.lineTotal.div(line.quantity)) : 0),
      lineTotal: Number(line.lineTotal),
    })),
  };

  return (
    <DashboardLayout title="Edit Purchase">
      <PurchaseForm purchase={purchaseData as any} />
    </DashboardLayout>
  );
}
