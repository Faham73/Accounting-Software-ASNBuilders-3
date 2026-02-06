'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface LedgerEntry {
  laborId: string;
  date: string;
  type: string;
  amount: number;
  paid: number;
  due: number;
  note: string | null;
  link: string;
}

interface LedgerData {
  workerKey: string;
  workerLabel: string;
  summary: { totalAmount: number; totalPaid: number; totalDue: number };
  entries: LedgerEntry[];
}

interface WorkerLedgerClientProps {
  projectId: string;
  projectName: string;
  workerKeyEncoded: string;
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

export default function WorkerLedgerClient({
  projectId,
  projectName,
  workerKeyEncoded,
}: WorkerLedgerClientProps) {
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDueOnly, setFilterDueOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/projects/${projectId}/worker-payables/${encodeURIComponent(workerKeyEncoded)}`
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
  }, [projectId, workerKeyEncoded]);

  const filteredEntries = useMemo(() => {
    if (!data) return [];
    if (!filterDueOnly) return data.entries;
    return data.entries.filter((e) => e.due > 0);
  }, [data, filterDueOnly]);

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading worker ledger…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-red-600">{error ?? 'No data'}</div>
    );
  }

  const { workerLabel, summary } = data;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Project: <span className="font-medium text-gray-700">{projectName}</span>
        {' · '}
        Worker: <span className="font-medium text-gray-700">{workerLabel}</span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-sm font-medium text-slate-600 mb-1">Total Amount</p>
          <p className="text-xl font-bold text-slate-800">
            {formatCurrency(summary.totalAmount)}
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

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <span className="text-sm text-gray-600">Show:</span>
        <button
          type="button"
          onClick={() => setFilterDueOnly(false)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium ${
            !filterDueOnly
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilterDueOnly(true)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium ${
            filterDueOnly
              ? 'bg-amber-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Due only
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Labor entries</h2>
        </div>
        {filteredEntries.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            {filterDueOnly ? 'No entries with due amount' : 'No entries'}
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
                    Type
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Paid
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Due
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Note
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Link
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEntries.map((e) => (
                  <tr key={e.laborId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                      {formatDate(e.date)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {e.type === 'DAY' ? 'Day' : 'Monthly'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-700">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-green-600">
                      {formatCurrency(e.paid)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-amber-600 font-medium">
                      {formatCurrency(e.due)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">
                      {e.note ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      <Link
                        href={e.link}
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
