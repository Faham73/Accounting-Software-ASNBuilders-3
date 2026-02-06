'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface WorkerPayablesAging {
  d0_7: number;
  d8_15: number;
  d16_30: number;
  d31_plus: number;
}

interface WorkerPayablesItem {
  workerKey: string;
  workerLabel: string;
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
  aging: WorkerPayablesAging;
  lastWorkDate: string | null;
}

interface WorkerPayablesData {
  totals: {
    totalLaborAmount: number;
    totalPaid: number;
    totalDue: number;
    workerCountWithDue: number;
  };
  workers: WorkerPayablesItem[];
}

interface ProjectWorkerPayablesProps {
  projectId: string;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProjectWorkerPayables({
  projectId,
}: ProjectWorkerPayablesProps) {
  const [data, setData] = useState<WorkerPayablesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Worker Payables</h2>
        <div className="text-center py-6 text-gray-500">Loading…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Worker Payables</h2>
        <div className="text-center py-6 text-red-600">{error ?? 'No data'}</div>
      </div>
    );
  }

  const { totals, workers } = data;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Worker Payables</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/projects/${projectId}/labor/payables`}
            className="inline-flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            View all worker payables
          </Link>
          <Link
            href={`/dashboard/projects/${projectId}/labor/day`}
            className="inline-flex items-center gap-2 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Add day labor
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
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

      {workers.length > 0 ? (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Worker
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {workers.slice(0, 5).map((w) => (
                <tr key={w.workerKey} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">
                    {w.workerLabel}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500 py-4">No worker payables</p>
      )}

      {workers.length > 0 && (
        <p className="mt-2">
          <Link
            href={`/dashboard/projects/${projectId}/labor/payables`}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View all worker payables →
          </Link>
        </p>
      )}
    </div>
  );
}
