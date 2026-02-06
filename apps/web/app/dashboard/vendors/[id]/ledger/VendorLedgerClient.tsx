'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toMoney } from '@/lib/payables';

interface VendorLedgerClientProps {
  vendor: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
  };
  lines: Array<{
    id: string;
    date: Date;
    voucherId: string;
    voucherNo: string;
    voucherType: string | null;
    narration: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    impact: number;
    runningBalance: number;
  }>;
  glBalance: number;
  openBalance: number;
  vendorId: string;
  canCreatePayment: boolean;
}

export default function VendorLedgerClient({
  vendor,
  lines,
  glBalance,
  openBalance,
  vendorId,
  canCreatePayment,
}: VendorLedgerClientProps) {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Set default to current month
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const from = new Date(year, month, 1);
    const to = new Date(year, month + 1, 0);
    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(to.toISOString().split('T')[0]);
  }, []);

  const handlePrint = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.append('from', dateFrom);
    if (dateTo) params.append('to', dateTo);
    window.open(`/print/vendors/${vendorId}/statement?${params.toString()}`, '_blank');
  };

  const handleDownloadPDF = async () => {
    try {
      const params = new URLSearchParams();
      params.append('id', vendorId);
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      const response = await fetch(`/api/pdf/vendor-statement?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vendor-statement-${vendor.name}-${dateFrom || 'all'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('An error occurred while generating the PDF');
    }
  };

  return (
    <div className="space-y-6">
      {/* Vendor Header Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{vendor.name}</h2>
            {vendor.phone && <p className="text-sm text-gray-600 mt-1">Phone: {vendor.phone}</p>}
            {vendor.address && <p className="text-sm text-gray-600 mt-1">Address: {vendor.address}</p>}
          </div>
          <div className="text-right">
            {canCreatePayment && (
              <a
                href={`/dashboard/vouchers/new/payment?vendorId=${vendorId}`}
                className="inline-block px-4 py-2 mb-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Create Payment
              </a>
            )}
            <div className="flex gap-2 mb-4">
              <button
                onClick={handlePrint}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              >
                <span>🖨️</span> Print Statement
              </button>
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              >
                <span>📄</span> PDF
              </button>
            </div>
            <div className="mb-2 text-sm">
              <label className="block text-xs text-gray-500 mb-1">Date Range:</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1"
                />
                <span className="self-center text-xs">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1"
                />
              </div>
            </div>
            <div className="space-y-1">
              <div>
                <span className="text-sm text-gray-500">GL Balance:</span>
                <span className={`ml-2 text-lg font-semibold ${glBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {toMoney(glBalance)}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Open Balance:</span>
                <span className={`ml-2 text-lg font-semibold ${openBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {toMoney(openBalance)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Ledger Entries</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voucher No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Running Balance</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                    No ledger entries found
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(line.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href={`/dashboard/vouchers/${line.voucherId}`}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        {line.voucherNo}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {line.voucherType || 'JOURNAL'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{line.narration || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {line.accountCode} - {line.accountName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {line.debit > 0 ? toMoney(line.debit) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {line.credit > 0 ? toMoney(line.credit) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      <span className={line.runningBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {toMoney(line.runningBalance)}
                      </span>
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
