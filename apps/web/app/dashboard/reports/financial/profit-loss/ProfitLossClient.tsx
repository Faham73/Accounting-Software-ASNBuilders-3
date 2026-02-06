'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toMoney } from '@/lib/payables';

interface ProfitLossClientProps {
  initialData: {
    income: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      amount: number;
    }>;
    expenses: Array<{
      accountId: string;
      accountCode: string;
      accountName: string;
      amount: number;
    }>;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  };
  fromDate: string;
  toDate: string;
}

export default function ProfitLossClient({
  initialData,
  fromDate,
  toDate,
}: ProfitLossClientProps) {
  const router = useRouter();
  const [from, setFrom] = useState(fromDate);
  const [to, setTo] = useState(toDate);

  const handleFilter = () => {
    router.push(`/dashboard/reports/financial/profit-loss?from=${from}&to=${to}`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Income Section */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
          <h3 className="text-lg font-medium text-gray-900">Income</h3>
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initialData.income.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                    No income transactions found
                  </td>
                </tr>
              ) : (
                initialData.income.map((item) => (
                  <tr key={item.accountId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.accountCode}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.accountName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600">
                      {toMoney(item.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr className="font-medium">
                <td colSpan={2} className="px-6 py-4 text-sm text-gray-900">
                  Total Income
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                  {toMoney(initialData.totalIncome)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Expenses Section */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
          <h3 className="text-lg font-medium text-gray-900">Expenses</h3>
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initialData.expenses.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                    No expense transactions found
                  </td>
                </tr>
              ) : (
                initialData.expenses.map((item) => (
                  <tr key={item.accountId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.accountCode}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.accountName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                      {toMoney(item.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr className="font-medium">
                <td colSpan={2} className="px-6 py-4 text-sm text-gray-900">
                  Total Expenses
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                  {toMoney(initialData.totalExpenses)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Net Profit */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Net Profit / Loss</h3>
          <span
            className={`text-2xl font-bold ${
              initialData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {toMoney(initialData.netProfit)}
          </span>
        </div>
      </div>
    </div>
  );
}
