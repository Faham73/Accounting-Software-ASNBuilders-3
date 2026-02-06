'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type ActivityType = 'purchase' | 'stock_in' | 'stock_out' | 'labor' | 'debit' | 'credit';

interface ActivityItem {
  date: string;
  type: ActivityType;
  title: string;
  amount: number | null;
  link: string;
}

interface ProjectRecentActivityProps {
  projectId: string;
}

const TYPE_ICONS: Record<ActivityType, string> = {
  purchase: '📦',
  stock_in: '📥',
  stock_out: '📤',
  labor: '👷',
  debit: '📉',
  credit: '📈',
};

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProjectRecentActivity({ projectId }: ProjectRecentActivityProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${projectId}/recent-activity`);
        const json = await res.json();
        if (cancelled) return;
        if (json.ok && json.data) {
          setItems(json.data);
          setError(null);
        } else {
          setError(json.error ?? 'Failed to load activity');
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
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
        <div className="text-center py-6 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
        <div className="text-center py-6 text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">No recent activity</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li key={`${item.type}-${item.date}-${index}`}>
              <Link
                href={item.link}
                className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-100"
              >
                <span className="text-xl flex-shrink-0" aria-hidden>
                  {TYPE_ICONS[item.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                  <p className="text-xs text-gray-500">{formatDate(item.date)}</p>
                </div>
                {item.amount != null && item.amount !== 0 && (
                  <span className="text-sm font-medium text-gray-700 flex-shrink-0">
                    {formatCurrency(item.amount)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
