'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface CompanySummary {
  companyName: string;
  range: { dateFrom: string | null; dateTo: string | null };
  kpis: {
    projects: { total: number; running: number; completed: number; onHold: number };
  };
  totals: {
    purchases: number;
    stockValue: number;
    investments: number;
    labor: number;
    debit: number;
    credit: number;
  };
  health: {
    netPosition: number;
    cashBalance: number;
    bankBalance: number;
    payables: number;
    receivables: number;
  };
  projectOverview: Array<{
    projectId: string;
    name: string;
    status: string;
    purchases: number;
    debit: number;
    credit: number;
    labor: number;
    netPosition: number;
  }>;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CompanyDashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<CompanySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateFromParam = searchParams.get('dateFrom') ?? '';
  const dateToParam = searchParams.get('dateTo') ?? '';

  const [dateFrom, setDateFrom] = useState(dateFromParam);
  const [dateTo, setDateTo] = useState(dateToParam);

  // Sync date inputs from API response when URL has no params (API uses last 30 days)
  useEffect(() => {
    if (data && !dateFromParam && !dateToParam && data.range.dateFrom && data.range.dateTo) {
      setDateFrom(data.range.dateFrom);
      setDateTo(data.range.dateTo);
    }
  }, [data, dateFromParam, dateToParam]);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/dashboard/company-summary?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to load summary');
      }
      if (json.ok && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error ?? 'Invalid response');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Sync date range from URL on mount/navigation
  useEffect(() => {
    const from = searchParams.get('dateFrom') ?? '';
    const to = searchParams.get('dateTo') ?? '';
    setDateFrom(from);
    setDateTo(to);
  }, [searchParams]);

  const handleDateFilter = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    router.push(`/dashboard?${params.toString()}`);
  };

  const handleRowClick = (projectId: string) => {
    router.push(`/dashboard/projects/${projectId}`);
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-10 w-36 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-36 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={fetchSummary}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { companyName, kpis, totals, health, projectOverview } = data;

  const cardLinks = [
    { label: 'Purchases', value: totals.purchases, href: '/dashboard/purchases', color: 'blue' },
    { label: 'Stocks', value: totals.stockValue, href: '/dashboard/stock', color: 'violet' },
    { label: 'Investments', value: totals.investments, href: '/dashboard/investments', color: 'purple' },
    { label: 'Labor', value: totals.labor, href: '/dashboard/projects', color: 'orange' }, // Labor is project-scoped; link to projects
    { label: 'Debit', value: totals.debit, href: '/dashboard/debit', color: 'amber' },
    { label: 'Credit', value: totals.credit, href: '/dashboard/credit', color: 'emerald' },
  ] as const;

  const healthTiles = [
    { label: 'Net Position', value: health.netPosition, positive: health.netPosition >= 0 },
    { label: 'Cash Balance', value: health.cashBalance, positive: true },
    { label: 'Bank Balance', value: health.bankBalance, positive: true },
    { label: 'Payables', value: health.payables, positive: false },
    { label: 'Receivables', value: health.receivables, positive: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header: Company name + Date range + KPIs */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-xl font-semibold text-gray-900">{companyName}</h2>
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-auto min-h-[40px] px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-auto min-h-[40px] px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              onClick={handleDateFilter}
              className="w-full sm:w-auto min-h-[40px] px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Apply
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            Total: {kpis.projects.total}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            Running: {kpis.projects.running}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            Completed: {kpis.projects.completed}
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
            On Hold: {kpis.projects.onHold}
          </span>
        </div>
      </div>

      {/* Financial Snapshot Cards (clickable) */}
      <div>
        <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-3 sm:mb-4">Financial Snapshot</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-6">
          {cardLinks.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="block p-4 sm:p-6 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            >
              <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">{card.label}</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{formatCurrency(card.value)}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Profit & Cash Health */}
      <div>
        <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-3 sm:mb-4">Profit & Cash Health</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6">
          {healthTiles.map((tile) => (
            <div
              key={tile.label}
              className={`p-4 sm:p-6 rounded-lg border ${
                tile.positive ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'
              }`}
            >
              <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1">{tile.label}</p>
              <p
                className={`text-lg sm:text-2xl font-bold ${
                  tile.label === 'Net Position'
                    ? tile.positive
                      ? 'text-green-700'
                      : 'text-red-700'
                    : 'text-gray-900'
                }`}
              >
                {formatCurrency(tile.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Project Overview Table */}
      <div>
        <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-3 sm:mb-4">Project Overview</h3>
        <div className="w-full overflow-x-auto -mx-3 sm:mx-0 rounded-lg border border-gray-200">
          <div className="min-w-[800px] px-3 sm:px-0">
          {projectOverview.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No projects found</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purchases
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Labor
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net Position
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projectOverview.map((row) => (
                  <tr
                    key={row.projectId}
                    onClick={() => handleRowClick(row.projectId)}
                    className="cursor-pointer hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">{row.name}</td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-gray-500">{formatStatus(row.status)}</td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-right text-gray-900">
                      {formatCurrency(row.purchases)}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-right text-gray-900">
                      {formatCurrency(row.debit)}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-right text-gray-900">
                      {formatCurrency(row.credit)}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-right text-gray-900">
                      {formatCurrency(row.labor)}
                    </td>
                    <td
                      className={`px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-right font-medium ${
                        row.netPosition >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {formatCurrency(row.netPosition)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
