'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LastPurchaseItem {
  id: string;
  date: string;
  challanNo: string | null;
  total: number;
  paidAmount: number;
  dueAmount: number;
  vendorName: string;
}

interface PurchasesOverviewData {
  pendingBills: number;
  advancePaid: number;
  lastPurchases: LastPurchaseItem[];
}

interface SupplierPayablesAging {
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
}

interface SupplierPayablesItem {
  supplierId: string;
  supplierName: string;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  aging: SupplierPayablesAging;
  lastInvoiceDate: string | null;
}

interface SupplierPayablesData {
  totals: { totalDue: number; totalPaid: number; supplierCountWithDue: number };
  suppliers: SupplierPayablesItem[];
}

interface ProjectPurchasesPayablesProps {
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

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export default function ProjectPurchasesPayables({ projectId }: ProjectPurchasesPayablesProps) {
  const [data, setData] = useState<PurchasesOverviewData | null>(null);
  const [supplierPayables, setSupplierPayables] = useState<SupplierPayablesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${projectId}/purchases-overview`);
        const json = await res.json();
        if (cancelled) return;
        if (json.ok && json.data) {
          setData(json.data);
          setError(null);
        } else {
          setError(json.error ?? 'Failed to load purchases overview');
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

  useEffect(() => {
    let cancelled = false;
    async function loadPayables() {
      try {
        const res = await fetch(`/api/projects/${projectId}/supplier-payables`);
        const json = await res.json();
        if (cancelled) return;
        if (json.ok && json.data) setSupplierPayables(json.data);
      } catch {
        if (!cancelled) setSupplierPayables(null);
      }
    }
    loadPayables();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Purchases & Payables</h2>
        <div className="text-center py-6 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Purchases & Payables</h2>
        <div className="text-center py-6 text-red-600">{error ?? 'No data'}</div>
      </div>
    );
  }

  const { pendingBills, advancePaid, lastPurchases } = data;
  const addPurchaseUrl = `/dashboard/purchases/new?projectId=${projectId}&returnTo=/dashboard/projects/${projectId}/purchases`;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Purchases & Payables</h2>
        <Link
          href={addPurchaseUrl}
          className="inline-flex items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          + Add Purchase
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
          <p className="text-sm font-medium text-amber-700 mb-1">Pending Bills</p>
          <p className="text-xl font-bold text-amber-800">{formatCurrency(pendingBills)}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-sm font-medium text-slate-600 mb-1">Advance Paid</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(advancePaid)}</p>
        </div>
      </div>

      {/* Last 5 purchases table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Last 5 purchases</h3>
        {lastPurchases.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No purchases yet</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Challan</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Due</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lastPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{p.vendorName}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{p.challanNo ?? '—'}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-700">{formatCurrency(p.total)}</td>
                    <td className="px-4 py-2 text-sm text-right text-green-600">{formatCurrency(p.paidAmount)}</td>
                    <td className="px-4 py-2 text-sm text-right text-amber-600">{formatCurrency(p.dueAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2">
          <Link
            href={`/dashboard/projects/${projectId}/purchases`}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View all purchases →
          </Link>
        </p>
      </div>

      {/* Supplier Payables Summary */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Supplier Payables</h3>
          <Link
            href={`/dashboard/projects/${projectId}/payables`}
            className="inline-flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            View Supplier Ledger
          </Link>
        </div>
        {supplierPayables ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <p className="text-sm font-medium text-amber-700 mb-1">Total Due</p>
                <p className="text-xl font-bold text-amber-800">
                  {formatCurrency(supplierPayables.totals.totalDue)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-sm font-medium text-slate-600 mb-1">Suppliers with Due</p>
                <p className="text-xl font-bold text-slate-800">
                  {supplierPayables.totals.supplierCountWithDue}
                </p>
              </div>
            </div>
            {supplierPayables.suppliers.length > 0 ? (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Supplier
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Due
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        0–30 days
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        90+ days
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {supplierPayables.suppliers.slice(0, 5).map((s) => (
                      <tr key={s.supplierId} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-700">{s.supplierName}</td>
                        <td className="px-4 py-2 text-sm text-right text-amber-600 font-medium">
                          {formatCurrency(s.totalDue)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-600">
                          {formatCurrency(s.aging.d0_30)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-600">
                          {formatCurrency(s.aging.d90_plus)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4">No supplier payables</p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500 py-4">Loading supplier payables…</p>
        )}
      </div>
    </div>
  );
}
