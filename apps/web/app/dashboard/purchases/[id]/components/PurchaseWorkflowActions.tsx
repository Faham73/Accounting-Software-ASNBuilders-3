'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PurchaseStatus } from '@accounting/shared';

interface PurchaseWorkflowActionsProps {
  purchaseId: string;
  status: PurchaseStatus | string | null | undefined;
  voucherId: string | null;
  voucherNo: string | null;
  paidAmount: number | string | null | undefined;
  paymentAccountId: string | null;
  canApprove: boolean;
  canPost: boolean;
  canWrite: boolean;
}

export default function PurchaseWorkflowActions({
  purchaseId,
  status,
  voucherId,
  voucherNo,
  paidAmount,
  paymentAccountId,
  canApprove,
  canPost,
  canWrite,
}: PurchaseWorkflowActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleWorkflowAction = async (action: 'SUBMIT' | 'APPROVE' | 'POST' | 'REVERSE') => {
    if (isLoading) return;

    let confirmMessage = '';
    switch (action) {
      case 'SUBMIT':
        confirmMessage = 'Are you sure you want to submit this purchase?';
        break;
      case 'APPROVE':
        confirmMessage = 'Are you sure you want to approve this purchase?';
        break;
      case 'POST':
        confirmMessage = 'Are you sure you want to post this purchase? This will create inventory transactions and cannot be undone easily.';
        break;
      case 'REVERSE':
        confirmMessage = 'Are you sure you want to reverse this purchase? This will create a reversal voucher.';
        break;
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsLoading(action);

    try {
      const response = await fetch(`/api/purchases/${purchaseId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (data.ok) {
        // Refresh to get updated status
        router.refresh();
        // Small delay to ensure refresh completes
        setTimeout(() => {
          router.refresh();
        }, 100);
      } else {
        alert(data.error || `Failed to ${action.toLowerCase()} purchase`);
      }
    } catch (error) {
      alert(`An error occurred while ${action.toLowerCase()}ing the purchase`);
    } finally {
      setIsLoading(null);
    }
  };

  const handleCreateVoucher = async () => {
    if (isLoading) return;

    setIsLoading('CREATE_VOUCHER');

    try {
      const response = await fetch(`/api/purchases/${purchaseId}/ensure-voucher`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.ok) {
        // Refresh to get updated voucher info
        router.refresh();
        // Small delay to ensure refresh completes
        setTimeout(() => {
          router.refresh();
        }, 100);
      } else {
        alert(data.error || 'Failed to create voucher');
      }
    } catch (error) {
      alert('An error occurred while creating the voucher');
    } finally {
      setIsLoading(null);
    }
  };

  // Normalize status once at the top to avoid undefined
  const normalizedStatus = (status ?? 'DRAFT').toString();

  // Normalize paidAmount safely
  const paid = typeof paidAmount === 'string' ? Number(paidAmount) : (paidAmount ?? 0);

  // Boolean flags based on normalized status
  const isPosted = normalizedStatus === 'POSTED';
  const isReversed = normalizedStatus === 'REVERSED';
  const isApproved = normalizedStatus === 'APPROVED';
  const isSubmitted = normalizedStatus === 'SUBMITTED';
  const isDraft = normalizedStatus === 'DRAFT';

  const canCreateVoucher = !voucherId && canWrite && isDraft;
  const needsPaymentAccount = paid > 0 && !paymentAccountId;
  const isCreateVoucherDisabled = isLoading === 'CREATE_VOUCHER' || needsPaymentAccount;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {canCreateVoucher && (
        <div className="flex flex-col gap-1">
          <button
            onClick={handleCreateVoucher}
            disabled={isCreateVoucherDisabled}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={needsPaymentAccount ? 'Payment account is required when paid amount > 0' : ''}
          >
            {isLoading === 'CREATE_VOUCHER' ? 'Creating...' : 'Create Voucher'}
          </button>
          {needsPaymentAccount && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-amber-600">
                Payment account required (paid amount &gt; 0)
              </p>
              <Link
                href={`/dashboard/purchases/${purchaseId}/edit`}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Edit Purchase to add payment account
              </Link>
            </div>
          )}
        </div>
      )}

      {voucherId && (
        <Link
          href={`/dashboard/vouchers/${voucherId}`}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          View Voucher {voucherNo ? `(${voucherNo})` : ''}
        </Link>
      )}

      {voucherId && isDraft && canWrite && !isPosted && (
        <button
          onClick={() => handleWorkflowAction('SUBMIT')}
          disabled={isLoading !== null}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
        >
          {isLoading === 'SUBMIT' ? 'Submitting...' : 'Submit'}
        </button>
      )}

      {voucherId && (isSubmitted && !isApproved && !isPosted) && canApprove && (
        <button
          onClick={() => handleWorkflowAction('APPROVE')}
          disabled={isLoading !== null}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading === 'APPROVE' ? 'Approving...' : 'Approve'}
        </button>
      )}

      {voucherId && (isApproved && !isPosted) && canPost && (
        <button
          onClick={() => handleWorkflowAction('POST')}
          disabled={isLoading !== null || isPosted}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
        >
          {isLoading === 'POST' ? 'Posting...' : isPosted ? 'Posted' : 'Post'}
        </button>
      )}

      {voucherId && isPosted && canPost && !isReversed && (
        <button
          onClick={() => handleWorkflowAction('REVERSE')}
          disabled={isLoading !== null}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
        >
          {isLoading === 'REVERSE' ? 'Reversing...' : 'Reverse'}
        </button>
      )}

      {voucherId && isPosted && (
        <span className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600">
          Posted
        </span>
      )}
    </div>
  );
}
