'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LaborSummaryData {
  workersToday: number;
  dailyCost: number;
  monthlyCost: number;
  contractCost: number;
  totalLaborCost: number;
  pendingWages: number;
}

interface ProjectLaborSummaryProps {
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

export default function ProjectLaborSummary({ projectId }: ProjectLaborSummaryProps) {
  const [data, setData] = useState<LaborSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${projectId}/labor-summary`);
        const json = await res.json();
        if (cancelled) return;
        if (json.ok && json.data) {
          setData(json.data);
          setError(null);
        } else {
          setError(json.error ?? 'Failed to load labor summary');
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
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Labor & Workforce Summary</h2>
        <div className="text-center py-6 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Labor & Workforce Summary</h2>
        <div className="text-center py-6 text-red-600">{error ?? 'No data'}</div>
      </div>
    );
  }

  const { workersToday, dailyCost, monthlyCost, contractCost, totalLaborCost, pendingWages } = data;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 h-full flex flex-col">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Labor & Workforce Summary</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-sm font-medium text-slate-600 mb-1">Workers today</p>
          <p className="text-xl font-bold text-slate-800">{workersToday}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <p className="text-sm font-medium text-orange-700 mb-1">Day labor</p>
          <p className="text-xl font-bold text-orange-800">{formatCurrency(dailyCost)}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm font-medium text-blue-700 mb-1">Monthly</p>
          <p className="text-xl font-bold text-blue-800">{formatCurrency(monthlyCost)}</p>
        </div>
        <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
          <p className="text-sm font-medium text-teal-700 mb-1">Contract</p>
          <p className="text-xl font-bold text-teal-800">{formatCurrency(contractCost)}</p>
        </div>
        <div className="bg-gray-100 rounded-lg p-4 border border-gray-300 sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-medium text-gray-700 mb-1">Total labor</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalLaborCost)}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <p className="text-sm font-medium text-amber-700 mb-1">Pending wages</p>
          <p className="text-xl font-bold text-amber-800">{formatCurrency(pendingWages)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-auto">
        <Link
          href={`/dashboard/projects/${projectId}/labor/day`}
          className="inline-flex items-center gap-2 py-2 px-4 border border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100"
        >
          Day Labor
        </Link>
        <Link
          href={`/dashboard/projects/${projectId}/labor/monthly`}
          className="inline-flex items-center gap-2 py-2 px-4 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
        >
          Monthly
        </Link>
        <Link
          href={`/dashboard/projects/${projectId}/labor/contract`}
          className="inline-flex items-center gap-2 py-2 px-4 border border-teal-300 rounded-md shadow-sm text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100"
        >
          Contract Workers
        </Link>
      </div>
      <p className="text-xs text-gray-500 mt-2">View by labor type</p>
    </div>
  );
}
