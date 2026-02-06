'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LedgerRow {
  voucherId: string;
  voucherNo: string;
  voucherDate: string;
  voucherNarration: string | null;
  lineId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  vendorId: string | null;
  vendorName: string | null;
  category: string;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  description: string | null;
}

interface LedgerResponse {
  project: { id: string; name: string };
  filtersApplied: Record<string, any>;
  rows: LedgerRow[];
  totals: {
    totalDebit: number;
    totalCredit: number;
    net: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface FilterOption {
  id: string;
  name: string;
}

interface ProjectLedgerClientProps {
  projectId: string;
  projectName: string;
}

export default function ProjectLedgerClient({
  projectId,
  projectName,
}: ProjectLedgerClientProps) {
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    vendorId: '',
    category: '',
    paymentMethodId: '',
    accountId: '',
    type: 'ALL',
  });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const handlePrint = () => {
    const params = new URLSearchParams();
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    window.open(`/print/projects/${projectId}/statement?${params.toString()}`, '_blank');
  };

  const handleDownloadPDF = async () => {
    try {
      const params = new URLSearchParams();
      params.append('id', projectId);
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      const response = await fetch(`/api/pdf/project-statement?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-statement-${projectName}-${filters.from || 'all'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('An error occurred while generating the PDF');
    }
  };

  // Filter options
  const [vendors, setVendors] = useState<FilterOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<FilterOption[]>([]);
  const [accounts, setAccounts] = useState<FilterOption[]>([]);

  const fetchLedger = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.vendorId) params.append('vendorId', filters.vendorId);
      if (filters.category) params.append('category', filters.category);
      if (filters.paymentMethodId) params.append('paymentMethodId', filters.paymentMethodId);
      if (filters.accountId) params.append('accountId', filters.accountId);
      if (filters.type !== 'ALL') params.append('type', filters.type);
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      const response = await fetch(`/api/projects/${projectId}/ledger?${params.toString()}`);
      const result = await response.json();

      if (result.ok) {
        setData(result.data);
      } else {
        console.error('Failed to fetch ledger:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch ledger:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch filter options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [vendorsRes, paymentMethodsRes, accountsRes] = await Promise.all([
          fetch('/api/vendors?active=true'),
          fetch('/api/payment-methods?active=true'),
          fetch('/api/chart-of-accounts?active=true'),
        ]);

        if (vendorsRes.ok) {
          const vendorsData = await vendorsRes.json();
          setVendors(vendorsData.data || []);
        }
        if (paymentMethodsRes.ok) {
          const paymentMethodsData = await paymentMethodsRes.json();
          setPaymentMethods(paymentMethodsData.data || []);
        }
        if (accountsRes.ok) {
          const accountsData = await accountsRes.json();
          setAccounts(accountsData.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch filter options:', error);
      }
    };

    fetchOptions();
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [filters, page]);

  const handleResetFilters = () => {
    setFilters({
      from: '',
      to: '',
      vendorId: '',
      category: '',
      paymentMethodId: '',
      accountId: '',
      type: 'ALL',
    });
    setPage(1);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div>
      {/* Actions */}
      <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Project Ledger: {projectName}</h2>
        <div className="flex gap-2">
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
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
            <select
              value={filters.vendorId}
              onChange={(e) => setFilters({ ...filters, vendorId: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All Vendors</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All Categories</option>
              <option value="CIVIL">Civil</option>
              <option value="MATERIALS">Materials</option>
              <option value="MATI_KATA">Mati Kata</option>
              <option value="DHALAI">Dhalai</option>
              <option value="OTHERS">Others</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={filters.paymentMethodId}
              onChange={(e) => setFilters({ ...filters, paymentMethodId: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All Payment Methods</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <select
              value={filters.accountId}
              onChange={(e) => setFilters({ ...filters, accountId: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="ALL">All</option>
              <option value="DEBIT">Debit Only</option>
              <option value="CREDIT">Credit Only</option>
            </select>
          </div>
        </div>
        <div>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : !data || data.rows.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No ledger entries found</div>
      ) : (
        <>
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
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Debit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.rows.map((row) => (
                  <tr key={row.lineId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(row.voucherDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/dashboard/vouchers/${row.voucherId}`}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        {row.voucherNo}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{row.accountCode} - {row.accountName}</div>
                      <div className="text-xs text-gray-500">{row.accountType}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {row.description || row.voucherNarration || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.vendorName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.category.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                    Totals:
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(data.totals.totalDebit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(data.totals.totalCredit)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                    Net:
                  </td>
                  <td colSpan={2} className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    {formatCurrency(data.totals.net)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
