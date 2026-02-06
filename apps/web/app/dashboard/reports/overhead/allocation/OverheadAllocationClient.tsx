'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toMoney } from '@/lib/payables';

interface Project {
  id: string;
  name: string;
  contractValue: any;
}

interface AllocationResult {
  id: string;
  projectId: string;
  project: { id: string; name: string };
  amount: any;
  percent?: number;
}

interface OverheadAllocationClientProps {
  initialOverhead: number;
  projects: Project[];
  allocationResults: {
    id: string;
    method: 'PERCENT' | 'CONTRACT_VALUE';
    allocations: any;
    results: AllocationResult[];
    createdBy: { name: string };
    createdAt: Date;
  } | null;
  selectedMonth: Date;
  canManage: boolean;
}

export default function OverheadAllocationClient({
  initialOverhead,
  projects,
  allocationResults,
  selectedMonth,
  canManage,
}: OverheadAllocationClientProps) {
  const router = useRouter();
  const [method, setMethod] = useState<'PERCENT' | 'CONTRACT_VALUE'>(
    allocationResults?.method || 'PERCENT'
  );
  const [percentages, setPercentages] = useState<Record<string, number>>(() => {
    if (allocationResults?.method === 'PERCENT' && allocationResults.allocations) {
      return allocationResults.allocations as Record<string, number>;
    }
    return {};
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [computedResults, setComputedResults] = useState<Array<{
    projectId: string;
    projectName: string;
    amount: number;
    percent?: number;
  }> | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const monthStr = selectedMonth.toISOString().split('T')[0].substring(0, 7);

  const handlePercentChange = (projectId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setPercentages((prev) => ({
      ...prev,
      [projectId]: numValue,
    }));
  };

  const handleCompute = async () => {
    setError(null);
    setWarnings([]);

    if (method === 'PERCENT') {
      const totalPercent = Object.values(percentages).reduce((sum, p) => sum + p, 0);
      if (Math.abs(totalPercent - 100) > 0.01) {
        setError(`Percentages sum to ${totalPercent.toFixed(2)}% instead of 100%`);
        return;
      }
    }

    try {
      const response = await fetch('/api/reports/overhead/compute-allocation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month: monthStr,
          method,
          allocations: method === 'PERCENT' ? percentages : undefined,
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        setError(data.error || 'Failed to compute allocation');
        return;
      }

      setComputedResults(data.data.results);
      setWarnings(data.data.warnings || []);
    } catch (err) {
      setError('An error occurred while computing allocation');
    }
  };

  const handleSave = async () => {
    if (!computedResults || computedResults.length === 0) {
      setError('Please compute allocation first');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/reports/overhead/save-allocation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month: monthStr,
          method,
          results: computedResults,
          totalOverhead: initialOverhead,
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        setError(data.error || 'Failed to save allocation');
        return;
      }

      router.push(`/dashboard/reports/overhead?month=${monthStr}`);
      router.refresh();
    } catch (err) {
      setError('An error occurred while saving allocation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPercent = Object.values(percentages).reduce((sum, p) => sum + p, 0);

  return (
    <div className="space-y-6">
      {!canManage && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">You don't have permission to manage allocations.</p>
        </div>
      )}

      {/* Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Monthly Overhead</h3>
        <p className="text-2xl font-semibold text-gray-900">{toMoney(initialOverhead)}</p>
        <p className="text-sm text-gray-500 mt-1">
          {new Date(selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {allocationResults && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">Existing Allocation</h3>
          <p className="text-sm text-blue-800">
            Method: {allocationResults.method === 'PERCENT' ? 'Percent' : 'Contract Value'}
          </p>
          <p className="text-sm text-blue-800">
            Created by: {allocationResults.createdBy.name} on{' '}
            {new Date(allocationResults.createdAt).toLocaleDateString()}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-900 mb-2">Warnings</h3>
          <ul className="list-disc list-inside text-sm text-yellow-800">
            {warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Allocation Method */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Allocation Method</h3>
        <div className="space-y-4">
          <div>
            <label className="flex items-center">
              <input
                type="radio"
                value="PERCENT"
                checked={method === 'PERCENT'}
                onChange={(e) => {
                  setMethod('PERCENT');
                  setComputedResults(null);
                }}
                disabled={!canManage}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Percent (Manual)</span>
            </label>
          </div>
          <div>
            <label className="flex items-center">
              <input
                type="radio"
                value="CONTRACT_VALUE"
                checked={method === 'CONTRACT_VALUE'}
                onChange={(e) => {
                  setMethod('CONTRACT_VALUE');
                  setComputedResults(null);
                }}
                disabled={!canManage}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Contract Value (Proportional)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Percent Method Input */}
      {method === 'PERCENT' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Allocation Percentages</h3>
            <p className="text-sm text-gray-500 mt-1">Total: {totalPercent.toFixed(2)}%</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Percent (%)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{project.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={percentages[project.id] || ''}
                        onChange={(e) => handlePercentChange(project.id, e.target.value)}
                        disabled={!canManage}
                        className="block w-24 ml-auto rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      {canManage && (
        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={handleCompute}
            disabled={method === 'PERCENT' && Math.abs(totalPercent - 100) > 0.01}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Compute Allocation
          </button>
          {computedResults && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Allocation'}
            </button>
          )}
        </div>
      )}

      {/* Computed Results */}
      {computedResults && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Computed Allocation</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  {method === 'PERCENT' && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Percent</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {computedResults.map((result) => (
                  <tr key={result.projectId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.projectName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {toMoney(result.amount)}
                    </td>
                    {method === 'PERCENT' && result.percent !== undefined && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                        {result.percent.toFixed(2)}%
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Total</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-gray-900">
                    {toMoney(computedResults.reduce((sum, r) => sum + r.amount, 0))}
                  </td>
                  {method === 'PERCENT' && <td></td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
