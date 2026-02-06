'use client';

import { useState, useEffect } from 'react';

interface ProgressVsCostData {
  progressPercent: number;
  costUsedPercent: number;
}

interface ProjectProgressVsCostProps {
  projectId: string;
}

/** Show warning when budget used % exceeds progress % by this many points */
const COST_AHEAD_WARNING_THRESHOLD = 15;

export default function ProjectProgressVsCost({ projectId }: ProjectProgressVsCostProps) {
  const [data, setData] = useState<ProgressVsCostData | null>(null);
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
          setData({
            progressPercent: json.data.progressPercent ?? 0,
            costUsedPercent: json.data.costUsedPercent ?? 0,
          });
          setError(null);
        } else {
          setError(json.error ?? 'Failed to load');
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
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Progress vs Cost</h2>
        <div className="text-center py-6 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Progress vs Cost</h2>
        <div className="text-center py-6 text-red-600">{error ?? 'No data'}</div>
      </div>
    );
  }

  const { progressPercent, costUsedPercent } = data;
  const costAheadBy = costUsedPercent - progressPercent;
  const showWarning = costAheadBy >= COST_AHEAD_WARNING_THRESHOLD;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Progress vs Cost</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm font-medium text-blue-700 mb-1">Progress % (manual)</p>
          <p className="text-2xl font-bold text-blue-800">{progressPercent}%</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-sm font-medium text-slate-600 mb-1">Budget used %</p>
          <p className="text-2xl font-bold text-slate-800">{costUsedPercent.toFixed(1)}%</p>
        </div>
      </div>

      {showWarning && (
        <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-amber-50 border border-amber-200">
          <span className="text-amber-600" aria-hidden>⚠</span>
          <span className="text-sm font-medium text-amber-800">
            Cost is ahead of progress: budget used ({costUsedPercent.toFixed(1)}%) is more than {COST_AHEAD_WARNING_THRESHOLD} points above progress ({progressPercent}%).
          </span>
        </div>
      )}
    </div>
  );
}
