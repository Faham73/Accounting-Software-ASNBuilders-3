import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import { prisma } from '@accounting/db';
import DashboardLayout from '../../components/DashboardLayout';
import DebitWorkflowActions from './components/DebitWorkflowActions';

export default async function DebitDetailPage({
  params,
}: {
  params: { voucherId: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'READ');
  } catch {
    redirect('/forbidden');
  }

  const voucher = await prisma.voucher.findFirst({
    where: {
      id: params.voucherId,
      companyId: auth.companyId,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          parentProjectId: true,
          parentProject: {
            select: { id: true, name: true },
          },
        },
      },
      postedBy: {
        select: { id: true, name: true },
      },
      lines: {
        include: {
          account: {
            select: { id: true, code: true, name: true, type: true },
          },
          project: {
            select: {
              id: true,
              name: true,
              parentProjectId: true,
              parentProject: {
                select: { id: true, name: true },
              },
            },
          },
          paymentMethod: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!voucher) {
    redirect('/dashboard/debit');
  }

  const hasDebitLine = voucher.lines.some((l) => Number(l.debit) > 0);
  if (!hasDebitLine) {
    redirect('/dashboard/debit');
  }

  const canWrite = can(auth.role, 'vouchers', 'WRITE');
  const canApprove = can(auth.role, 'vouchers', 'APPROVE');
  const canPost = can(auth.role, 'vouchers', 'POST');
  const canEdit = voucher.status === 'DRAFT' && canWrite;
  const canSubmit = voucher.status === 'DRAFT';
  const canApproveVoucher = voucher.status === 'SUBMITTED' && canApprove;
  const canPostVoucher = voucher.status === 'APPROVED' && canPost;

  // Primary project: voucher.projectId if set, else first debit line's project
  const firstDebitLine = voucher.lines.find((l) => Number(l.debit) > 0);
  const primaryProject = voucher.project ?? firstDebitLine?.project ?? null;
  const mainProject = primaryProject?.parentProject ?? (primaryProject?.parentProjectId ? null : primaryProject);
  const subProject = primaryProject?.parentProjectId ? primaryProject : null;

  // Paid By / Received By / Payment Method from first debit line (or first line)
  const infoLine = firstDebitLine ?? voucher.lines[0];
  const paidBy = infoLine?.paidBy ?? null;
  const receivedBy = infoLine?.receivedBy ?? null;
  const paymentMethodName = infoLine?.paymentMethod?.name ?? null;
  const workDetails = infoLine?.workDetails ?? null;
  const lineDescription = infoLine?.description ?? null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2,
    }).format(amount);

  const totalDebit = voucher.lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = voucher.lines.reduce((s, l) => s + Number(l.credit), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // Order lines: debit lines first, then credit lines (then by createdAt)
  const sortedLines = [...voucher.lines].sort((a, b) => {
    const aDebit = Number(a.debit) > 0 ? 1 : 0;
    const bDebit = Number(b.debit) > 0 ? 1 : 0;
    if (bDebit !== aDebit) return bDebit - aDebit;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return (
    <DashboardLayout
      title="Expense Details"
      actions={
        <div className="flex flex-wrap gap-2 items-center">
          <DebitWorkflowActions
            voucherId={voucher.id}
            status={voucher.status}
            canSubmit={canSubmit}
            canApprove={canApproveVoucher}
            canPost={canPostVoucher}
          />
          {canEdit && (
            <Link
              href={`/dashboard/debit/${voucher.id}/edit`}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Edit
            </Link>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status and badge */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Status</h2>
            <span
              className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                voucher.status === 'POSTED'
                  ? 'bg-green-100 text-green-800'
                  : voucher.status === 'APPROVED'
                    ? 'bg-blue-100 text-blue-800'
                    : voucher.status === 'SUBMITTED'
                      ? 'bg-yellow-100 text-yellow-800'
                      : voucher.status === 'REVERSED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
              }`}
            >
              {voucher.status}
            </span>
          </div>
        </div>

        {/* Debit Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Expense Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Date</label>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(voucher.date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Voucher No</label>
              <p className="mt-1 text-sm text-gray-900">{voucher.voucherNo || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Main Project</label>
              <p className="mt-1 text-sm text-gray-900">
                {mainProject?.name ?? (primaryProject && !primaryProject.parentProjectId ? primaryProject.name : '—')}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Sub Project</label>
              <p className="mt-1 text-sm text-gray-900">
                {subProject?.name ?? '—'}
              </p>
            </div>
            {!primaryProject && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-500">Project</label>
                <p className="mt-1 text-sm text-gray-900">Company</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500">Paid By</label>
              <p className="mt-1 text-sm text-gray-900">{paidBy || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Received By</label>
              <p className="mt-1 text-sm text-gray-900">{receivedBy || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Payment Method</label>
              <p className="mt-1 text-sm text-gray-900">{paymentMethodName || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Purpose / Details</label>
              <p className="mt-1 text-sm text-gray-900">{workDetails || '—'}</p>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-500">Note</label>
              <p className="mt-1 text-sm text-gray-900">
                {[voucher.narration, lineDescription].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Journal Lines */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Accounts & Amount</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Project
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedLines.map((line) => {
                  const isDebit = Number(line.debit) > 0;
                  const amount = isDebit ? Number(line.debit) : Number(line.credit);
                  const projectLabel = line.project
                    ? line.project.name
                    : line.isCompanyLevel
                      ? 'Company'
                      : '—';
                  return (
                    <tr key={line.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            isDebit ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {isDebit ? 'EXPENSE' : 'CREDIT'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {line.account.code} - {line.account.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {projectLabel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {formatCurrency(amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Total Expense</label>
              <p className="mt-1 text-lg font-semibold text-red-600">
                {formatCurrency(totalDebit)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Total Credit</label>
              <p className="mt-1 text-lg font-semibold text-green-600">
                {formatCurrency(totalCredit)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Balanced?</label>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {balanced ? 'Yes' : 'No'}
              </p>
            </div>
            {voucher.status === 'POSTED' && voucher.postedAt && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-500">Posted At</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(voucher.postedAt).toLocaleString()}
                  </p>
                </div>
                {voucher.postedBy && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Posted By</label>
                    <p className="mt-1 text-sm text-gray-900">{voucher.postedBy.name}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
