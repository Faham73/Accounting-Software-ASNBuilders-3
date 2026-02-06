'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toMoney } from '@/lib/payables';

interface PayablesSummaryClientProps {
  initialData: Array<{
    vendorId: string;
    vendorName: string;
    glBalance: number;
    openBalance: number;
    lastActivityDate: Date | null;
  }>;
  showZeroBalances: boolean;
}

export default function PayablesSummaryClient({ initialData, showZeroBalances: initialShowZero }: PayablesSummaryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showZeroBalances, setShowZeroBalances] = useState(initialShowZero);

  const handleToggleZeroBalances = () => {
    const newValue = !showZeroBalances;
    setShowZeroBalances(newValue);
    const params = new URLSearchParams(searchParams.toString());
    if (newValue) {
      params.set('showZero', 'true');
    } else {
      params.delete('showZero');
    }
    router.push(`/dashboard/reports/payables?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showZeroBalances}
              onChange={handleToggleZeroBalances}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Show zero balances</span>
          </label>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Vendor Payables</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Open Balance</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">GL Balance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initialData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    {showZeroBalances
                      ? 'No vendors found'
                      : 'No vendors with outstanding payables'}
                  </td>
                </tr>
              ) : (
                initialData.map((item) => (
                  <tr key={item.vendorId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href={`/dashboard/vendors/${item.vendorId}/ledger`}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        {item.vendorName}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      <span className={item.openBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {toMoney(item.openBalance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {toMoney(item.glBalance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.lastActivityDate
                        ? new Date(item.lastActivityDate).toLocaleDateString()
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {initialData.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Total</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                    <span className="text-green-600">
                      {toMoney(initialData.reduce((sum, item) => sum + item.openBalance, 0))}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-gray-900">
                    {toMoney(initialData.reduce((sum, item) => sum + item.glBalance, 0))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
