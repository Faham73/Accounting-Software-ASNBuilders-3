'use client';

import { useState, useEffect } from 'react';

interface CategorySummary {
  key: string;
  name: string;
  amount: number;
}

interface CostSummaryResponse {
  project: { id: string; name: string };
  filtersApplied: Record<string, any>;
  summaryByCategory: CategorySummary[];
  grandTotals: {
    totalCost: number;
    allocatedOverhead?: number;
  };
}

interface FilterOption {
  id: string;
  name: string;
}

interface ProjectCostSummaryClientProps {
  projectId: string;
  projectName: string;
}

export default function ProjectCostSummaryClient({
  projectId,
  projectName,
}: ProjectCostSummaryClientProps) {
  const [data, setData] = useState<CostSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    vendorId: '',
    category: '',
    paymentMethodId: '',
    includeAllocatedOverhead: false,
  });

  // Filter options
  const [vendors, setVendors] = useState<FilterOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<FilterOption[]>([]);

  const fetchCostSummary = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.vendorId) params.append('vendorId', filters.vendorId);
      if (filters.category) params.append('category', filters.category);
      if (filters.paymentMethodId) params.append('paymentMethodId', filters.paymentMethodId);
      if (filters.includeAllocatedOverhead) params.append('includeAllocatedOverhead', 'true');

      const response = await fetch(`/api/projects/${projectId}/cost-summary?${params.toString()}`);
      const result = await response.json();

      if (result.ok) {
        setData(result.data);
      } else {
        console.error('Failed to fetch cost summary:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch cost summary:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch filter options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [vendorsRes, paymentMethodsRes] = await Promise.all([
          fetch('/api/vendors?active=true'),
          fetch('/api/payment-methods?active=true'),
        ]);

        if (vendorsRes.ok) {
          const vendorsData = await vendorsRes.json();
          setVendors(vendorsData.data || []);
        }
        if (paymentMethodsRes.ok) {
          const paymentMethodsData = await paymentMethodsRes.json();
          setPaymentMethods(paymentMethodsData.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch filter options:', error);
      }
    };

    fetchOptions();
  }, []);

  useEffect(() => {
    fetchCostSummary();
  }, [filters]);

  const handleResetFilters = () => {
    setFilters({
      from: '',
      to: '',
      vendorId: '',
      category: '',
      paymentMethodId: '',
      includeAllocatedOverhead: false,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleExportCSV = () => {
    if (!data) return;

    const csvRows = [
      ['Category', 'Amount'],
      ...data.summaryByCategory.map((cat) => [cat.name, cat.amount.toString()]),
      ['Grand Total', data.grandTotals.totalCost.toString()],
    ];

    const csvContent = csvRows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost-summary-${projectName}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header with date range */}
      <div className="mb-6">
        <div className="text-sm text-gray-600 mb-2">Project: {projectName}</div>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includeAllocatedOverhead}
                onChange={(e) => setFilters({ ...filters, includeAllocatedOverhead: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include allocated overhead</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            Reset Filters
          </button>
          {data && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Summary Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : !data ? (
        <div className="text-center py-8 text-gray-500">No cost summary data found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.summaryByCategory.map((category) => (
                <tr key={category.key}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {category.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(category.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100">
              {data.grandTotals.allocatedOverhead !== undefined && (
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    Allocated Overhead
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(data.grandTotals.allocatedOverhead)}
                  </td>
                </tr>
              )}
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  Grand Total
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                  {formatCurrency(data.grandTotals.totalCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
