'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toMoney } from '@/lib/payables';
import Link from 'next/link';

interface OverheadReportClientProps {
  initialData: {
    vouchers: Array<{
      id: string;
      voucherNo: string;
      date: Date;
      narration: string | null;
      status: string;
      lines: Array<{
        account: { code: string; name: string };
        vendor: { name: string } | null;
        debit: any;
      }>;
      createdBy: { name: string };
    }>;
    totalOverhead: number;
    accountBreakdown: Array<{ code: string; name: string; amount: number }>;
    vendorBreakdown: Array<{ id: string; name: string; amount: number }>;
    monthStart: Date;
    monthEnd: Date;
  };
  allocationResults: any;
  selectedMonth: Date;
  includeDraft: boolean;
}

export default function OverheadReportClient({
  initialData,
  allocationResults,
  selectedMonth,
  includeDraft: initialIncludeDraft,
}: OverheadReportClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [includeDraft, setIncludeDraft] = useState(initialIncludeDraft);

  const monthStr = selectedMonth.toISOString().split('T')[0].substring(0, 7); // YYYY-MM

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMonth = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (newMonth) {
      params.set('month', newMonth);
    } else {
      params.delete('month');
    }
    router.push(`/dashboard/reports/overhead?${params.toString()}`);
  };

  const handleToggleDraft = () => {
    const newValue = !includeDraft;
    setIncludeDraft(newValue);
    const params = new URLSearchParams(searchParams.toString());
    if (newValue) {
      params.set('includeDraft', 'true');
    } else {
      params.delete('includeDraft');
    }
    router.push(`/dashboard/reports/overhead?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">
              Month
            </label>
            <input
              type="month"
              id="month"
              value={monthStr}
              onChange={handleMonthChange}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={includeDraft}
                onChange={handleToggleDraft}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include draft vouchers</span>
            </label>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Overhead</h3>
          <p className="text-2xl font-semibold text-gray-900">{toMoney(initialData.totalOverhead)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Vouchers</h3>
          <p className="text-2xl font-semibold text-gray-900">{initialData.vouchers.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Period</h3>
          <p className="text-sm font-medium text-gray-900">
            {new Date(initialData.monthStart).toLocaleDateString()} -{' '}
            {new Date(initialData.monthEnd).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Breakdown by Account */}
      {initialData.accountBreakdown.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Breakdown by Account</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {initialData.accountBreakdown.map((item) => (
                  <tr key={item.code} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {toMoney(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Breakdown by Vendor */}
      {initialData.vendorBreakdown.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Breakdown by Vendor</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {initialData.vendorBreakdown.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {toMoney(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vouchers Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Office Vouchers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voucher No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Narration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {initialData.vouchers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No office vouchers found for this month
                  </td>
                </tr>
              ) : (
                initialData.vouchers.map((voucher) => (
                  <tr key={voucher.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {voucher.voucherNo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(voucher.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{voucher.narration || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          voucher.status === 'POSTED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {voucher.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{voucher.createdBy.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      <Link
                        href={`/dashboard/vouchers/${voucher.id}`}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocation Results */}
      {allocationResults && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Allocation Results</h3>
              <Link
                href={`/dashboard/reports/overhead/allocation?month=${monthStr}`}
                className="text-sm text-blue-600 hover:text-blue-900 font-medium"
              >
                Manage Allocation
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Allocated Amount</th>
                  {allocationResults.method === 'PERCENT' && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Percent</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allocationResults.results.map((result: any) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.project.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {toMoney(result.amount)}
                    </td>
                    {allocationResults.method === 'PERCENT' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                        {result.amount && allocationResults.results.length > 0
                          ? ((Number(result.amount) / Number(allocationResults.results.reduce((sum: number, r: any) => sum + Number(r.amount), 0))) * 100).toFixed(2) + '%'
                          : '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
