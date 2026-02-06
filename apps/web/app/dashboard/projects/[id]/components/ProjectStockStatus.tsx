'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LowStockItem {
  stockItemId: string;
  stockItemName: string;
  stockItemUnit: string;
  currentQty: number;
  threshold: number;
}

interface StockStatusData {
  receivedTotal: number;
  usedTotal: number;
  currentBalance: number;
  lowStockItems: LowStockItem[];
}

interface ProjectStockStatusProps {
  projectId: string;
}

function formatQty(qty: number): string {
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(qty);
}

export default function ProjectStockStatus({ projectId }: ProjectStockStatusProps) {
  const [data, setData] = useState<StockStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${projectId}/stock-status`);
        const json = await res.json();
        if (cancelled) return;
        if (json.ok && json.data) {
          setData(json.data);
          setError(null);
        } else {
          setError(json.error ?? 'Failed to load stock status');
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
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Stock & Material Status</h2>
        <div className="text-center py-6 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Stock & Material Status</h2>
        <div className="text-center py-6 text-red-600">{error ?? 'No data'}</div>
      </div>
    );
  }

  const { receivedTotal, usedTotal, currentBalance, lowStockItems } = data;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Stock & Material Status</h2>

      {/* Three mini cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm font-medium text-green-700 mb-1">Received</p>
          <p className="text-xl font-bold text-green-800">{formatQty(receivedTotal)}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <p className="text-sm font-medium text-amber-700 mb-1">Used</p>
          <p className="text-xl font-bold text-amber-800">{formatQty(usedTotal)}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm font-medium text-blue-700 mb-1">Current balance</p>
          <p className="text-xl font-bold text-blue-800">{formatQty(currentBalance)}</p>
        </div>
      </div>

      {/* Low stock list */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Low stock</h3>
        {lowStockItems.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No low stock items</p>
        ) : (
          <ul className="space-y-2">
            {lowStockItems.map((item) => (
              <li
                key={item.stockItemId}
                className="flex items-center gap-2 py-2 px-3 rounded-md bg-amber-50 border border-amber-100"
              >
                <span className="text-amber-600" title="Low stock" aria-hidden>
                  ⚠
                </span>
                <span className="font-medium text-gray-800">{item.stockItemName}</span>
                <span className="text-sm text-gray-600">
                  {formatQty(item.currentQty)} {item.stockItemUnit}
                  {item.threshold > 0 && (
                    <span className="text-amber-700"> (min {formatQty(item.threshold)})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3">
          <Link
            href={`/dashboard/projects/${projectId}/stock`}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View stock →
          </Link>
        </p>
      </div>
    </div>
  );
}
