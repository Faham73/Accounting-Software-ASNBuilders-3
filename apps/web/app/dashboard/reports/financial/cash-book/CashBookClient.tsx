'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toMoney } from '@/lib/payables';
import Link from 'next/link';

interface CashBookClientProps {
  initialData: {
    account: { id: string; code: string; name: string; type: string };
    entries: Array<{
      id: string;
      date: Date;
      voucherId: string;
      voucherNo: string;
      voucherType: string | null;
      narration: string | null;
      projectName: string | null;
      vendorName: string | null;
      description: string | null;
      debit: number;
      credit: number;
      runningBalance: number;
    }>;
    openingBalance: number;
    closingBalance: number;
  };
  availableAccounts: Array<{ id: string; code: string; name: string }>;
  selectedAccountId: string | null;
  fromDate: string;
  toDate: string;
}

export default function CashBookClient({
  initialData,
  availableAccounts,
  selectedAccountId,
  fromDate,
  toDate,
}: CashBookClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accountId, setAccountId] = useState(selectedAccountId || '');
  const [from, setFrom] = useState(fromDate);
  const [to, setTo] = useState(toDate);

  const handleFilter = () => {
    const params = new URLSearchParams();
    if (accountId) params.set('accountId', accountId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    router.push(`/dashboard/reports/financial/cash-book?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Cash Accounts</option>
              {availableAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleFilter}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Account Info */}
      {initialData.account && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {initialData.account.code} - {initialData.account.name}
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Opening Balance:</span>
              <span className="ml-2 font-medium">
                {toMoney(initialData.openingBalance)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Closing Balance:</span>
              <span className="ml-2 font-medium">
                {toMoney(initialData.closingBalance)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Net Change:</span>
              <span className="ml-2 font-medium">
                {toMoney(initialData.closingBalance - initialData.openingBalance)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Cash Book Ledger</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Voucher No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Narration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Vendor
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Debit
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Credit
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initialData.entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                initialData.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/dashboard/vouchers/${entry.voucherId}`}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        {entry.voucherNo}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {entry.narration || entry.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.projectName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.vendorName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {entry.debit > 0 ? toMoney(entry.debit) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {entry.credit > 0 ? toMoney(entry.credit) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      {toMoney(entry.runningBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
