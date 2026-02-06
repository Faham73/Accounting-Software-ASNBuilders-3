'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import CreateCreditForm from './components/CreateCreditForm';
import EditCreditForm from './components/EditCreditForm';

interface Credit {
  id: string;
  date: string;
  projectSnapshotName: string;
  purpose: string;
  paidBy: string;
  receivedBy: string;
  paymentMethod: string;
  paymentRef: string | null;
  amount: number;
  note: string | null;
  projectId: string | null;
  project: {
    id: string;
    name: string;
  } | null;
  paymentAccount: {
    id: string;
    code: string;
    name: string;
  } | null;
}

interface CreditResponse {
  ok: boolean;
  data: Credit[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  totals: {
    credit: number;
  };
}

interface Project {
  id: string;
  name: string;
}

export default function CreditClient() {
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get('projectId') || '';

  const [credits, setCredits] = useState<Credit[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCredit, setEditingCredit] = useState<Credit | null>(null);
  const [deletingCredit, setDeletingCredit] = useState<Credit | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    failed: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);
  const [stopOnError, setStopOnError] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });

  const [filters, setFilters] = useState({
    projectId: '',
    filterType: 'all', // 'all', 'company', or projectId
    dateFrom: '',
    dateTo: '',
  });

  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    if (hasHydrated) return;
    if (projectIdFromUrl) {
      setFilters((prev) => ({ ...prev, filterType: projectIdFromUrl, projectId: projectIdFromUrl }));
    }
    setHasHydrated(true);
  }, [projectIdFromUrl, hasHydrated]);

  useEffect(() => {
    loadProjects();
    loadCredits();
  }, []);

  useEffect(() => {
    loadCredits();
  }, [filters, pagination.page]);

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

  const loadCredits = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      // If filterType is 'company', we'll handle it in the API
      // If filterType is a projectId, use it as projectId
      if (filters.filterType === 'company') {
        // Special handling: pass a special flag or handle in API
        // For now, we'll pass projectId='' and handle company-level filtering in API
        params.set('companyLevelOnly', 'true');
      } else if (filters.filterType && filters.filterType !== 'all') {
        params.set('projectId', filters.filterType);
      }
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      params.set('page', pagination.page.toString());
      params.set('pageSize', pagination.pageSize.toString());

      const response = await fetch(`/api/credit?${params.toString()}`);
      const data: CreditResponse = await response.json();
      if (data.ok) {
        setCredits(data.data);
        setTotal(data.totals.credit);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to load credits', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
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

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    loadCredits();
  };

  const handleEditClick = (credit: Credit) => {
    setEditingCredit(credit);
    setShowEditModal(true);
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setEditingCredit(null);
    loadCredits();
  };

  const handleDeleteClick = (credit: Credit) => {
    setDeletingCredit(credit);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCredit) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/credit/${deletingCredit.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.ok) {
        setShowDeleteConfirm(false);
        setDeletingCredit(null);
        loadCredits();
      } else {
        alert(result.error || 'Failed to delete credit');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete credit');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open('/api/credit/template', '_blank');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('stopOnError', stopOnError.toString());

      const response = await fetch('/api/credit/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.ok) {
        setImportResult(result.data);
        if (result.data.inserted > 0) {
          loadCredits();
        }
      } else {
        setImportResult({
          inserted: 0,
          failed: 0,
          errors: [{ row: 0, message: result.error || 'Import failed' }],
        });
      }
    } catch (error) {
      setImportResult({
        inserted: 0,
        failed: 0,
        errors: [
          {
            row: 0,
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      });
    } finally {
      setImportLoading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  return (
    <div>
      {/* Project context banner when opened with projectId in URL */}
      {projectIdFromUrl && (
        <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-md text-slate-800 text-sm flex items-center justify-between flex-wrap gap-2">
          <span>Showing results for this project</span>
          <Link
            href={`/dashboard/projects/${projectIdFromUrl}`}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Back to Project Dashboard
          </Link>
        </div>
      )}
      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6 border-2 border-indigo-200">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Credit</h3>
            <p className="text-3xl font-bold text-indigo-600">{formatCurrency(total)}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <button
              onClick={() => setShowImportModal(true)}
              className="w-full sm:w-auto min-h-[40px] px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
            >
              📤 Upload Excel
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto min-h-[40px] px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
            >
              + Create Credit
            </button>
            <div className="text-indigo-500 text-4xl">📈</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4 sm:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter</label>
            <select
              value={filters.filterType}
              onChange={(e) => handleFilterChange('filterType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All</option>
              <option value="company">Company (All Projects)</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ projectId: '', filterType: 'all', dateFrom: '', dateTo: '' });
                setPagination((prev) => ({ ...prev, page: 1 }));
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
        ) : credits.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No credit entries found</div>
        ) : (
          <>
            <div className="w-full overflow-x-auto -mx-3 sm:mx-0">
              <div className="min-w-[900px] px-3 sm:px-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project Name
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purpose
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid By
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Received By
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cash/Check
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Note
                  </th>
                  <th className="px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {credits.map((credit) => (
                  <tr key={credit.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      {formatDate(credit.date)}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      {credit.projectSnapshotName || credit.project?.name || 'Company (All Projects)'}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-gray-500">
                      {credit.purpose}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      {credit.paidBy}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                      {credit.receivedBy}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-gray-500">
                      <div>
                        <div className="font-medium">{credit.paymentMethod}</div>
                        {credit.paymentRef && (
                          <div className="text-xs text-gray-400">{credit.paymentRef}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-indigo-600">
                      {formatCurrency(credit.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {credit.note || 'Done'}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center justify-end gap-1 sm:gap-2">
                        <button
                          onClick={() => handleEditClick(credit)}
                          className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded"
                          title="Edit"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(credit)}
                          className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
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

      {/* Edit Credit Modal */}
      {showEditModal && editingCredit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Edit Credit Entry</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCredit(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <EditCreditForm
                credit={editingCredit}
                onSuccess={handleEditSuccess}
                onCancel={() => {
                  setShowEditModal(false);
                  setEditingCredit(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingCredit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Delete Credit Entry</h2>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this credit entry? This action cannot be undone.
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <div className="text-sm text-gray-700">
                  <div className="font-medium mb-2">Credit Details:</div>
                  <div>Date: {formatDate(deletingCredit.date)}</div>
                  <div>Project: {deletingCredit.projectSnapshotName || deletingCredit.project?.name || 'Company (All Projects)'}</div>
                  <div>Purpose: {deletingCredit.purpose}</div>
                  <div>Amount: {formatCurrency(deletingCredit.amount)}</div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingCredit(null);
                  }}
                  disabled={deleteLoading}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Credit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Create Credit Entry</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <CreateCreditForm onSuccess={handleCreateSuccess} onCancel={() => setShowCreateModal(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Import Credits from Excel</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportResult(null);
                  setStopOnError(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Excel File</h3>
                    <p className="text-sm text-gray-600">
                      Upload an Excel file with credit entries. Download the template to ensure correct format.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    📥 Download Template
                  </button>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={importLoading}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Accepted formats: .xlsx, .xls (Max file size: 10MB)
                  </p>
                </div>

                <div className="mt-4 flex items-center">
                  <input
                    type="checkbox"
                    id="stopOnError"
                    checked={stopOnError}
                    onChange={(e) => setStopOnError(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="stopOnError" className="ml-2 block text-sm text-gray-700">
                    Stop import if any error occurs (otherwise, skip invalid rows)
                  </label>
                </div>
              </div>

              {importLoading && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <p className="mt-2 text-sm text-gray-600">Processing Excel file...</p>
                </div>
              )}

              {importResult && (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Import Results</h3>
                  
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-sm text-green-600 font-medium">Inserted</div>
                      <div className="text-2xl font-bold text-green-700">{importResult.inserted}</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="text-sm text-red-600 font-medium">Failed</div>
                      <div className="text-2xl font-bold text-red-700">{importResult.failed}</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-sm text-blue-600 font-medium">Total</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {importResult.inserted + importResult.failed}
                      </div>
                    </div>
                  </div>

                  {/* Errors */}
                  {importResult.errors.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Errors:</h4>
                      <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-red-200">
                          <thead className="bg-red-100">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-red-700">Row</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-red-700">Error</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-red-200">
                            {importResult.errors.map((error, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2 text-sm text-red-900">{error.row}</td>
                                <td className="px-4 py-2 text-sm text-red-800">{error.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {importResult.inserted > 0 && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700">
                        ✅ Successfully imported {importResult.inserted} credit
                        {importResult.inserted !== 1 ? 's' : ''}. The list has been refreshed.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportResult(null);
                    setStopOnError(false);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
