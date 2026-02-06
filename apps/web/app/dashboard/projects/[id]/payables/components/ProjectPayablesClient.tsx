'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Aging {
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
}

interface SupplierItem {
  supplierId: string;
  supplierName: string;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  aging: Aging;
  lastInvoiceDate: string | null;
}

interface PayablesData {
  totals: { totalDue: number; totalPaid: number; supplierCountWithDue: number };
  suppliers: SupplierItem[];
}

interface ProjectPayablesClientProps {
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

export default function ProjectPayablesClient({
  projectId,
  projectName,
}: ProjectPayablesClientProps) {
  const [data, setData] = useState<PayablesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${projectId}/supplier-payables`);
        const json = await res.json();
        if (cancelled) return;
        if (json.ok && json.data) {
          setData(json.data);
          setError(null);
        } else {
          setError(json.error ?? 'Failed to load supplier payables');
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
      <div className="text-center py-8 text-gray-500">Loading supplier payables…</div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-red-600">{error ?? 'No data'}</div>
    );
  }

  const { totals, suppliers } = data;

  return (
    <div>
      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <p className="text-sm font-medium text-amber-700 mb-1">Total Due</p>
          <p className="text-xl font-bold text-amber-800">{formatCurrency(totals.totalDue)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm font-medium text-green-700 mb-1">Total Paid</p>
          <p className="text-xl font-bold text-green-800">{formatCurrency(totals.totalPaid)}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-sm font-medium text-slate-600 mb-1">Suppliers with Due</p>
          <p className="text-xl font-bold text-slate-800">{totals.supplierCountWithDue}</p>
        </div>
      </div>

      {/* Supplier table */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Suppliers</h2>
        </div>
        {suppliers.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">No supplier payables</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Supplier
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Billed
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Paid
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Due
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    0–30
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    31–60
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    61–90
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    90+
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suppliers.map((s) => (
                  <tr key={s.supplierId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {s.supplierName}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-700">
                      {formatCurrency(s.totalBilled)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-green-600">
                      {formatCurrency(s.totalPaid)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-amber-600 font-medium">
                      {formatCurrency(s.totalDue)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatCurrency(s.aging.d0_30)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatCurrency(s.aging.d31_60)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatCurrency(s.aging.d61_90)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">
                      {formatCurrency(s.aging.d90_plus)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      <Link
                        href={`/dashboard/projects/${projectId}/payables/${s.supplierId}`}
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
