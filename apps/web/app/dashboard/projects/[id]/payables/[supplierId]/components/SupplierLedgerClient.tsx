'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface Invoice {
  purchaseId: string;
  date: string;
  challanNo: string | null;
  reference: string | null;
  total: number;
  paid: number;
  due: number;
  ageDays: number;
  link: string;
}

interface LedgerData {
  supplier: { id: string; name: string };
  summary: { totalBilled: number; totalPaid: number; totalDue: number };
  invoices: Invoice[];
}

interface SupplierLedgerClientProps {
  projectId: string;
  projectName: string;
  supplierId: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export default function SupplierLedgerClient({
  projectId,
  projectName,
  supplierId,
}: SupplierLedgerClientProps) {
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'due'>('all');
  const [sortNewestFirst, setSortNewestFirst] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/projects/${projectId}/payables/${supplierId}`
        );
        const json = await res.json();
        if (cancelled) return;
        if (json.ok && json.data) {
          setData(json.data);
          setError(null);
        } else {
          setError(json.error ?? 'Failed to load ledger');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, supplierId]);

  const filteredAndSortedInvoices = useMemo(() => {
    if (!data) return [];
    let list = data.invoices;
    if (filter === 'due') {
      list = list.filter((inv) => inv.due > 0);
    }
    return [...list].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortNewestFirst ? dateB - dateA : dateA - dateB;
    });
  }, [data, filter, sortNewestFirst]);

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading supplier ledger…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-red-600">{error ?? 'No data'}</div>
    );
  }

  const { supplier, summary } = data;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Project: <span className="font-medium text-gray-700">{projectName}</span>
        {' · '}
        Supplier: <span className="font-medium text-gray-700">{supplier.name}</span>
      </p>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-sm font-medium text-slate-600 mb-1">Billed</p>
          <p className="text-xl font-bold text-slate-800">
            {formatCurrency(summary.totalBilled)}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm font-medium text-green-700 mb-1">Paid</p>
          <p className="text-xl font-bold text-green-800">
            {formatCurrency(summary.totalPaid)}
          </p>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <p className="text-sm font-medium text-amber-700 mb-1">Due</p>
          <p className="text-xl font-bold text-amber-800">
            {formatCurrency(summary.totalDue)}
          </p>
        </div>
      </div>

      {/* Filters and sort */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Show:</span>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              filter === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('due')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              filter === 'due'
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Due only
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort:</span>
          <button
            type="button"
            onClick={() => setSortNewestFirst(false)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              !sortNewestFirst
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Oldest first
          </button>
          <button
            type="button"
            onClick={() => setSortNewestFirst(true)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              sortNewestFirst
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Newest first
          </button>
        </div>
      </div>

      {/* Invoices table */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Invoices</h2>
        </div>
        {filteredAndSortedInvoices.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            {filter === 'due'
              ? 'No invoices with due amount'
              : 'No invoices'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Challan / Ref
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Paid
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Due
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Age (days)
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Link
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedInvoices.map((inv) => (
                  <tr key={inv.purchaseId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                      {formatDate(inv.date)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {inv.challanNo ?? inv.reference ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-700">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-green-600">
                      {formatCurrency(inv.paid)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-amber-600 font-medium">
                      {formatCurrency(inv.due)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {inv.ageDays}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      <Link
                        href={inv.link}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
