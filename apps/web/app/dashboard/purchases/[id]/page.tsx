import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import { prisma } from '@accounting/db';
import DashboardLayout from '../../components/DashboardLayout';
import PurchaseWorkflowActions from './components/PurchaseWorkflowActions';

export default async function PurchaseDetailPage({ params }: { params: { id: string } }) {
  let auth;
  try {
    auth = await requirePermissionServer('purchases', 'READ');
  } catch {
    redirect('/forbidden');
  }

  const purchase = await prisma.purchase.findUnique({
    where: {
      id: params.id,
      companyId: auth.companyId,
    },
    include: {
      project: {
        select: { id: true, name: true },
      },
      subProject: {
        select: { id: true, name: true },
      },
      supplierVendor: {
        select: { id: true, name: true, phone: true, address: true },
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
      voucher: {
        select: {
          id: true,
          voucherNo: true,
          status: true,
        },
      },
    },
  });

  if (!purchase) {
    redirect('/dashboard/purchases');
  }

  const canWrite = can(auth.role, 'purchases', 'WRITE');
  const canApprove = can(auth.role, 'vouchers', 'APPROVE');
  const canPost = can(auth.role, 'vouchers', 'POST');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <DashboardLayout
      title="Purchase Details"
      actions={
        <div className="flex flex-wrap gap-2">
          <PurchaseWorkflowActions
            purchaseId={purchase.id}
            status={purchase.status}
            voucherId={purchase.voucherId}
            voucherNo={purchase.voucher?.voucherNo || null}
            paidAmount={Number(purchase.paidAmount)}
            paymentAccountId={purchase.paymentAccountId}
            canApprove={canApprove}
            canPost={canPost}
            canWrite={canWrite}
          />
          {canWrite && purchase.status === 'DRAFT' && !purchase.voucherId && (
            <Link
              href={`/dashboard/purchases/${purchase.id}/edit`}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Edit
            </Link>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status and Voucher Info */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Status</h2>
            <span
              className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                purchase.status === 'POSTED'
                  ? 'bg-green-100 text-green-800'
                  : purchase.status === 'APPROVED'
                  ? 'bg-blue-100 text-blue-800'
                  : purchase.status === 'SUBMITTED'
                  ? 'bg-yellow-100 text-yellow-800'
                  : purchase.status === 'REVERSED'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {purchase.status}
            </span>
          </div>
          {purchase.voucher && (
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                Voucher: <Link href={`/dashboard/vouchers/${purchase.voucher.id}`} className="text-blue-600 hover:underline">{purchase.voucher.voucherNo}</Link> ({purchase.voucher.status})
              </p>
            </div>
          )}
        </div>

        {/* Header Info */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Purchase Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Date</label>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(purchase.date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Challan Number</label>
              <p className="mt-1 text-sm text-gray-900">{purchase.challanNo || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Main Project</label>
              <p className="mt-1 text-sm text-gray-900">{purchase.project.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Sub Project</label>
              <p className="mt-1 text-sm text-gray-900">{purchase.subProject?.name || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Vendor</label>
              <p className="mt-1 text-sm text-gray-900">{purchase.supplierVendor.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Reference</label>
              <p className="mt-1 text-sm text-gray-900">{purchase.reference || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Payment Account</label>
              <p className="mt-1 text-sm text-gray-900">
                {purchase.paymentAccount
                  ? `${purchase.paymentAccount.code} - ${purchase.paymentAccount.name} (${purchase.paymentAccount.type})`
                  : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Lines Table */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Line Items</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item/Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {purchase.lines.map((line) => {
                  // Determine item name based on line type
                  const itemName =
                    line.lineType === 'MATERIAL'
                      ? line.stockItem?.name ?? 'Unknown material'
                      : line.description ?? (line.lineType === 'SERVICE' ? 'Service' : 'Other expense');

                  // Determine unit based on line type
                  const unit =
                    line.lineType === 'MATERIAL'
                      ? line.stockItem?.unit ?? line.unit ?? ''
                      : line.unit ?? '';

                  // Check if MATERIAL line is missing stockItem
                  const isBrokenMaterial = line.lineType === 'MATERIAL' && !line.stockItem;

                  // Safe number conversions
                  const qty = Number(line.quantity ?? 0);
                  const unitRate = Number(line.unitRate ?? 0);
                  const amount = Number(line.lineTotal ?? 0);

                  return (
                    <tr key={line.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            line.lineType === 'MATERIAL'
                              ? 'bg-blue-100 text-blue-800'
                              : line.lineType === 'SERVICE'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {line.lineType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <span>
                            {itemName}
                            {unit ? ` (${unit})` : ''}
                          </span>
                          {isBrokenMaterial && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              Missing item
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(line.lineType === 'MATERIAL' || line.lineType === 'SERVICE') && qty > 0
                          ? qty.toFixed(3)
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(line.lineType === 'MATERIAL' || line.lineType === 'SERVICE') && unit
                          ? unit
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(line.lineType === 'MATERIAL' || line.lineType === 'SERVICE') && unitRate > 0
                          ? formatCurrency(unitRate)
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Subtotal</label>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {formatCurrency(Number(purchase.subtotal))}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Discount</label>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {purchase.discountPercent
                  ? `${Number(purchase.discountPercent).toFixed(2)}%`
                  : '-'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Total Price</label>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {formatCurrency(Number(purchase.total))}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Paid</label>
              <p className="mt-1 text-lg font-semibold text-green-600">
                {formatCurrency(Number(purchase.paidAmount))}
              </p>
            </div>
            {Number(purchase.paidAmount) > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-500">Payment Method</label>
                <p className="mt-1 text-sm text-gray-900">
                  {purchase.paymentMethod === 'BANK'
                    ? 'Bank'
                    : purchase.paymentMethod === 'CASH'
                    ? 'Cash'
                    : purchase.paymentAccount?.code === '1020'
                    ? 'Bank'
                    : purchase.paymentAccount?.code === '1010'
                    ? 'Cash'
                    : purchase.paymentAccount?.name ?? '—'}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">Due</label>
              <p className="mt-1 text-lg font-semibold text-red-600">
                {formatCurrency(Number(purchase.dueAmount))}
              </p>
            </div>
          </div>
        </div>

        {/* Attachments */}
        {purchase.attachments.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Attachments</h2>
            <ul className="space-y-2">
              {purchase.attachments.map((att) => (
                <li key={att.id} className="flex items-center justify-between">
                  <a
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-900"
                  >
                    {att.fileName}
                  </a>
                  <span className="text-sm text-gray-500">
                    {(att.sizeBytes / 1024).toFixed(2)} KB
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
