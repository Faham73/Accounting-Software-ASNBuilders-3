'use client';

import { useState, useEffect } from 'react';

interface ProjectFinancialSnapshotBreakdown {
  materialsCost: number;
  laborCost: number;
  otherExpenses: number;
  consultantCost: number;
  machineryCost: number;
}

interface ProjectFinancialSnapshotData {
  budgetTotal: number | null;
  spent: number;
  remaining: number | null;
  overBudget: boolean;
  breakdown: ProjectFinancialSnapshotBreakdown;
}

interface ProjectFinancialSnapshotProps {
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

export default function ProjectFinancialSnapshot({ projectId }: ProjectFinancialSnapshotProps) {
  const [data, setData] = useState<ProjectFinancialSnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${projectId}/financial-snapshot`);
        const json = await res.json();
        if (cancelled) return;
        if (json.ok && json.data) {
          setData(json.data);
          setError(null);
        } else {
          setError(json.error ?? 'Failed to load financial snapshot');
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
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Financial Snapshot</h2>
        <div className="text-center py-6 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Financial Snapshot</h2>
        <div className="text-center py-6 text-red-600">{error ?? 'No data'}</div>
      </div>
    );
  }

  const { budgetTotal, spent, remaining, overBudget, breakdown } = data;
  const hasConsultantOrMachinery = (breakdown.consultantCost ?? 0) > 0 || (breakdown.machineryCost ?? 0) > 0;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Financial Snapshot</h2>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-sm font-medium text-slate-600 mb-1">Budget</p>
          <p className="text-xl font-bold text-slate-800">
            {budgetTotal !== null ? formatCurrency(budgetTotal) : 'Not set'}
          </p>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <p className="text-sm font-medium text-amber-700 mb-1">Spent</p>
          <p className="text-xl font-bold text-amber-800">{formatCurrency(spent)}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm font-medium text-blue-700 mb-1">Remaining</p>
          {budgetTotal !== null ? (
            <p className="text-xl font-bold text-blue-800">{formatCurrency(remaining ?? 0)}</p>
          ) : (
            <>
              <p className="text-xl font-bold text-gray-500">—</p>
              <p className="text-xs text-gray-500 mt-1">Set a budget to track remaining</p>
            </>
          )}
        </div>
        <div className="rounded-lg p-4 border flex items-center justify-center">
          {budgetTotal !== null && (
            <span
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                overBudget ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}
            >
              {overBudget ? 'Over budget' : 'On track'}
            </span>
          )}
        </div>
      </div>

      {/* Expense breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Expense breakdown</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100">
            <p className="text-xs font-medium text-blue-700 mb-0.5">Materials</p>
            <p className="text-base font-semibold text-blue-900">
              {formatCurrency(breakdown.materialsCost)}
            </p>
          </div>
          <div className="bg-orange-50/50 rounded-lg p-3 border border-orange-100">
            <p className="text-xs font-medium text-orange-700 mb-0.5">Labor</p>
            <p className="text-base font-semibold text-orange-900">
              {formatCurrency(breakdown.laborCost)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-xs font-medium text-gray-600 mb-0.5">Other</p>
            <p className="text-base font-semibold text-gray-800">
              {formatCurrency(breakdown.otherExpenses)}
            </p>
          </div>
          {hasConsultantOrMachinery && (
            <>
              {(breakdown.consultantCost ?? 0) > 0 && (
                <div className="bg-purple-50/50 rounded-lg p-3 border border-purple-100">
                  <p className="text-xs font-medium text-purple-700 mb-0.5">Consultant</p>
                  <p className="text-base font-semibold text-purple-900">
                    {formatCurrency(breakdown.consultantCost)}
                  </p>
                </div>
              )}
              {(breakdown.machineryCost ?? 0) > 0 && (
                <div className="bg-teal-50/50 rounded-lg p-3 border border-teal-100">
                  <p className="text-xs font-medium text-teal-700 mb-0.5">Machinery</p>
                  <p className="text-base font-semibold text-teal-900">
                    {formatCurrency(breakdown.machineryCost)}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
