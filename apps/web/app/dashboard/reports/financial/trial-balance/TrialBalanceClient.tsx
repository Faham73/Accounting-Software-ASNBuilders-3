'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toMoney } from '@/lib/payables';

interface TrialBalanceClientProps {
  initialData: {
    entries: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      type: string;
      debitTotal: number;
      creditTotal: number;
      netBalance: number;
    }>;
    totalDebits: number;
    totalCredits: number;
    difference: number;
  };
  asOfDate: string;
}

export default function TrialBalanceClient({
  initialData,
  asOfDate,
}: TrialBalanceClientProps) {
  const router = useRouter();
  const [asOf, setAsOf] = useState(asOfDate);

  const handleFilter = () => {
    router.push(`/dashboard/reports/financial/trial-balance?asOf=${asOf}`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              As Of Date
            </label>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleFilter}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>

      {/* Trial Balance Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Trial Balance</h3>
          <p className="text-sm text-gray-600 mt-1">As of {new Date(asOf).toLocaleDateString()}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Account Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Account Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Debit Total
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Credit Total
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Net Balance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initialData.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No accounts with activity found
                  </td>
                </tr>
              ) : (
                initialData.entries.map((entry) => (
                  <tr key={entry.accountId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {entry.accountCode}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{entry.accountName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {entry.debitTotal > 0 ? toMoney(entry.debitTotal) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {entry.creditTotal > 0 ? toMoney(entry.creditTotal) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      {toMoney(entry.netBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr className="font-medium">
                <td colSpan={3} className="px-6 py-4 text-sm text-gray-900">
                  Total
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {toMoney(initialData.totalDebits)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {toMoney(initialData.totalCredits)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {toMoney(initialData.difference)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {initialData.difference !== 0 && (
          <div className="px-6 py-4 bg-yellow-50 border-t border-yellow-200">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> Trial balance is out of balance by{' '}
              {toMoney(Math.abs(initialData.difference))}. Total debits should equal total credits.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
