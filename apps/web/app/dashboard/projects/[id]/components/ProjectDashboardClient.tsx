'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface LaborByType {
  DAY: number;
  MONTHLY: number;
  CONTRACT: number;
}

interface ProjectTotals {
  purchases: number;
  stocks: number;
  investments: number;
  labor: number;
  laborByType: LaborByType;
  debit: number;
  credit: number;
}

interface ProjectDashboardClientProps {
  projectId: string;
  projectName: string;
}

type ImportedInvestmentRow = {
  _rowId: string;
  date: string; // yyyy-mm-dd
  amount: number;
  investorName: string;
  receivedBy: string;
  paymentMethod: 'CASH' | 'BANK';
  note?: string | null;
  error?: string | null; // per-row validation error
};

export default function ProjectDashboardClient({
  projectId,
  projectName,
}: ProjectDashboardClientProps) {
  const router = useRouter();
  const [totals, setTotals] = useState<ProjectTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvestmentModal, setShowInvestmentModal] = useState(false);
  const [showLaborPopover, setShowLaborPopover] = useState(false);
  const [investmentMode, setInvestmentMode] = useState<'SINGLE' | 'IMPORT'>('SINGLE');
  const [importRows, setImportRows] = useState<ImportedInvestmentRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    loadTotals();
  }, [projectId]);

  const loadTotals = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/totals`);
      const data = await response.json();
      if (data.ok) {
        setTotals(data.data);
      } else {
        setError(data.error || 'Failed to load totals');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load totals');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleViewPurchases = () => {
    router.push(`/dashboard/projects/${projectId}/purchases`);
  };

  const handleViewStock = () => {
    router.push(`/dashboard/projects/${projectId}/stock`);
  };

  const handleAddInvestment = () => {
    setShowInvestmentModal(true);
  };

  const handleLaborCardClick = () => {
    setShowLaborPopover((v) => !v);
  };

  // Helper: normalize header keys
  const normKey = (k: string) => k.toLowerCase().replace(/[\s_\/()-]+/g, '');

  // Helper: normalize date
  const normalizeDate = (input: any): string | null => {
    if (!input) return null;
    if (typeof input === 'string') {
      // Try parsing various formats
      const d = new Date(input);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
      // Try Excel date format (number)
      const num = parseFloat(input);
      if (!isNaN(num) && num > 0) {
        // Excel epoch is 1900-01-01, but JavaScript is 1970-01-01
        // Excel date = days since 1900-01-01, but has a bug: it thinks 1900 was a leap year
        const excelEpoch = new Date(1899, 11, 30);
        const jsDate = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
        return jsDate.toISOString().split('T')[0];
      }
    }
    if (typeof input === 'number' && input > 0) {
      // Excel numeric date
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

  // Helper: validate row
  const validateRow = (row: Partial<ImportedInvestmentRow>): string | null => {
    if (!row.date) return 'Date is required';
    if (!row.amount || row.amount <= 0) return 'Amount must be positive';
    if (!row.investorName || !row.investorName.trim()) return 'Investor name is required';
    if (!row.receivedBy || !row.receivedBy.trim()) return 'Received by is required';
    if (!row.paymentMethod) return 'Payment method must be CASH or BANK';
    return null;
  };

  // Helper: simple CSV parser (handles quoted fields)
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
      // Parse CSV
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
      }

      const headerLine = lines[0];
      const headers = parseCSVLine(headerLine).map((h) => normKey(h));

      // Find column indices
      const dateIdx = headers.findIndex((h) => h === 'date');
      const amountIdx = headers.findIndex((h) => h === 'amount');
      const investorIdx = headers.findIndex((h) => h === 'investor' || h === 'investorname');
      const receivedByIdx = headers.findIndex((h) => h === 'receivedby' || h === 'receiver');
      const paymentMethodIdx = headers.findIndex((h) => h === 'paymentmethod' || h === 'cashbank' || h === 'cash/bank');
      const noteIdx = headers.findIndex((h) => h === 'note');

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const rowId = crypto.randomUUID ? crypto.randomUUID() : `row-${i}-${Math.random()}`;

        const date = dateIdx >= 0 ? normalizeDate(values[dateIdx]) : null;
        const amount = amountIdx >= 0 ? parseFloat(values[amountIdx]) : NaN;
        const investorName = investorIdx >= 0 ? String(values[investorIdx] || '').trim() : '';
        const receivedBy = receivedByIdx >= 0 ? String(values[receivedByIdx] || '').trim() : '';
        const paymentMethod = paymentMethodIdx >= 0 ? parsePaymentMethod(values[paymentMethodIdx]) : null;
        const note = noteIdx >= 0 ? String(values[noteIdx] || '').trim() || null : null;

        const row: ImportedInvestmentRow = {
          _rowId: rowId,
          date: date || '',
          amount: isNaN(amount) ? 0 : amount,
          investorName,
          receivedBy,
          paymentMethod: paymentMethod || 'CASH',
          note,
        };

        row.error = validateRow(row);
        rows.push(row);
      }
    } else {
      // Parse Excel (.xlsx, .xls)
      try {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];

        if (json.length === 0) {
          throw new Error('Excel file is empty');
        }

        // Get headers from first row
        const firstRow = json[0];
        const headers = Object.keys(firstRow).map((k) => normKey(k));

        // Find column keys
        const dateKey = Object.keys(firstRow).find((k) => normKey(k) === 'date');
        const amountKey = Object.keys(firstRow).find((k) => normKey(k) === 'amount');
        const investorKey = Object.keys(firstRow).find((k) => {
          const nk = normKey(k);
          return nk === 'investor' || nk === 'investorname';
        });
        const receivedByKey = Object.keys(firstRow).find((k) => {
          const nk = normKey(k);
          return nk === 'receivedby' || nk === 'receiver';
        });
        const paymentMethodKey = Object.keys(firstRow).find((k) => {
          const nk = normKey(k);
          return nk === 'paymentmethod' || nk === 'cashbank' || nk === 'cash/bank';
        });
        const noteKey = Object.keys(firstRow).find((k) => normKey(k) === 'note');

        for (let i = 0; i < json.length; i++) {
          const obj = json[i];
          const rowId = crypto.randomUUID ? crypto.randomUUID() : `row-${i}-${Math.random()}`;

          const date = dateKey ? normalizeDate(obj[dateKey]) : null;
          const amount = amountKey ? parseFloat(String(obj[amountKey] || 0)) : NaN;
          const investorName = investorKey ? String(obj[investorKey] || '').trim() : '';
          const receivedBy = receivedByKey ? String(obj[receivedByKey] || '').trim() : '';
          const paymentMethod = paymentMethodKey ? parsePaymentMethod(obj[paymentMethodKey]) : null;
          const note = noteKey ? String(obj[noteKey] || '').trim() || null : null;

          const row: ImportedInvestmentRow = {
            _rowId: rowId,
            date: date || '',
            amount: isNaN(amount) ? 0 : amount,
            investorName,
            receivedBy,
            paymentMethod: paymentMethod || 'CASH',
            note,
          };

          row.error = validateRow(row);
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
    setShowInvestmentModal(false);
    setInvestmentMode('SINGLE');
    setImportRows([]);
    setImportError(null);
    setImportLoading(false);

    // Reload totals
    loadTotals();

    // Show result
    if (failCount === 0) {
      alert(`Successfully imported ${successCount} investment(s)`);
    } else {
      alert(`Imported: ${successCount} success, ${failCount} failed\n\nFailures:\n${failures.slice(0, 5).join('\n')}${failures.length > 5 ? '\n...' : ''}`);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowInvestmentModal(false);
    setInvestmentMode('SINGLE');
    setImportRows([]);
    setImportError(null);
    setImportLoading(false);
  };

  const handleInvestmentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      date: formData.get('date'),
      amount: parseFloat(formData.get('amount') as string),
      investorName: String(formData.get('investorName') || ''),
      receivedBy: String(formData.get('receivedBy') || ''),
      paymentMethod: String(formData.get('paymentMethod') || 'CASH'),
      note: formData.get('note') || null,
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/investments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (result.ok) {
        handleModalClose();
        loadTotals();
        (e.target as HTMLFormElement).reset();
      } else {
        alert(result.error || 'Failed to create investment');
      }
    } catch (err) {
      alert('Failed to create investment');
    }
  };


  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Error: {error}</div>;
  }

  if (!totals) {
    return <div className="text-center py-8">No data available</div>;
  }

  return (
    <div>
      <section className="mb-6 sm:mb-8">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">Project Financial Totals</h2>
        <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">Click any card to view or add entries</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {/* Purchases */}
        <div
          className="bg-white rounded-lg shadow-md p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-blue-200"
          onClick={handleViewPurchases}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Purchases</h3>
              <p className="text-lg sm:text-2xl font-bold text-blue-600">{formatCurrency(totals.purchases)}</p>
            </div>
            <div className="text-blue-500 text-3xl">📦</div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Materials/services purchased for this project.</p>
        </div>

        {/* Stock (Materials) */}
        <div
          className="bg-white rounded-lg shadow-md p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-green-200"
          onClick={handleViewStock}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Stock (Materials)</h3>
              <p className="text-lg sm:text-2xl font-bold text-green-600">{formatCurrency(totals.stocks)}</p>
            </div>
            <div className="text-green-500 text-3xl">📊</div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Value of materials received for this project.</p>
        </div>

        {/* Owner Funding */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-2 border-purple-200 flex flex-col gap-2">
          <div
            className="flex-1 cursor-pointer hover:opacity-90"
            onClick={handleAddInvestment}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Owner Funding</h3>
                <p className="text-lg sm:text-2xl font-bold text-purple-600">{formatCurrency(totals.investments)}</p>
              </div>
              <div className="text-purple-500 text-3xl">💰</div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Owner money added to fund this project.</p>
          </div>
          <Link
            href={`/dashboard/projects/${projectId}/investments`}
            className="w-full min-h-[40px] py-2 px-3 text-center text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 flex items-center justify-center"
          >
            View all investments
          </Link>
        </div>

        {/* Labor Cost — drill-down popover */}
        <div className="relative">
          <div
            className="bg-white rounded-lg shadow-md p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-orange-200"
            onClick={handleLaborCardClick}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Labor Cost</h3>
                <p className="text-lg sm:text-2xl font-bold text-orange-600">{formatCurrency(totals.labor)}</p>
              </div>
              <div className="text-orange-500 text-3xl">👷</div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Daily + monthly labor cost for this project.</p>
          </div>
          {showLaborPopover && (
            <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-white rounded-lg shadow-lg border border-orange-200 py-2 min-w-[220px]">
              <div className="px-4 py-2 border-b border-gray-100 font-medium text-gray-700">Labor by type</div>
              <Link
                href={`/dashboard/projects/${projectId}/labor/day`}
                className="block px-4 py-2 hover:bg-orange-50 text-orange-700"
                onClick={() => setShowLaborPopover(false)}
              >
                Day Labor — {formatCurrency(totals.laborByType?.DAY ?? 0)}
              </Link>
              <Link
                href={`/dashboard/projects/${projectId}/labor/monthly`}
                className="block px-4 py-2 hover:bg-orange-50 text-orange-700"
                onClick={() => setShowLaborPopover(false)}
              >
                Monthly Employee — {formatCurrency(totals.laborByType?.MONTHLY ?? 0)}
              </Link>
              <Link
                href={`/dashboard/projects/${projectId}/labor/contract`}
                className="block px-4 py-2 hover:bg-orange-50 text-orange-700"
                onClick={() => setShowLaborPopover(false)}
              >
                Contract Workers — {formatCurrency(totals.laborByType?.CONTRACT ?? 0)}
              </Link>
            </div>
          )}
        </div>

        {/* Expenses */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-2 border-red-200 flex flex-col gap-2">
          <Link
            href={`/dashboard/debit?projectId=${projectId}`}
            className="flex-1 block hover:opacity-90"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Expenses</h3>
                <p className="text-lg sm:text-2xl font-bold text-red-600">{formatCurrency(totals.debit)}</p>
              </div>
              <div className="text-red-500 text-3xl">📉</div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Money spent / expense vouchers (POSTED).</p>
          </Link>
          <Link
            href={`/dashboard/projects/${projectId}/debit/new`}
            className="w-full min-h-[40px] py-2 px-3 text-center text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 flex items-center justify-center"
          >
            Add Expense
          </Link>
        </div>

        {/* Receipts (Credit) */}
        <Link
          href={`/dashboard/credit?projectId=${projectId}`}
          className="bg-white rounded-lg shadow-md p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-indigo-200 block"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-1">Receipts (Credit)</h3>
              <p className="text-lg sm:text-2xl font-bold text-indigo-600">{formatCurrency(totals.credit)}</p>
            </div>
            <div className="text-indigo-500 text-3xl">📈</div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Credits recorded against this project (receipts/funding).</p>
        </Link>
      </div>
      </section>

      {/* Investment Modal */}
      {showInvestmentModal && (
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
              <form onSubmit={handleInvestmentSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
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
                  Investor Name
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
                  Received By
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
                  Payment Method
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
                  Amount
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
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
                >
                  Add Investment
                </button>
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
            ) : (
              <div>
                {/* File Upload */}
                <div className="mb-4">
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
                    Required columns: Date | Amount | InvestorName | ReceivedBy | PaymentMethod | Note (optional)
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
                              <td className="px-3 py-2 text-sm text-gray-500">
                                {row.note || '-'}
                              </td>
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
