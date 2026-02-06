'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toMoney } from '@/lib/payables';

interface BalanceSheetClientProps {
  initialData: {
    assets: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      balance: number;
    }>;
    liabilities: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      balance: number;
    }>;
    equity: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      balance: number;
    }>;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    difference: number;
  };
  asOfDate: string;
}

export default function BalanceSheetClient({
  initialData,
  asOfDate,
}: BalanceSheetClientProps) {
  const router = useRouter();
  const [asOf, setAsOf] = useState(asOfDate);

  const handleFilter = () => {
    router.push(`/dashboard/reports/financial/balance-sheet?asOf=${asOf}`);
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
            <h3 className="text-lg font-medium text-gray-900">Assets</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Account
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {initialData.assets.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">
                      No asset accounts with balance
                    </td>
                  </tr>
                ) : (
                  initialData.assets.map((asset) => (
                    <tr key={asset.accountId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium text-gray-900">{asset.accountCode}</div>
                        <div className="text-gray-500">{asset.accountName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {toMoney(asset.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr className="font-medium">
                  <td className="px-6 py-4 text-sm text-gray-900">Total Assets</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {toMoney(initialData.totalAssets)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Liabilities & Equity */}
        <div className="space-y-6">
          {/* Liabilities */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
              <h3 className="text-lg font-medium text-gray-900">Liabilities</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Account
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {initialData.liabilities.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">
                        No liability accounts with balance
                      </td>
                    </tr>
                  ) : (
                    initialData.liabilities.map((liability) => (
                      <tr key={liability.accountId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm">
                          <div className="font-medium text-gray-900">{liability.accountCode}</div>
                          <div className="text-gray-500">{liability.accountName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {toMoney(liability.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr className="font-medium">
                    <td className="px-6 py-4 text-sm text-gray-900">Total Liabilities</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {toMoney(initialData.totalLiabilities)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Equity */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
              <h3 className="text-lg font-medium text-gray-900">Equity</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Account
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {initialData.equity.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">
                        No equity accounts with balance
                      </td>
                    </tr>
                  ) : (
                    initialData.equity.map((equity) => (
                      <tr key={equity.accountId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm">
                          <div className="font-medium text-gray-900">{equity.accountCode}</div>
                          <div className="text-gray-500">{equity.accountName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {toMoney(equity.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr className="font-medium">
                    <td className="px-6 py-4 text-sm text-gray-900">Total Equity</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {toMoney(initialData.totalEquity)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-gray-600 mb-1">Total Assets</div>
            <div className="text-2xl font-bold text-gray-900">
              {toMoney(initialData.totalAssets)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Total Liabilities + Equity</div>
            <div className="text-2xl font-bold text-gray-900">
              {toMoney(initialData.totalLiabilitiesAndEquity)}
            </div>
          </div>
        </div>
        {initialData.difference !== 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> Balance sheet equation is out of balance by{' '}
              {toMoney(Math.abs(initialData.difference))}. Assets should equal Liabilities +
              Equity.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
