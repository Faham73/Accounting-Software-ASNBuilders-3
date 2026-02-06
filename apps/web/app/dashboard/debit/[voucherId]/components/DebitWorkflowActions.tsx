'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface DebitWorkflowActionsProps {
  voucherId: string;
  status: string;
  canSubmit: boolean;
  canApprove: boolean;
  canPost: boolean;
}

export default function DebitWorkflowActions({
  voucherId,
  status,
  canSubmit,
  canApprove,
  canPost,
}: DebitWorkflowActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleWorkflow = async (action: 'submit' | 'approve' | 'post') => {
    if (isLoading) return;
    const confirmMsg =
      action === 'submit'
        ? 'Are you sure you want to submit this voucher?'
        : action === 'approve'
          ? 'Are you sure you want to approve this voucher?'
          : 'Are you sure you want to post this voucher?';
    if (!confirm(confirmMsg)) return;

    setIsLoading(action);
    try {
      const path = action === 'submit' ? 'submit' : action === 'approve' ? 'approve' : 'post';
      const response = await fetch(`/api/vouchers/${voucherId}/${path}`, { method: 'POST' });
      const data = await response.json();
      if (data.ok) {
        router.refresh();
        setTimeout(() => router.refresh(), 100);
      } else {
        alert(data.error || `Failed to ${action}`);
      }
    } catch (err) {
      alert(`An error occurred while ${action}ing the voucher`);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'DRAFT' && canSubmit && (
        <button
          type="button"
          onClick={() => handleWorkflow('submit')}
          disabled={!!isLoading}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
        >
          {isLoading === 'submit' ? 'Submitting…' : 'Submit'}
        </button>
      )}
      {status === 'SUBMITTED' && canApprove && (
        <button
          type="button"
          onClick={() => handleWorkflow('approve')}
          disabled={!!isLoading}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading === 'approve' ? 'Approving…' : 'Approve'}
        </button>
      )}
      {status === 'APPROVED' && canPost && (
        <button
          type="button"
          onClick={() => handleWorkflow('post')}
          disabled={!!isLoading}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading === 'post' ? 'Posting…' : 'Post'}
        </button>
      )}
      <Link
        href="/dashboard/debit"
        className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
      >
        Back to Expense List
      </Link>
    </div>
  );
}
