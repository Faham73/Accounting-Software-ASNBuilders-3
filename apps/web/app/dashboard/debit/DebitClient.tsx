'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface DebitLine {
  id: string;
  debit: number;
  description: string | null;
  workDetails: string | null;
  paidBy: string | null;
  receivedBy: string | null;
  fileRef: string | null;
  voucherRef: string | null;
  expenseCategoryId: string | null;
  voucher: {
    id: string;
    voucherNo: string;
    date: string;
    type: string | null;
    narration: string | null;
    status: string;
  };
  account: {
    id: string;
    code: string;
    name: string;
  };
  project: {
    id: string;
    name: string;
  } | null;
  paymentMethod: {
    id: string;
    name: string;
  } | null;
  expenseCategory: {
    id: string;
    name: string;
  } | null;
}

interface DebitResponse {
  ok: boolean;
  data: DebitLine[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  totals: {
    debit: number;
  };
}

interface Project {
  id: string;
  name: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
}

interface PaymentMethod {
  id: string;
  name: string;
}

interface EditFormData {
  accountId: string;
  projectId: string;
  workDetails: string;
  paidBy: string;
  receivedBy: string;
  paymentMethodId: string;
  fileRef: string;
  voucherRef: string;
  description: string;
  debit: string;
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'POSTED', label: 'Posted' },
] as const;

