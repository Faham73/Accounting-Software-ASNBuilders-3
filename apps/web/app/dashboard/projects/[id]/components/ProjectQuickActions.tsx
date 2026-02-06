'use client';

import Link from 'next/link';

interface ProjectQuickActionsProps {
  projectId: string;
}

export default function ProjectQuickActions({ projectId }: ProjectQuickActionsProps) {
  const returnTo = `/dashboard/projects/${projectId}`;
  const addPurchaseUrl = `/dashboard/purchases/new?projectId=${projectId}&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm mb-6 -mx-0 px-0">
      <div className="flex flex-wrap items-center gap-2 py-3">
        <Link
          href={addPurchaseUrl}
          className="inline-flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <span aria-hidden>📦</span>
          Add Purchase
        </Link>
        <Link
          href={`/dashboard/projects/${projectId}/stock`}
          className="inline-flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
        >
          <span aria-hidden>📥</span>
          Use Stock
        </Link>
        <Link
          href={`/dashboard/projects/${projectId}/debit/new`}
          className="inline-flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
        >
          <span aria-hidden>📉</span>
          Add Expense
        </Link>
        <Link
          href={`/dashboard/projects/${projectId}/labor/day`}
          className="inline-flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
        >
          <span aria-hidden>👷</span>
          Add Labor
        </Link>
        <Link
          href={`/dashboard/projects/${projectId}/labor/contract`}
          className="inline-flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
        >
          <span aria-hidden>📋</span>
          Add Contract Worker
        </Link>
        <Link
          href={`/dashboard/projects/${projectId}/ledger`}
          className="inline-flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
        >
          <span aria-hidden>📒</span>
          View Ledger
        </Link>
      </div>
    </div>
  );
}
