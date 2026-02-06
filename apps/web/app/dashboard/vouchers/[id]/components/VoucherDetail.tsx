'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface VoucherDetailProps {
  voucher: any;
  canEdit: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canPost: boolean;
  canReverse: boolean;
  currentUserId: string;
}

export default function VoucherDetail({
  voucher,
  canEdit,
  canSubmit,
  canApprove,
  canPost,
  canReverse,
  currentUserId,
}: VoucherDetailProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isReversing, setIsReversing] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reverseDate, setReverseDate] = useState(new Date().toISOString().split('T')[0]);
  const [reverseDescription, setReverseDescription] = useState(
    `Reversal of ${voucher.voucherNo}`
  );

  const totalDebit = voucher.lines.reduce((sum: number, line: any) => sum + Number(line.debit), 0);
  const totalCredit = voucher.lines.reduce((sum: number, line: any) => sum + Number(line.credit), 0);

  const handleSubmit = async () => {
    if (!confirm('Are you sure you want to submit this voucher for approval?')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/vouchers/${voucher.id}/submit`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.ok) {
        window.location.reload();
      } else {
        alert(data.error || 'Failed to submit voucher');
      }
    } catch (error) {
      alert('An error occurred while submitting the voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Are you sure you want to approve this voucher?')) {
      return;
    }

    setIsApproving(true);
    try {
      const response = await fetch(`/api/vouchers/${voucher.id}/approve`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.ok) {
        window.location.reload();
      } else {
        alert(data.error || 'Failed to approve voucher');
      }
    } catch (error) {
      alert('An error occurred while approving the voucher');
    } finally {
      setIsApproving(false);
    }
  };

  const handlePost = async () => {
    if (!confirm('Are you sure you want to post this voucher? It cannot be edited after posting.')) {
      return;
    }

    setIsPosting(true);
    try {
      const response = await fetch(`/api/vouchers/${voucher.id}/post`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.ok) {
        window.location.reload();
      } else {
        alert(data.error || 'Failed to post voucher');
      }
    } catch (error) {
      alert('An error occurred while posting the voucher');
    } finally {
      setIsPosting(false);
    }
  };

  const handleReverse = async () => {
    setIsReversing(true);
    try {
      const response = await fetch(`/api/vouchers/${voucher.id}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: reverseDate,
          description: reverseDescription,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        // Redirect to the reversal voucher
        router.push(`/dashboard/vouchers/${data.data.id}`);
      } else {
        alert(data.error || 'Failed to reverse voucher');
        setIsReversing(false);
      }
    } catch (error) {
      alert('An error occurred while reversing the voucher');
      setIsReversing(false);
    }
  };

  const handlePrint = () => {
    window.open(`/print/vouchers/${voucher.id}`, '_blank');
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/pdf/voucher?id=${voucher.id}`);
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voucher-${voucher.voucherNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('An error occurred while generating the PDF');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'POSTED':
        return 'bg-green-100 text-green-800';
      case 'APPROVED':
        return 'bg-blue-100 text-blue-800';
      case 'SUBMITTED':
        return 'bg-yellow-100 text-yellow-800';
      case 'REVERSED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      {/* Actions */}
      <div className="mb-6 flex gap-4 justify-end print:hidden flex-wrap">
        {canEdit && (
          <Link
            href={`/dashboard/vouchers/${voucher.id}/edit`}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Edit
          </Link>
        )}
        {canSubmit && (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        )}
        {canApprove && (
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isApproving ? 'Approving...' : 'Approve'}
          </button>
        )}
        {canPost && (
          <button
            onClick={handlePost}
            disabled={isPosting}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
          >
            {isPosting ? 'Posting...' : 'Post Voucher'}
          </button>
        )}
        {canReverse && (
          <button
            onClick={() => setShowReverseModal(true)}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
          >
            Reverse
          </button>
        )}
        {/* Print/PDF actions - show for all vouchers */}
        <Link
          href={`/print/vouchers/${voucher.id}`}
          target="_blank"
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
        >
          <span>🖨️</span> Print
        </Link>
        <button
          onClick={handleDownloadPDF}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
        >
          <span>📄</span> PDF
        </button>
        <Link
          href="/dashboard/vouchers"
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Back to List
        </Link>
      </div>

      {/* Status Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Status Timeline</h3>
        <div className="space-y-3">
          <div className="flex items-center">
            <div
              className={`w-3 h-3 rounded-full mr-3 ${
                ['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED'].includes(voucher.status)
                  ? 'bg-blue-500'
                  : 'bg-gray-300'
              }`}
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Draft</div>
              <div className="text-xs text-gray-500">
                Created by {voucher.createdBy?.name} on{' '}
                {new Date(voucher.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
          {voucher.submittedAt && (
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full mr-3 ${
                  ['SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED'].includes(voucher.status)
                    ? 'bg-yellow-500'
                    : 'bg-gray-300'
                }`}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Submitted</div>
                <div className="text-xs text-gray-500">
                  {voucher.submittedBy?.name} on{' '}
                  {new Date(voucher.submittedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}
          {voucher.approvedAt && (
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full mr-3 ${
                  ['APPROVED', 'POSTED', 'REVERSED'].includes(voucher.status)
                    ? 'bg-blue-500'
                    : 'bg-gray-300'
                }`}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Approved</div>
                <div className="text-xs text-gray-500">
                  {voucher.approvedBy?.name} on {new Date(voucher.approvedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}
          {voucher.postedAt && (
            <div className="flex items-center">
              <div
                className={`w-3 h-3 rounded-full mr-3 ${
                  ['POSTED', 'REVERSED'].includes(voucher.status) ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Posted</div>
                <div className="text-xs text-gray-500">
                  {voucher.postedBy?.name} on {new Date(voucher.postedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}
          {voucher.reversedAt && (
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full mr-3 bg-red-500" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">Reversed</div>
                <div className="text-xs text-gray-500">
                  {voucher.reversedBy?.name} on {new Date(voucher.reversedAt).toLocaleString()}
                </div>
                {voucher.reversalVouchers && voucher.reversalVouchers.length > 0 && (
                  <div className="text-xs text-blue-600 mt-1">
                    <Link
                      href={`/dashboard/vouchers/${voucher.reversalVouchers[0].id}`}
                      className="hover:underline"
                    >
                      View Reversal: {voucher.reversalVouchers[0].voucherNo}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reversal Link (if this is a reversal voucher) */}
      {voucher.originalVoucher && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="text-sm">
            <span className="font-medium text-blue-900">This is a reversal voucher.</span>
            <span className="text-blue-700 ml-2">
              Original:{' '}
              <Link
                href={`/dashboard/vouchers/${voucher.originalVoucher.id}`}
                className="hover:underline font-medium"
              >
                {voucher.originalVoucher.voucherNo}
              </Link>
            </span>
          </div>
        </div>
      )}

      {/* Voucher Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Voucher Number</h3>
            <p className="mt-1 text-lg font-semibold text-gray-900">{voucher.voucherNo}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Date</h3>
            <p className="mt-1 text-lg text-gray-900">
              {new Date(voucher.date).toLocaleDateString()}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Type</h3>
            <p className="mt-1 text-lg text-gray-900">{voucher.type || 'JOURNAL'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Status</h3>
            <p className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(voucher.status)}`}>
                {voucher.status}
              </span>
            </p>
          </div>
          {voucher.project && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Project</h3>
              <p className="mt-1 text-lg text-gray-900">{voucher.project.name}</p>
            </div>
          )}
          {voucher.narration && (
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-gray-500">Narration</h3>
              <p className="mt-1 text-gray-900">{voucher.narration}</p>
            </div>
          )}
        </div>
      </div>

      {/* Voucher Lines */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Account
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Debit
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Credit
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {voucher.lines.map((line: any, index: number) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {line.account.code} - {line.account.name}
                  </div>
                  {line.project && (
                    <div className="text-xs text-gray-500">Project: {line.project.name}</div>
                  )}
                  {line.vendor && (
                    <div className="text-xs text-gray-500">Vendor: {line.vendor.name}</div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{line.description || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {Number(line.debit) > 0
                    ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(Number(line.debit))
                    : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {Number(line.credit) > 0
                    ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(Number(line.credit))
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={2} className="px-6 py-4 text-right font-medium text-gray-900">
                Totals:
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(totalDebit)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(totalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Allocations (for Payment Vouchers) */}
      {voucher.type === 'PAYMENT' && voucher.allocations && voucher.allocations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Payment Allocations</h3>
            <p className="text-sm text-gray-500 mt-1">
              This payment voucher allocates amounts to the following vendor payable lines:
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Source Voucher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Account
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Allocated Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {voucher.allocations.map((allocation: any, index: number) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/dashboard/vouchers/${allocation.sourceLine.voucher.id}`}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        {allocation.sourceLine.voucher.voucherNo}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(allocation.sourceLine.voucher.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {allocation.sourceLine.account.code} - {allocation.sourceLine.account.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(Number(allocation.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right font-medium text-gray-900">
                    Total Allocated:
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(
                      voucher.allocations.reduce(
                        (sum: number, alloc: any) => sum + Number(alloc.amount),
                        0
                      )
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Reverse Modal */}
      {showReverseModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Reverse Voucher</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reversal Date
                  </label>
                  <input
                    type="date"
                    value={reverseDate}
                    onChange={(e) => setReverseDate(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={reverseDescription}
                    onChange={(e) => setReverseDescription(e.target.value)}
                    rows={3}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <button
                    onClick={() => {
                      setShowReverseModal(false);
                      setIsReversing(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReverse}
                    disabled={isReversing}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                  >
                    {isReversing ? 'Reversing...' : 'Confirm Reverse'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
