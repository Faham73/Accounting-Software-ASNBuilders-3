'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Investment {
  id: string;
  date: string;
  amount: number;
  note: string | null;
  investorName: string | null;
  receivedBy: string | null;
  paymentMethod: 'CASH' | 'BANK' | null;
  voucherId: string | null;
  project: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
}

interface InvestmentsResponse {
  ok: boolean;
  data: Investment[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  totals: {
    investments: number;
  };
}

interface Project {
  id: string;
  name: string;
}

type ImportedInvestmentRow = {
  _rowId: string;
  projectId: string; // REQUIRED unless filters.projectId is set
  projectName?: string; // For display
  date: string; // yyyy-mm-dd
  amount: number;
  investorName: string;
  receivedBy: string;
  paymentMethod: 'CASH' | 'BANK';
  note?: string | null;
  error?: string | null; // per-row validation error
};

export default function InvestmentsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });

  const [filters, setFilters] = useState({
    projectId: searchParams.get('projectId') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [investmentMode, setInvestmentMode] = useState<'SINGLE' | 'IMPORT'>('SINGLE');
  const [importRows, setImportRows] = useState<ImportedInvestmentRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
    loadInvestments();
  }, []);

  useEffect(() => {
    loadInvestments();
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

  const loadInvestments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.projectId) params.set('projectId', filters.projectId);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      params.set('page', pagination.page.toString());
      params.set('pageSize', pagination.pageSize.toString());

      const response = await fetch(`/api/investments?${params.toString()}`);
      const data: InvestmentsResponse = await response.json();
      if (data.ok) {
        setInvestments(data.data);
        setTotal(data.totals.investments);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to load investments', err);
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

  const handleAddInvestment = () => {
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const projectId = filters.projectId || String(formData.get('projectId') || '');
    if (!projectId) {
      alert('Project is required');
      return;
    }

    const data = {
      date: formData.get('date'),
      amount: parseFloat(formData.get('amount') as string),
      investorName: String(formData.get('investorName') || ''),
      receivedBy: String(formData.get('receivedBy') || ''),
      paymentMethod: String(formData.get('paymentMethod') || 'CASH'),
      note: formData.get('note') || null,
    };

    try {
      setSubmitting(true);
      const response = await fetch(`/api/projects/${projectId}/investments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (result.ok) {
        setShowAddModal(false);
        (e.target as HTMLFormElement).reset();
        loadInvestments();
      } else {
        alert(result.error || 'Failed to create investment');
      }
    } catch (err) {
      alert('Failed to create investment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setInvestmentMode('SINGLE');
    setImportRows([]);
    setImportError(null);
    setImportLoading(false);
  };

  const handleDownloadInvestmentTemplate = () => {
    window.open('/api/investments/template', '_blank');
  };

  const isProjectFiltered = !!filters.projectId;

  // Helper: normalize header keys
  const normKey = (k: string) => k.toLowerCase().replace(/[\s_\/()-]+/g, '');

  // Helper: normalize date
  const normalizeDate = (input: any): string | null => {
    if (!input) return null;
    if (typeof input === 'string') {
      const d = new Date(input);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
      const num = parseFloat(input);
      if (!isNaN(num) && num > 0) {
        const excelEpoch = new Date(1899, 11, 30);
        const jsDate = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
        return jsDate.toISOString().split('T')[0];
      }
    }
    if (typeof input === 'number' && input > 0) {
      const excelEpoch = new Date(1899, 11, 30);
      const jsDate = new Date(excelEpoch.getTime() + input * 24 * 60 * 60 * 1000);
      return jsDate.toISOString().split('T')[0];
    }
    if (input instanceof Date) {
      return input.toISOString().split('T')[0];
    }
    return null;
  };

  // Helper: parse payment method
  const parsePaymentMethod = (value: any): 'CASH' | 'BANK' | null => {
    if (!value) return null;
    const str = String(value).toUpperCase().trim();
    if (str === 'CASH' || str === 'C') return 'CASH';
    if (str === 'BANK' || str === 'B') return 'BANK';
    return null;
  };

  // Helper: find project by name
  const findProjectByName = (name: string): string | null => {
    const trimmed = name.trim();
    const project = projects.find(
      (p) => p.name.toLowerCase().trim() === trimmed.toLowerCase()
    );
    return project?.id || null;
  };

  // Helper: validate row
  const validateRow = (row: Partial<ImportedInvestmentRow>): string | null => {
    // If projectId filter exists, allow missing row.projectId
    const projectId = row.projectId || (isProjectFiltered ? filters.projectId : null);
    if (!projectId) {
      return 'Project is required (or filter by project)';
    }
    if (!row.date) return 'Date is required';
    if (!row.amount || row.amount <= 0) return 'Amount must be positive';
    if (!row.investorName || !row.investorName.trim()) return 'Investor name is required';
    if (!row.receivedBy || !row.receivedBy.trim()) return 'Received by is required';
    if (!row.paymentMethod) return 'Payment method must be CASH or BANK';
    return null;
  };

  // Helper: simple CSV parser
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Helper: parse file to rows
  const parseFileToRows = async (file: File): Promise<ImportedInvestmentRow[]> => {
    const rows: ImportedInvestmentRow[] = [];
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
      }

      const headerLine = lines[0];
      const headers = parseCSVLine(headerLine).map((h) => normKey(h));

      const projectIdx = headers.findIndex(
        (h) => h === 'projectid' || h === 'project' || h === 'projectname'
      );
      const dateIdx = headers.findIndex((h) => h === 'date');
      const amountIdx = headers.findIndex((h) => h === 'amount');
      const investorIdx = headers.findIndex((h) => h === 'investor' || h === 'investorname');
      const receivedByIdx = headers.findIndex((h) => h === 'receivedby' || h === 'receiver');
      const paymentMethodIdx = headers.findIndex(
        (h) => h === 'paymentmethod' || h === 'cashbank' || h === 'method' || h === 'paymentmethodcashbank'
      );
      const noteIdx = headers.findIndex((h) => h === 'note');

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const rowId = crypto.randomUUID ? crypto.randomUUID() : `row-${i}-${Math.random()}`;

        const projectValue = projectIdx >= 0 ? String(values[projectIdx] || '').trim() : '';
        let projectId = '';
        let projectName = '';

        if (projectValue) {
          // Try to find by ID first
          const foundById = projects.find((p) => p.id === projectValue);
          if (foundById) {
            projectId = foundById.id;
            projectName = foundById.name;
          } else {
            // Try to find by name
            const foundByName = findProjectByName(projectValue);
            if (foundByName) {
              projectId = foundByName;
              projectName = projectValue;
            } else {
              projectName = projectValue; // Will show error
            }
          }
        } else if (isProjectFiltered) {
          projectId = filters.projectId;
          const foundProject = projects.find((p) => p.id === filters.projectId);
          projectName = foundProject?.name || '';
        }

        const date = dateIdx >= 0 ? normalizeDate(values[dateIdx]) : null;
        const amount = amountIdx >= 0 ? parseFloat(values[amountIdx]) : NaN;
        const investorName = investorIdx >= 0 ? String(values[investorIdx] || '').trim() : '';
        const receivedBy = receivedByIdx >= 0 ? String(values[receivedByIdx] || '').trim() : '';
        const paymentMethod = paymentMethodIdx >= 0 ? parsePaymentMethod(values[paymentMethodIdx]) : null;
        const note = noteIdx >= 0 ? String(values[noteIdx] || '').trim() || null : null;

        const row: ImportedInvestmentRow = {
          _rowId: rowId,
          projectId,
          projectName,
          date: date || '',
          amount: isNaN(amount) ? 0 : amount,
          investorName,
          receivedBy,
          paymentMethod: paymentMethod || 'CASH',
          note,
        };

        // Validate project
        if (!projectId && projectValue) {
          row.error = `Unknown project: ${projectValue}`;
        } else {
          row.error = validateRow(row);
        }

        rows.push(row);
      }
    } else {
      // Parse Excel
      try {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];

        if (json.length === 0) {
          throw new Error('Excel file is empty');
        }

        const firstRow = json[0];
        const projectKey = Object.keys(firstRow).find(
          (k) => normKey(k) === 'projectid' || normKey(k) === 'project' || normKey(k) === 'projectname'
        );
        const dateKey = Object.keys(firstRow).find((k) => normKey(k) === 'date');
        const amountKey = Object.keys(firstRow).find((k) => normKey(k) === 'amount');
        const investorKey = Object.keys(firstRow).find(
          (k) => normKey(k) === 'investor' || normKey(k) === 'investorname'
        );
        const receivedByKey = Object.keys(firstRow).find(
          (k) => normKey(k) === 'receivedby' || normKey(k) === 'receiver'
        );
        const paymentMethodKey = Object.keys(firstRow).find(
          (k) => normKey(k) === 'paymentmethod' || normKey(k) === 'cashbank' || normKey(k) === 'method' || normKey(k) === 'paymentmethodcashbank'
        );
        const noteKey = Object.keys(firstRow).find((k) => normKey(k) === 'note');

        for (let i = 0; i < json.length; i++) {
          const obj = json[i];
          const rowId = crypto.randomUUID ? crypto.randomUUID() : `row-${i}-${Math.random()}`;

          const projectValue = projectKey ? String(obj[projectKey] || '').trim() : '';
          let projectId = '';
          let projectName = '';

          if (projectValue) {
            const foundById = projects.find((p) => p.id === projectValue);
            if (foundById) {
              projectId = foundById.id;
              projectName = foundById.name;
            } else {
              const foundByName = findProjectByName(projectValue);
              if (foundByName) {
                projectId = foundByName;
                projectName = projectValue;
              } else {
                projectName = projectValue;
              }
            }
          } else if (isProjectFiltered) {
            projectId = filters.projectId;
            const foundProject = projects.find((p) => p.id === filters.projectId);
            projectName = foundProject?.name || '';
          }

          const date = dateKey ? normalizeDate(obj[dateKey]) : null;
          const amount = amountKey ? parseFloat(String(obj[amountKey] || 0)) : NaN;
          const investorName = investorKey ? String(obj[investorKey] || '').trim() : '';
          const receivedBy = receivedByKey ? String(obj[receivedByKey] || '').trim() : '';
          const paymentMethod = paymentMethodKey ? parsePaymentMethod(obj[paymentMethodKey]) : null;
          const note = noteKey ? String(obj[noteKey] || '').trim() || null : null;

          const row: ImportedInvestmentRow = {
            _rowId: rowId,
            projectId,
            projectName,
            date: date || '',
            amount: isNaN(amount) ? 0 : amount,
            investorName,
            receivedBy,
            paymentMethod: paymentMethod || 'CASH',
            note,
          };

          if (!projectId && projectValue) {
            row.error = `Unknown project: ${projectValue}`;
          } else {
            row.error = validateRow(row);
          }

          rows.push(row);
        }
      } catch (err) {
        throw new Error(`Failed to parse Excel file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return rows;
  };

  // Handle file upload
  const handleInvestmentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportLoading(true);

    try {
      const rows = await parseFileToRows(file);
      setImportRows(rows);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to parse file');
      setImportRows([]);
    } finally {
      setImportLoading(false);
    }
  };

  // Handle remove row
  const handleRemoveImportRow = (rowId: string) => {
    setImportRows((prev) => prev.filter((r) => r._rowId !== rowId));
  };

  // Handle import submit
  const handleImportSubmit = async () => {
    if (importRows.length === 0) {
      alert('No rows to import');
      return;
    }

    const rowsWithErrors = importRows.filter((r) => r.error);
    if (rowsWithErrors.length > 0) {
      alert(`Please fix ${rowsWithErrors.length} error(s) before importing`);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const failures: string[] = [];

    for (const row of importRows) {
      const projectId = row.projectId || filters.projectId;
      if (!projectId) {
        failCount++;
        failures.push(`Row ${row._rowId}: Project is required`);
        continue;
      }

      try {
        const response = await fetch(`/api/projects/${projectId}/investments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: row.date,
            amount: row.amount,
            investorName: row.investorName,
            receivedBy: row.receivedBy,
            paymentMethod: row.paymentMethod,
            note: row.note || null,
          }),
        });

        const result = await response.json();
        if (result.ok) {
          successCount++;
        } else {
          failCount++;
          failures.push(`Row ${row._rowId}: ${result.error || 'Failed'}`);
        }
      } catch (err) {
        failCount++;
        failures.push(`Row ${row._rowId}: ${err instanceof Error ? err.message : 'Network error'}`);
      }
    }

    // Close modal and reset
    handleModalClose();

    // Reload investments
    loadInvestments();

    // Show result
    if (failCount === 0) {
      alert(`Successfully imported ${successCount} investment(s)`);
    } else {
      alert(`Imported: ${successCount} success, ${failCount} failed\n\nFailures:\n${failures.slice(0, 5).join('\n')}${failures.length > 5 ? '\n...' : ''}`);
    }
  };

  return (
    <div>
      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-6">
        <div></div>
        <button
          onClick={handleAddInvestment}
          className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm font-medium"
        >
          {isProjectFiltered ? '+ Add Investment (This Project)' : '+ Add Investment'}
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-2 border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Investment</h3>
            <p className="text-3xl font-bold text-purple-600">{formatCurrency(total)}</p>
          </div>
          <div className="text-purple-500 text-4xl">💰</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                setFilters({ projectId: '', dateFrom: '', dateTo: '' });
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
        ) : investments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No investments found</div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Investor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Received By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cash/Bank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Note
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {investments.map((investment) => (
                  <tr key={investment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(investment.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {investment.project.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {investment.investorName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {investment.receivedBy || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {investment.paymentMethod || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                      {formatCurrency(investment.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {investment.note || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {investment.createdBy.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* Add Investment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-2">Add Funding (Investment)</h2>
            <p className="text-sm text-gray-500 mb-4">Investment is funding, not income.</p>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setInvestmentMode('SINGLE')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium ${
                  investmentMode === 'SINGLE'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setInvestmentMode('IMPORT')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium ${
                  investmentMode === 'IMPORT'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Import File
              </button>
            </div>

            {investmentMode === 'SINGLE' ? (
              <form onSubmit={handleAddSubmit}>
              {!isProjectFiltered && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="projectId"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select Project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Investor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="investorName"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Received By <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="receivedBy"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  name="paymentMethod"
                  required
                  defaultValue="CASH"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="amount"
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note (optional)
                </label>
                <textarea
                  name="note"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Add Investment'}
                </button>
                <button
                  type="button"
                  onClick={handleModalClose}
                  disabled={submitting}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
            ) : (
              <div>
                {/* File Upload */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Excel or CSV File</h3>
                      <p className="text-sm text-gray-600">
                        Upload a file with investment entries. Download the template to ensure correct format.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadInvestmentTemplate}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      📥 Download Template
                    </button>
                  </div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload File (.csv, .xlsx, .xls)
                  </label>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleInvestmentFileUpload}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Required columns:{' '}
                    {isProjectFiltered
                      ? 'Date | Amount | InvestorName | ReceivedBy | PaymentMethod | Note (optional)'
                      : 'Project (name or id) | Date | Amount | InvestorName | ReceivedBy | PaymentMethod | Note (optional)'}
                  </p>
                </div>

                {/* Loading State */}
                {importLoading && (
                  <div className="text-center py-4 text-gray-600">Parsing file...</div>
                )}

                {/* Error State */}
                {importError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {importError}
                  </div>
                )}

                {/* Preview Table */}
                {importRows.length > 0 && (
                  <div className="mb-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            {!isProjectFiltered && (
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Project
                              </th>
                            )}
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Date
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Amount
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Investor
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Received By
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Cash/Bank
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Note
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Status
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {importRows.map((row) => (
                            <tr key={row._rowId} className={row.error ? 'bg-red-50' : ''}>
                              {!isProjectFiltered && (
                                <td className="px-3 py-2 text-sm text-gray-900">
                                  {row.projectName || row.projectId || '-'}
                                </td>
                              )}
                              <td className="px-3 py-2 text-sm text-gray-900">{row.date || '-'}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {formatCurrency(row.amount)}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {row.investorName || '-'}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {row.receivedBy || '-'}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-900">
                                {row.paymentMethod || '-'}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-500">{row.note || '-'}</td>
                              <td className="px-3 py-2 text-sm">
                                {row.error ? (
                                  <span className="text-red-600">ERROR: {row.error}</span>
                                ) : (
                                  <span className="text-green-600">✓ Valid</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-sm">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImportRow(row._rowId)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary */}
                    <div className="mt-3 text-sm text-gray-600">
                      Total rows: {importRows.length} | Valid:{' '}
                      {importRows.filter((r) => !r.error).length} | Errors:{' '}
                      {importRows.filter((r) => r.error).length}
                    </div>
                  </div>
                )}

                {/* Import Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleImportSubmit}
                    disabled={importRows.length === 0 || importRows.some((r) => r.error)}
                    className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Import Rows
                  </button>
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