export default function DebitClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [debitLines, setDebitLines] = useState<DebitLine[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });

  const [filters, setFilters] = useState({
    projectId: '',
    dateFrom: '',
    dateTo: '',
    status: 'ALL' as string,
    includeCompanyLevel: true,
  });

  // Hydrate filters from URL on first load (so /dashboard/debit?projectId=xxx shows project filter)
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    if (hasHydrated) return;
    const projectId = searchParams.get('projectId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const includeCompanyLevel = searchParams.get('includeCompanyLevel');
    const status = searchParams.get('status') || 'ALL';
    setFilters((prev) => ({
      ...prev,
      projectId,
      dateFrom,
      dateTo,
      status: status || prev.status,
      includeCompanyLevel: includeCompanyLevel === undefined ? prev.includeCompanyLevel : includeCompanyLevel === 'true',
    }));
    setHasHydrated(true);
  }, [hasHydrated, searchParams]);

  // Edit/Delete state
  const [editingLine, setEditingLine] = useState<DebitLine | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingVoucherId, setDeletingVoucherId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadProjects();
    loadAccounts();
    loadPaymentMethods();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.ok) {
        setProjects(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load projects', err);
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/chart-of-accounts?active=true');
      const data = await response.json();
      if (data.ok) {
        setAccounts(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load accounts', err);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const response = await fetch('/api/payment-methods?active=true');
      const data = await response.json();
      if (data.ok) {
        setPaymentMethods(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load payment methods', err);
    }
  };

  const loadDebits = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.projectId) params.set('projectId', filters.projectId);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
      if (!filters.projectId && filters.includeCompanyLevel === false) {
        params.set('includeCompanyLevel', 'false');
      }
      params.set('page', pagination.page.toString());
      params.set('pageSize', pagination.pageSize.toString());

      const response = await fetch(`/api/debit?${params.toString()}`);
      const data: DebitResponse = await response.json();
      if (data.ok) {
        setDebitLines(data.data);
        setTotal(data.totals.debit);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to load debits', err);
    } finally {
      setLoading(false);
    }
  }, [filters.projectId, filters.dateFrom, filters.dateTo, filters.status, filters.includeCompanyLevel, pagination.page, pagination.pageSize]);

  useEffect(() => {
    if (!hasHydrated) return;
    loadDebits();
  }, [hasHydrated, loadDebits]);

  const updateUrl = useCallback(
    (updates: Partial<typeof filters>) => {
      const next = { ...filters, ...updates };
      const params = new URLSearchParams();
      if (next.projectId) params.set('projectId', next.projectId);
      if (next.dateFrom) params.set('dateFrom', next.dateFrom);
      if (next.dateTo) params.set('dateTo', next.dateTo);
      if (next.status && next.status !== 'ALL') params.set('status', next.status);
      if (!next.projectId && next.includeCompanyLevel === false) params.set('includeCompanyLevel', 'false');
      router.replace(`/dashboard/debit?${params.toString()}`, { scroll: false });
    },
    [filters, router]
  );

  const handleFilterChange = (key: string, value: string | boolean) => {
    const updates: Partial<typeof filters> = { [key]: value };
    setFilters((prev) => ({ ...prev, ...updates }));
    setPagination((prev) => ({ ...prev, page: 1 }));
    // Update URL for all filter changes to keep URL in sync
    updateUrl({ ...filters, ...updates });
  };

  const clearProjectFilter = () => {
    setFilters((prev) => ({ ...prev, projectId: '' }));
    setPagination((prev) => ({ ...prev, page: 1 }));
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters.includeCompanyLevel === false) params.set('includeCompanyLevel', 'false');
    router.replace(params.toString() ? `/dashboard/debit?${params.toString()}` : '/dashboard/debit', { scroll: false });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-BD');
  };

  const handleEdit = (line: DebitLine) => {
    setEditingLine(line);
    setEditFormData({
      accountId: line.account.id,
      projectId: line.project?.id || '',
      workDetails: line.workDetails || '',
      paidBy: line.paidBy || '',
      receivedBy: line.receivedBy || '',
      paymentMethodId: line.paymentMethod?.id || '',
      fileRef: line.fileRef || '',
      voucherRef: line.voucherRef || '',
      description: line.description || '',
      debit: line.debit.toString(),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingLine || !editFormData) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/voucher-lines/${editingLine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: editFormData.accountId,
          projectId: editFormData.projectId || null,
          workDetails: editFormData.workDetails || null,
          paidBy: editFormData.paidBy || null,
          receivedBy: editFormData.receivedBy || null,
          paymentMethodId: editFormData.paymentMethodId || null,
          fileRef: editFormData.fileRef || null,
          voucherRef: editFormData.voucherRef || null,
          description: editFormData.description || null,
          debit: parseFloat(editFormData.debit) || 0,
          credit: 0,
        }),
      });

      const data = await response.json();
      if (data.ok) {
        setEditingLine(null);
        setEditFormData(null);
        await loadDebits(); // Reload data
      } else {
        alert(data.error || 'Failed to update expense');
      }
    } catch (err) {
      alert('Failed to update expense');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (voucherId: string) => {
    setDeletingVoucherId(voucherId);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingVoucherId) return;

    try {
      const response = await fetch(`/api/vouchers/${deletingVoucherId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.ok) {
        setShowDeleteConfirm(false);
        setDeletingVoucherId(null);
        await loadDebits(); // Reload data
      } else {
        alert(data.error || 'Failed to delete voucher');
      }
    } catch (err) {
      alert('Failed to delete voucher');
      console.error(err);
    }
  };

  const handleAdjust = async (line: DebitLine) => {
    if (line.voucher.status !== 'POSTED') {
      alert('Adjustment can only be created for POSTED vouchers');
      return;
    }

    try {
      const response = await fetch(`/api/voucher-lines/${line.id}/adjust`, {
        method: 'POST',
      });

      const data = await response.json();
      if (data.ok) {
        window.location.href = `/dashboard/vouchers/${data.data.voucherId}/edit`;
      } else {
        alert(data.error || 'Failed to create adjustment voucher');
      }
    } catch (err) {
      alert('Failed to create adjustment voucher');
      console.error(err);
    }
  };

  const handleWorkflow = async (voucherId: string, action: 'submit' | 'approve' | 'post') => {
    const path = action === 'submit' ? 'submit' : action === 'approve' ? 'approve' : 'post';
    try {
      const response = await fetch(`/api/vouchers/${voucherId}/${path}`, { method: 'POST' });
      const data = await response.json();
      if (data.ok) {
        loadDebits();
      } else {
        alert(data.error || `Failed to ${action}`);
      }
    } catch (err) {
      alert(`Failed to ${action}`);
      console.error(err);
    }
  };

  const filteredProjectName = filters.projectId
    ? projects.find((p) => p.id === filters.projectId)?.name ?? null
    : null;
  const showCreatedBanner = searchParams.get('created') === '1';
  const projectId = filters.projectId;

  // Sort by date then by voucher number
  const sortedDebitLines = [...debitLines].sort((a, b) => {
    const dateA = new Date(a.voucher.date).getTime();
    const dateB = new Date(b.voucher.date).getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    // If dates are equal, sort by voucher number (SL)
    return a.voucher.voucherNo.localeCompare(b.voucher.voucherNo);
  });

  // Build "Add Expense" link
  const addExpenseLink = projectId
    ? `/dashboard/projects/${projectId}/debit/new?returnTo=${encodeURIComponent(`/dashboard/debit?projectId=${projectId}`)}`
    : '/dashboard/vouchers/new';

  return (
    <div>
      {/* Project context banner when filtered by project */}
      {projectId && (
        <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-md text-slate-800 text-sm flex items-center justify-between flex-wrap gap-2">
          <span>Showing results for this project</span>
          <Link
            href={`/dashboard/projects/${projectId}`}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Back to Project Dashboard
          </Link>
        </div>
      )}
      {/* Add Expense Button - shown above filters when in project context */}
      {projectId && (
        <div className="mb-4 flex justify-end">
          <Link
            href={addExpenseLink}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium inline-flex items-center gap-2"
          >
            <span>+</span>
            <span>Add Expense</span>
          </Link>
        </div>
      )}
      {showCreatedBanner && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md text-green-800 text-sm flex items-center justify-between">
          <span>Expense voucher created successfully.</span>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete('created');
              router.replace(params.toString() ? `/dashboard/debit?${params.toString()}` : '/dashboard/debit', { scroll: false });
            }}
            className="text-green-600 hover:text-green-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {filteredProjectName && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm flex items-center justify-between">
          <span>
            <strong>Filtered:</strong> {filteredProjectName}
          </span>
          <button
            type="button"
            onClick={clearProjectFilter}
            className="px-3 py-1 bg-amber-200 text-amber-900 rounded hover:bg-amber-300"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6 border-2 border-red-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Expense</h3>
            <p className="text-3xl font-bold text-red-600">{formatCurrency(total)}</p>
          </div>
          <div className="text-red-500 text-4xl">📉</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4 sm:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select
              value={filters.projectId}
              onChange={(e) => handleFilterChange('projectId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          {!filters.projectId && (
            <div className="md:col-span-2 flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.includeCompanyLevel}
                  onChange={(e) => handleFilterChange('includeCompanyLevel', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Include company-level expenses (no project)</span>
              </label>
            </div>
          )}
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({
                  projectId: '',
                  dateFrom: '',
                  dateTo: '',
                  status: 'ALL',
                  includeCompanyLevel: true,
                });
                setPagination((prev) => ({ ...prev, page: 1 }));
                router.replace('/dashboard/debit', { scroll: false });
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : debitLines.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No expense entries found</div>
        ) : (
          <>
            <div className="w-full overflow-x-auto -mx-3 sm:mx-0">
              <div className="min-w-[1100px] px-3 sm:px-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SL
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project Name
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Work Details
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Purpose
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cash
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Received
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Voucher
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tk
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Note
                    </th>
                    <th className="px-2 py-2 sm:px-3 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedDebitLines.map((line, index) => (
                    <tr
                      key={line.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/dashboard/debit/${line.voucher.id}`)}
                    >
                      <td className="px-2 py-2 sm:px-3 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-2 py-2 sm:px-3 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {formatDate(line.voucher.date)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            line.voucher.status === 'POSTED'
                              ? 'bg-green-100 text-green-800'
                              : line.voucher.status === 'DRAFT'
                                ? 'bg-gray-100 text-gray-800'
                                : line.voucher.status === 'SUBMITTED'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : line.voucher.status === 'APPROVED'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {line.voucher.status}
                        </span>
                      </td>
                      <td className="px-2 py-2 sm:px-3 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {line.project?.name || 'Company'}
                      </td>
                      <td className="px-2 py-2 sm:px-3 sm:py-3 text-xs sm:text-sm text-gray-500">
                        {line.workDetails || '—'}
                      </td>
                      <td className="px-2 py-2 sm:px-3 sm:py-3 text-xs sm:text-sm text-gray-500">
                        {line.account.name || '—'}
                      </td>
                      <td className="px-2 py-2 sm:px-3 sm:py-3 text-xs sm:text-sm text-gray-500">
                        {line.expenseCategory?.name || '—'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                        {line.paymentMethod?.name || '—'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                        {line.paidBy || '—'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                        {line.receivedBy || '—'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                        {line.fileRef || '—'}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                        {line.voucherRef || '—'}
                      </td>
                      <td className="px-2 py-2 sm:px-3 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-red-600 text-right">
                        {formatCurrency(line.debit)}
                      </td>
                      <td className="px-2 py-2 sm:px-3 sm:py-3 text-xs sm:text-sm text-gray-500">
                        {line.description || line.voucher.narration || '—'}
                      </td>
                      <td
                        className="px-2 py-2 sm:px-3 sm:py-3 whitespace-nowrap text-sm text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap gap-1 sm:gap-2 justify-center items-center">
                          {line.voucher.status === 'DRAFT' && (
                            <>
                              <button
                                onClick={() => handleWorkflow(line.voucher.id, 'submit')}
                                className="text-amber-600 hover:text-amber-800 p-2 rounded hover:bg-amber-50 text-xs min-w-[44px] min-h-[44px] flex items-center justify-center"
                                title="Submit"
                              >
                                Submit
                              </button>
                              <button
                                onClick={() => handleEdit(line)}
                                className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded hover:bg-blue-50"
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteClick(line.voucher.id)}
                                className="text-red-600 hover:text-red-900 px-2 py-1 rounded hover:bg-red-50"
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                          {line.voucher.status === 'SUBMITTED' && (
                            <button
                              onClick={() => handleWorkflow(line.voucher.id, 'approve')}
                              className="text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 text-xs"
                              title="Approve"
                            >
                              Approve
                            </button>
                          )}
                          {line.voucher.status === 'APPROVED' && (
                            <button
                              onClick={() => handleWorkflow(line.voucher.id, 'post')}
                              className="text-green-600 hover:text-green-800 px-2 py-1 rounded hover:bg-green-50 text-xs"
                              title="Post"
                            >
                              Post
                            </button>
                          )}
                          {line.voucher.status === 'POSTED' && (
                            <button
                              onClick={() => handleAdjust(line)}
                              className="text-green-600 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50"
                              title="Create adjustment voucher"
                            >
                              🔄
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                  {pagination.total} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editingLine && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Expense</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="text"
                    value={formatDate(editingLine.voucher.date)}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Voucher No
                  </label>
                  <input
                    type="text"
                    value={editingLine.voucher.voucherNo}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account (Purpose) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editFormData.accountId}
                    onChange={(e) => setEditFormData({ ...editFormData, accountId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Select Account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project
                  </label>
                  <select
                    value={editFormData.projectId}
                    onChange={(e) => setEditFormData({ ...editFormData, projectId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">None</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Work Details
                  </label>
                  <input
                    type="text"
                    value={editFormData.workDetails}
                    onChange={(e) => setEditFormData({ ...editFormData, workDetails: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method (Cash)
                  </label>
                  <select
                    value={editFormData.paymentMethodId}
                    onChange={(e) => setEditFormData({ ...editFormData, paymentMethodId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select Payment Method</option>
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Paid By
                  </label>
                  <input
                    type="text"
                    value={editFormData.paidBy}
                    onChange={(e) => setEditFormData({ ...editFormData, paidBy: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Received By
                  </label>
                  <input
                    type="text"
                    value={editFormData.receivedBy}
                    onChange={(e) => setEditFormData({ ...editFormData, receivedBy: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File Ref
                  </label>
                  <input
                    type="text"
                    value={editFormData.fileRef}
                    onChange={(e) => setEditFormData({ ...editFormData, fileRef: e.target.value })}
                    placeholder="e.g., 1*1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Voucher Ref
                  </label>
                  <select
                    value={editFormData.voucherRef}
                    onChange={(e) => setEditFormData({ ...editFormData, voucherRef: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select Voucher</option>
                    <option value="Khata">Khata</option>
                    <option value="Diary">Diary</option>
                    <option value="OC">OC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tk (Amount) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.debit}
                    onChange={(e) => setEditFormData({ ...editFormData, debit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <button
                  onClick={() => {
                    setEditingLine(null);
                    setEditFormData(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving || !editFormData.accountId || !editFormData.debit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Delete Voucher</h2>
            <p className="mb-6">Are you sure you want to delete this voucher and all its lines? This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingVoucherId(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
