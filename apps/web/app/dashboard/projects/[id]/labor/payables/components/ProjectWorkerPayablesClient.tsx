'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface Aging {
  d0_7: number;
  d8_15: number;
  d16_30: number;
  d31_plus: number;
}

interface WorkerItem {
  workerKey: string;
  workerLabel: string;
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
  aging: Aging;
  lastWorkDate: string | null;
}

interface PayablesData {
  totals: {
    totalLaborAmount: number;
    totalPaid: number;
    totalDue: number;
    workerCountWithDue: number;
  };
  workers: WorkerItem[];
}

interface ProjectWorkerPayablesClientProps {
  projectId: string;
  projectName: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProjectWorkerPayablesClient({
  projectId,
  projectName,
}: ProjectWorkerPayablesClientProps) {
  const [data, setData] = useState<PayablesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${projectId}/worker-payables`);
        const json = await res.json();
        if (cancelled) return;
        if (json.ok && json.data) {
          setData(json.data);
          setError(null);
        } else {
          setError(json.error ?? 'Failed to load worker payables');
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
  }, [projectId]);

  const filteredWorkers = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.workers;
    return data.workers.filter(
      (w) =>
        w.workerLabel.toLowerCase().includes(q)
    );
  }, [data, search]);

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading worker payables…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-red-600">{error ?? 'No data'}</div>
    );
  }

  const { totals, workers } = data;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-sm font-medium text-slate-600 mb-1">Total Labor</p>
          <p className="text-xl font-bold text-slate-800">
            {formatCurrency(totals.totalLaborAmount)}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm font-medium text-green-700 mb-1">Total Paid</p>
          <p className="text-xl font-bold text-green-800">
            {formatCurrency(totals.totalPaid)}
          </p>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <p className="text-sm font-medium text-amber-700 mb-1">Total Payable</p>
          <p className="text-xl font-bold text-amber-800">
            {formatCurrency(totals.totalDue)}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-sm font-medium text-slate-600 mb-1">Workers with Due</p>
          <p className="text-xl font-bold text-slate-800">
            {totals.workerCountWithDue}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Search worker
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name…"
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Workers</h2>
        </div>
        {filteredWorkers.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            {search.trim() ? 'No workers match the search' : 'No worker payables'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Worker
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
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    0–7
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    8–15
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    16–30
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    31+
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorkers.map((w) => (
                  <tr key={w.workerKey} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {w.workerLabel}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-700">
                      {formatCurrency(w.totalAmount)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-green-600">
                      {formatCurrency(w.totalPaid)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-amber-600 font-medium">
                      {formatCurrency(w.totalDue)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatCurrency(w.aging.d0_7)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatCurrency(w.aging.d8_15)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatCurrency(w.aging.d16_30)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatCurrency(w.aging.d31_plus)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      <Link
                        href={`/dashboard/projects/${projectId}/labor/payables/${encodeURIComponent(w.workerKey)}`}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        View Ledger
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
