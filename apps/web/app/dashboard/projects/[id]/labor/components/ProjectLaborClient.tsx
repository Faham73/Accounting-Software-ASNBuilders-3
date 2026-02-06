'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type LaborType = 'DAY' | 'MONTHLY' | 'CONTRACT';

interface LaborEntry {
  id: string;
  type: string;
  date: string;
  amount: { toNumber?: () => number };
  note: string | null;
  workerName: string | null;
  employeeName: string | null;
  month: number | null;
  year: number | null;
  teamLeader: string | null;
  paid: { toNumber?: () => number } | null;
  due: { toNumber?: () => number } | null;
  rating: number | null;
  createdBy?: { name: string | null };
}

interface ProjectLaborClientProps {
  projectId: string;
  projectName: string;
  laborType: LaborType;
}

export default function ProjectLaborClient({
  projectId,
  projectName,
  laborType,
}: ProjectLaborClientProps) {
  const [labors, setLabors] = useState<LaborEntry[]>([]);
  const [totals, setTotals] = useState<{ total: number }>({ total: 0 });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    note: '',
    workerName: '',
    employeeName: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    teamLeader: '',
    paid: '0',
    rating: '' as string | number,
  });

  const loadLabors = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: laborType,
        page: String(page),
        pageSize: String(pagination.pageSize),
      });
      const response = await fetch(`/api/projects/${projectId}/labors?${params}`);
      const data = await response.json();
      if (data.ok) {
        setLabors(data.data);
        setTotals(data.totals || { total: 0 });
        setPagination((prev) => ({
          ...prev,
          page: data.pagination?.page ?? page,
          total: data.pagination?.total ?? 0,
          totalPages: data.pagination?.totalPages ?? 0,
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLabors(pagination.page);
  }, [projectId, laborType]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const amountNum = (entry: LaborEntry) =>
    typeof entry.amount === 'object' && entry.amount?.toNumber
      ? entry.amount.toNumber()
      : Number(entry.amount);

  const decimalNum = (val: { toNumber?: () => number } | null | undefined): number =>
    val == null ? 0 : typeof val === 'object' && val.toNumber ? val.toNumber() : Number(val);

  const computedDue = (amount: number, paid: number) => Math.max(0, amount - paid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      type: laborType,
      date: formData.date,
      amount: parseFloat(formData.amount),
      note: formData.note || null,
    };
    if (laborType === 'DAY') {
      payload.workerName = formData.workerName || null;
      payload.teamLeader = formData.teamLeader || null;
      payload.paid = parseFloat(formData.paid) || 0;
      payload.rating = formData.rating === '' || formData.rating === undefined ? null : Number(formData.rating);
    } else if (laborType === 'CONTRACT') {
      payload.workerName = formData.workerName?.trim() || null;
      payload.paid = parseFloat(formData.paid) || 0;
    } else {
      payload.employeeName = formData.employeeName || null;
      payload.month = formData.month;
      payload.year = formData.year;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/labors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.ok) {
        setShowForm(false);
        setFormData({
          date: new Date().toISOString().split('T')[0],
          amount: '',
          note: '',
          workerName: '',
          employeeName: '',
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          teamLeader: '',
          paid: '0',
          rating: '',
        });
        loadLabors(pagination.page);
      } else {
        alert(result.error || 'Failed to create labor entry');
      }
    } catch (err) {
      alert('Failed to create labor entry');
    }
  };

  const openEdit = (entry: LaborEntry) => {
    setEditingId(entry.id);
    setFormData({
      date: new Date(entry.date).toISOString().split('T')[0],
      amount: String(amountNum(entry)),
      note: entry.note ?? '',
      workerName: entry.workerName ?? '',
      employeeName: entry.employeeName ?? '',
      month: entry.month ?? new Date().getMonth() + 1,
      year: entry.year ?? new Date().getFullYear(),
      teamLeader: entry.teamLeader ?? '',
      paid: String(decimalNum(entry.paid)),
      rating: entry.rating ?? '',
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const payload: Record<string, unknown> = {
      date: formData.date,
      amount: parseFloat(formData.amount),
      note: formData.note || null,
    };
    if (laborType === 'DAY') {
      payload.workerName = formData.workerName || null;
      payload.teamLeader = formData.teamLeader || null;
      payload.paid = parseFloat(formData.paid) || 0;
      payload.rating = formData.rating === '' || formData.rating === undefined ? null : Number(formData.rating);
    } else if (laborType === 'CONTRACT') {
      payload.workerName = formData.workerName?.trim() || null;
      payload.paid = parseFloat(formData.paid) || 0;
    } else {
      payload.employeeName = formData.employeeName || null;
      payload.month = formData.month;
      payload.year = formData.year;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/labors/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result.ok) {
        setEditingId(null);
        setFormData({
          date: new Date().toISOString().split('T')[0],
          amount: '',
          note: '',
          workerName: '',
          employeeName: '',
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          teamLeader: '',
          paid: '0',
          rating: '',
        });
        loadLabors(pagination.page);
      } else {
        alert(result.error || 'Failed to update labor entry');
      }
    } catch (err) {
      alert('Failed to update labor entry');
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {laborType === 'DAY'
            ? 'Day labor'
            : laborType === 'CONTRACT'
              ? 'Contract worker'
              : 'Monthly employee'}{' '}
          entries for this project. Total: {formatCurrency(totals.total)}
        </p>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setFormData({
              date: new Date().toISOString().split('T')[0],
              amount: '',
              note: '',
              workerName: '',
              employeeName: '',
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
              teamLeader: '',
              paid: '0',
              rating: '',
            });
            setShowForm(true);
          }}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
        >
          {laborType === 'CONTRACT' ? '+ Add Contract Worker' : 'Add entry'}
        </button>
      </div>

      {(showForm || editingId) && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-medium mb-3">
            {editingId ? 'Edit' : 'Add'}{' '}
            {laborType === 'DAY'
              ? 'Day Labor'
              : laborType === 'CONTRACT'
                ? 'Contract Worker'
                : 'Monthly Employee'}
          </h3>
          <form onSubmit={editingId ? handleEditSubmit : handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((d) => ({ ...d, date: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (৳)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData((d) => ({ ...d, amount: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            {laborType === 'DAY' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Worker name (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.workerName}
                    onChange={(e) => setFormData((d) => ({ ...d, workerName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team Leader (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.teamLeader}
                    onChange={(e) => setFormData((d) => ({ ...d, teamLeader: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paid (৳)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.paid}
                      onChange={(e) => setFormData((d) => ({ ...d, paid: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due (৳) — computed</label>
                    <input
                      type="text"
                      readOnly
                      value={formatCurrency(
                        computedDue(parseFloat(formData.amount) || 0, parseFloat(formData.paid) || 0)
                      )}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-gray-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rating (optional, 1–5)</label>
                  <select
                    value={formData.rating === '' || formData.rating === undefined ? '' : String(formData.rating)}
                    onChange={(e) =>
                      setFormData((d) => ({
                        ...d,
                        rating: e.target.value === '' ? '' : parseInt(e.target.value, 10),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {laborType === 'CONTRACT' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Worker / Contractor name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.workerName}
                    onChange={(e) => setFormData((d) => ({ ...d, workerName: e.target.value }))}
                    required={laborType === 'CONTRACT'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Contractor or worker group name"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paid (৳)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.paid}
                      onChange={(e) => setFormData((d) => ({ ...d, paid: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due (৳) — computed</label>
                    <input
                      type="text"
                      readOnly
                      value={formatCurrency(
                        computedDue(parseFloat(formData.amount) || 0, parseFloat(formData.paid) || 0)
                      )}
                      className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-gray-700"
                    />
                  </div>
                </div>
              </>
            )}
            {laborType === 'MONTHLY' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee name (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.employeeName}
                    onChange={(e) => setFormData((d) => ({ ...d, employeeName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Month (1-12)</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={formData.month}
                      onChange={(e) => setFormData((d) => ({ ...d, month: parseInt(e.target.value, 10) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData((d) => ({ ...d, year: parseInt(e.target.value, 10) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData((d) => ({ ...d, note: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="py-2 px-4 bg-orange-600 text-white rounded-md hover:bg-orange-700"
              >
                {editingId ? 'Update' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setShowForm(false);
                }}
                className="py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : labors.length === 0 ? (
        <p className="text-gray-500">No entries yet. Add one above.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                {laborType === 'DAY' && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Worker</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team Leader</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                  </>
                )}
                {laborType === 'CONTRACT' && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Worker / Contractor
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                  </>
                )}
                {laborType === 'MONTHLY' && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month/Year</th>
                  </>
                )}
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {labors.map((entry) => {
                const amt = amountNum(entry);
                const paid = decimalNum(entry.paid);
                const due = entry.due != null ? decimalNum(entry.due) : computedDue(amt, paid);
                return (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium text-orange-600">
                      {formatCurrency(amt)}
                    </td>
                    {laborType === 'DAY' && (
                      <>
                        <td className="px-4 py-2 text-sm text-gray-600">{entry.workerName ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{entry.teamLeader ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{formatCurrency(paid)}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{formatCurrency(due)}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {entry.rating != null ? entry.rating : '—'}
                        </td>
                      </>
                    )}
                    {laborType === 'CONTRACT' && (
                      <>
                        <td className="px-4 py-2 text-sm text-gray-600">{entry.workerName ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{formatCurrency(paid)}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{formatCurrency(due)}</td>
                      </>
                    )}
                    {laborType === 'MONTHLY' && (
                      <>
                        <td className="px-4 py-2 text-sm text-gray-600">{entry.employeeName ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {entry.month != null && entry.year != null
                            ? `${entry.month}/${entry.year}`
                            : '—'}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-2 text-sm text-gray-500">{entry.note ?? '—'}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => openEdit(entry)}
                        className="text-orange-600 hover:text-orange-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex gap-2 items-center">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => loadLabors(pagination.page - 1)}
            className="py-1 px-3 border border-gray-300 rounded text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => loadLabors(pagination.page + 1)}
            className="py-1 px-3 border border-gray-300 rounded text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
