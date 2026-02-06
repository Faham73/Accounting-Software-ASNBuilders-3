'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const normalizeName = (s: string) =>
  s.trim().replace(/\s+/g, ' ').toLowerCase();
const trimAndCollapse = (s: string) => s.trim().replace(/\s+/g, ' ');

function buildItemsByNormalizedName(items: { id: string; name: string }[]): Map<string, { id: string; name: string }> {
  return new Map(items.map((i) => [normalizeName(i.name), i]));
}

interface StockItem {
  id: string;
  name: string;
  unit: string;
  category?: string | null;
  isActive?: boolean;
}

interface OpeningStockRow {
  id: string;
  stockItemId?: string;
  nameInput: string;
  category: string;
  unit: string;
  qty: string;
  unitCost: string;
  notes: string;
  isNewItem?: boolean;
}

type ProcessedOpeningRow = OpeningStockRow & {
  resolvedName: string;
  parsedQty: number;
  parsedUnitCost: number;
};

interface ProjectStockSummary {
  totalQtyOnHand: number;
  totalStockValue: number;
  usedStockValue: number;
  remainingStockValue: number;
  wastageValue: number;
  usedPercentage: number;
  remainingPercentage: number;
}

interface ProjectStockItemBreakdown {
  stockItemId: string;
  stockItemName: string;
  stockItemUnit: string;
  openingQty: number;
  openingValue: number;
  receivedQty: number;
  receivedValue: number;
  issuedQty: number;
  issuedValue: number;
  wastageQty: number;
  wastageValue: number;
  remainingQty: number;
  avgRate: number;
  totalValue: number;
  minQty: number | null;
  isLowStock: boolean;
}

interface ProjectStockOverview {
  summary: ProjectStockSummary;
  items: ProjectStockItemBreakdown[];
}

interface ProjectStockClientProps {
  projectId: string;
  projectName: string;
}

export default function ProjectStockClient({
  projectId,
  projectName,
}: ProjectStockClientProps) {
  const [overview, setOverview] = useState<ProjectStockOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showWastageModal, setShowWastageModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showMovementHistory, setShowMovementHistory] = useState(false);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  
  // Opening stock bulk table state
  const [openingMode, setOpeningMode] = useState<'quick' | 'existing'>('quick');
  const [openingDate, setOpeningDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [openingRows, setOpeningRows] = useState<OpeningStockRow[]>([]);
  const [openingExistingWarningAcknowledged, setOpeningExistingWarningAcknowledged] = useState(false);
  const [existingOpeningStockExists, setExistingOpeningStockExists] = useState(false);
  const [isSavingOpening, setIsSavingOpening] = useState(false);
  const [materialSearchTerm, setMaterialSearchTerm] = useState<Record<string, string>>({});

  useEffect(() => {
    loadOverview();
    loadStockItems();
  }, [projectId]);

  useEffect(() => {
    if (showOpeningModal) {
      checkExistingOpeningStock();
      // Initialize with one empty row
      if (openingRows.length === 0) {
        addOpeningRow();
      }
    }
  }, [showOpeningModal]);

  const checkExistingOpeningStock = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/stock/opening`);
      const data = await response.json();
      if (data.ok) {
        setExistingOpeningStockExists(data.data.exists);
        if (data.data.openingDate) {
          setOpeningDate(data.data.openingDate);
        }
        if (data.data.lines && data.data.lines.length > 0) {
          // Pre-populate rows with existing data
          setOpeningRows(
            data.data.lines.map((line: any, index: number) => ({
              id: `existing-${index}`,
              stockItemId: line.stockItemId,
              nameInput: line.stockItemName,
              category: line.category || '',
              unit: line.unit,
              qty: line.qty.toString(),
              unitCost: line.unitCost.toString(),
              notes: line.notes || '',
            }))
          );
        }
      }
    } catch {
      // Silently fail
    }
  };

  const addOpeningRow = () => {
    setOpeningRows([
      ...openingRows,
      {
        id: `row-${Date.now()}-${Math.random()}`,
        nameInput: '',
        category: '',
        unit: 'Bag',
        qty: '',
        unitCost: '',
        notes: '',
      },
    ]);
  };

  const removeOpeningRow = (rowId: string) => {
    setOpeningRows(openingRows.filter((row) => row.id !== rowId));
    const newSearchTerms = { ...materialSearchTerm };
    delete newSearchTerms[rowId];
    setMaterialSearchTerm(newSearchTerms);
  };

  const updateOpeningRow = (rowId: string, updates: Partial<OpeningStockRow>) => {
    setOpeningRows(
      openingRows.map((row) => (row.id === rowId ? { ...row, ...updates } : row))
    );
  };

  const createStockItem = async (name: string, unit: string, category: string): Promise<string> => {
    const payload = {
      name: trimAndCollapse(name),
      unit: (unit || 'Piece').trim(),
      category: (category || null) as string | null,
      isActive: true,
    };

    const response = await fetch('/api/stock/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      const text = await response.text();
      throw new Error(`Failed to create item "${payload.name}" (HTTP ${response.status}): ${text || 'Non-JSON response'}`);
    }

    if (data?.ok) {
      await loadStockItems();
      return data.data.id as string;
    }

    const apiError = data?.error ? String(data.error) : 'Unknown error';
    const apiErrorLower = apiError.toLowerCase();
    const isAlreadyExists =
      (response.status === 400 || response.status === 409) &&
      (apiErrorLower.includes('already exists') || apiErrorLower.includes('already exits'));

    if (isAlreadyExists) {
      const fresh = await fetch('/api/stock/items?pageSize=1000&isActive=true').then((r) => r.json());
      const items: StockItem[] = fresh?.ok ? fresh.data ?? [] : [];
      const map = buildItemsByNormalizedName(items);
      const existing = map.get(normalizeName(payload.name));
      if (existing) {
        setStockItems(items);
        return existing.id;
      }
      throw new Error(
        `Item "${payload.name}" already exists but could not be found. Please select it from the dropdown.`
      );
    }

    throw new Error(`Failed to create item "${payload.name}" (HTTP ${response.status}): ${apiError}`);
  };

  const loadOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/projects/${projectId}/stock/overview`);
      const data = await response.json();
      if (data.ok) {
        setOverview(data.data);
      } else {
        setError(data.error || 'Failed to load stock overview');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock overview');
    } finally {
      setLoading(false);
    }
  };

  const loadStockItems = async () => {
    try {
      const res = await fetch('/api/stock/items?pageSize=1000&isActive=true');
      const data = await res.json();
      if (data.ok) {
        setStockItems(data.data ?? []);
      }
    } catch {
      // Silently fail
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number, decimals = 3) => {
    return num.toLocaleString('en-BD', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const handleOpeningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (existingOpeningStockExists && !openingExistingWarningAcknowledged) {
      alert('Please acknowledge that you understand this will replace existing opening stock');
      return;
    }

    setIsSavingOpening(true);

    try {
      // Step 1: Auto-resolve/create StockItems for all rows with material names
      const rowsToProcess = openingRows.filter((row) => {
        const n = normalizeName(row.nameInput ?? '');
        return n.length > 0;
      });

      if (rowsToProcess.length === 0) {
        alert('Please add at least one row with a material name');
        setIsSavingOpening(false);
        return;
      }

      const processedRows: ProcessedOpeningRow[] = [];
      const resolveErrors: string[] = [];
      let currentStockItems = [...stockItems];

      const fetchStockItems = async (): Promise<StockItem[]> => {
        const res = await fetch('/api/stock/items?pageSize=1000&isActive=true');
        const d = await res.json();
        return d?.ok ? (d.data ?? []) : [];
      };

      for (const row of rowsToProcess) {
        try {
          const normalizedName = normalizeName(row.nameInput);
          let stockItemId = row.stockItemId;
          let resolvedName = trimAndCollapse(row.nameInput) || normalizedName;

          if (!stockItemId && openingMode === 'quick') {
            const map = buildItemsByNormalizedName(currentStockItems);
            const existing = map.get(normalizedName);

            if (existing) {
              stockItemId = existing.id;
              resolvedName = existing.name;
            } else {
              const newItemId = await createStockItem(
                trimAndCollapse(row.nameInput),
                row.unit || 'Piece',
                row.category || 'Construction'
              );
              stockItemId = newItemId;
              currentStockItems = await fetchStockItems();
              setStockItems(currentStockItems);
              const newItem = currentStockItems.find((i) => i.id === newItemId);
              if (newItem) resolvedName = newItem.name;
            }
          } else if (!stockItemId && openingMode === 'existing') {
            throw new Error(`Please select an existing item for: ${resolvedName}`);
          }

          // Parse numeric values safely
          const qty = parseFloat(String(row.qty || '0'));
          const unitCost = parseFloat(String(row.unitCost || '0'));

          processedRows.push({
            ...row,
            stockItemId,
            resolvedName,
            parsedQty: qty,
            parsedUnitCost: unitCost,
          });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          resolveErrors.push(`Row "${row.nameInput}": ${errorMsg}`);
        }
      }

      // If there are resolve errors, show them and stop
      if (resolveErrors.length > 0) {
        alert(`Failed to resolve/create items:\n\n${resolveErrors.join('\n')}`);
        setIsSavingOpening(false);
        return;
      }

      // Step 2: Validate resolved rows
      const rowErrors: Record<string, string[]> = {};
      const validRows: Array<{
        stockItemId: string;
        qty: number;
        unitCost: number;
        notes: string;
        category?: string;
        unit?: string;
      }> = [];

      for (const row of processedRows) {
        const errors: string[] = [];

        if (!row.stockItemId) {
          errors.push('Material must be selected or created');
        }
        if (!row.unit || row.unit.trim() === '') {
          errors.push('Unit is required');
        }
        if (isNaN(row.parsedQty) || row.parsedQty <= 0) {
          errors.push('Quantity must be greater than 0');
        }
        if (isNaN(row.parsedUnitCost) || row.parsedUnitCost < 0) {
          errors.push('Unit cost must be 0 or greater');
        }

        if (errors.length > 0) {
          rowErrors[row.id] = errors;
        } else {
          validRows.push({
            stockItemId: row.stockItemId!,
            qty: row.parsedQty,
            unitCost: row.parsedUnitCost,
            notes: row.notes || '',
            category: row.category,
            unit: row.unit,
          });
        }
      }

      // Step 3: Check if we have any valid rows
      if (validRows.length === 0) {
        const errorMessages = Object.entries(rowErrors)
          .map(([rowId, errors]) => {
            const row = processedRows.find((r) => r.id === rowId);
            return `Row "${row?.resolvedName || rowId}": ${errors.join(', ')}`;
          })
          .join('\n');
        
        alert(`Please fix the following errors:\n\n${errorMessages}`);
        setIsSavingOpening(false);
        return;
      }

      // Step 4: Client-side duplicate merge
      const mergedRows = new Map<string, typeof validRows[0]>();
      for (const row of validRows) {
        const existing = mergedRows.get(row.stockItemId);
        if (existing) {
          const totalQty = existing.qty + row.qty;
          const totalValue = existing.qty * existing.unitCost + row.qty * row.unitCost;
          existing.qty = totalQty;
          existing.unitCost = totalQty > 0 ? totalValue / totalQty : 0;
          if (row.notes && !existing.notes) {
            existing.notes = row.notes;
          } else if (row.notes && existing.notes) {
            existing.notes = `${existing.notes}; ${row.notes}`;
          }
        } else {
          mergedRows.set(row.stockItemId, { ...row });
        }
      }

      const lines = Array.from(mergedRows.values());

      // Step 5: Submit to API
      const response = await fetch(`/api/projects/${projectId}/stock/opening`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openingDate,
          lines,
          replaceExisting: existingOpeningStockExists,
        }),
      });

      const result = await response.json();
      if (result.ok) {
        setShowOpeningModal(false);
        setOpeningRows([]);
        setOpeningExistingWarningAcknowledged(false);
        setMaterialSearchTerm({});
        loadOverview();
        alert(`Successfully saved ${lines.length} opening stock item(s)`);
      } else {
        alert(result.error || 'Failed to save opening stock');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save opening stock';
      alert(`Error: ${errorMessage}`);
      console.error('Opening stock save error:', err);
    } finally {
      setIsSavingOpening(false);
    }
  };

  const handleIssueSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      stockItemId: formData.get('stockItemId'),
      qty: parseFloat(formData.get('qty') as string),
      movementDate: formData.get('movementDate') || new Date().toISOString().split('T')[0],
      notes: formData.get('notes') || null,
      meta: formData.get('meta') ? JSON.parse(formData.get('meta') as string) : null,
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/stock/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (result.ok) {
        setShowIssueModal(false);
        loadOverview();
        (e.target as HTMLFormElement).reset();
      } else {
        alert(result.error || 'Failed to issue stock');
      }
    } catch (err) {
      alert('Failed to issue stock');
    }
  };

  const handleWastageSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      stockItemId: formData.get('stockItemId'),
      qty: parseFloat(formData.get('qty') as string),
      movementDate: formData.get('movementDate') || new Date().toISOString().split('T')[0],
      reason: formData.get('reason'),
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/stock/wastage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (result.ok) {
        setShowWastageModal(false);
        loadOverview();
        (e.target as HTMLFormElement).reset();
      } else {
        alert(result.error || 'Failed to record wastage');
      }
    } catch (err) {
      alert('Failed to record wastage');
    }
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      stockItemId: formData.get('stockItemId'),
      qty: parseFloat(formData.get('qty') as string),
      unitCost: formData.get('unitCost') ? parseFloat(formData.get('unitCost') as string) : undefined,
      movementDate: formData.get('movementDate') || new Date().toISOString().split('T')[0],
      reason: formData.get('reason'),
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/stock/adjustment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (result.ok) {
        setShowAdjustmentModal(false);
        loadOverview();
        (e.target as HTMLFormElement).reset();
      } else {
        alert(result.error || 'Failed to record adjustment');
      }
    } catch (err) {
      alert('Failed to record adjustment');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading stock overview...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Error: {error}</div>;
  }

  if (!overview) {
    return <div className="text-center py-8">No data available</div>;
  }

  const lowStockCount = overview.items.filter((item) => item.isLowStock).length;

  return (
    <div className="space-y-6">
      {/* Valuation Method Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <p className="text-sm text-blue-800">
          <strong>Valuation Method:</strong> Stock value calculated using Weighted Average Rate
        </p>
      </div>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
          <p className="text-sm text-amber-800">
            <strong>Low Stock Alert:</strong> {lowStockCount} item(s) are below minimum quantity threshold
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-blue-200">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Quantity</h3>
          <p className="text-2xl font-bold text-blue-600">{formatNumber(overview.summary.totalQtyOnHand)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-green-200">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Stock Value</h3>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(overview.summary.totalStockValue)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-orange-200">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Used Stock Value</h3>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(overview.summary.usedStockValue)}</p>
          <p className="text-xs text-gray-500 mt-1">{overview.summary.usedPercentage.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-purple-200">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Remaining Stock Value</h3>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(overview.summary.remainingStockValue)}</p>
          <p className="text-xs text-gray-500 mt-1">{overview.summary.remainingPercentage.toFixed(1)}%</p>
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowOpeningModal(true)}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Add Opening Stock
        </button>
        <Link
          href={`/dashboard/stock/receive?projectId=${projectId}`}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          Receive Stock
        </Link>
        <button
          onClick={() => setShowIssueModal(true)}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Issue Stock
        </button>
        <button
          onClick={() => setShowWastageModal(true)}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Wastage / Adjustment
        </button>
        <button
          onClick={() => setShowMovementHistory(!showMovementHistory)}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          {showMovementHistory ? 'Hide' : 'Show'} Movement History
        </button>
      </div>

      {/* Material-wise Breakdown Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Material-wise Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Material
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Opening Qty
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Received Qty
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issued Qty
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Remaining Qty
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Rate
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Value
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {overview.items.map((item) => (
                <tr
                  key={item.stockItemId}
                  className={`hover:bg-gray-50 ${item.isLowStock ? 'bg-amber-50' : ''}`}
                  onClick={() => {
                    setSelectedItemId(item.stockItemId);
                    setShowMovementHistory(true);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.stockItemName}
                    {item.stockItemUnit && (
                      <span className="text-gray-500 ml-1">({item.stockItemUnit})</span>
                    )}
                    {item.isLowStock && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        Low Stock
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatNumber(item.openingQty)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatNumber(item.receivedQty)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatNumber(item.issuedQty)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    {formatNumber(item.remainingQty)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(item.avgRate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(item.totalValue)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-6 py-3 text-sm font-medium text-gray-900">Total:</td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {formatNumber(overview.items.reduce((sum, item) => sum + item.openingQty, 0))}
                </td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {formatNumber(overview.items.reduce((sum, item) => sum + item.receivedQty, 0))}
                </td>
                <td className="px-6 py-3 text-sm text-gray-900 text-right">
                  {formatNumber(overview.items.reduce((sum, item) => sum + item.issuedQty, 0))}
                </td>
                <td className="px-6 py-3 text-sm font-bold text-gray-900 text-right">
                  {formatNumber(overview.items.reduce((sum, item) => sum + item.remainingQty, 0))}
                </td>
                <td className="px-6 py-3"></td>
                <td className="px-6 py-3 text-sm font-bold text-gray-900 text-right">
                  {formatCurrency(overview.items.reduce((sum, item) => sum + item.totalValue, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Movement History Section */}
      {showMovementHistory && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Movement History</h2>
          <MovementHistory projectId={projectId} stockItemId={selectedItemId} />
        </div>
      )}

      {/* Opening Stock Modal - Bulk Table */}
      {showOpeningModal && (
        <Modal
          title="Add Opening Stock"
          onClose={() => {
            setShowOpeningModal(false);
            setOpeningRows([]);
            setOpeningExistingWarningAcknowledged(false);
            setMaterialSearchTerm({});
          }}
        >
          <form onSubmit={handleOpeningSubmit} className="space-y-4">
            {/* Mode Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opening Stock Entry Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="openingMode"
                    value="quick"
                    checked={openingMode === 'quick'}
                    onChange={(e) => setOpeningMode(e.target.value as 'quick' | 'existing')}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    Quick Entry <span className="text-green-600">(Recommended)</span>
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="openingMode"
                    value="existing"
                    checked={openingMode === 'existing'}
                    onChange={(e) => setOpeningMode(e.target.value as 'quick' | 'existing')}
                    className="mr-2"
                  />
                  <span className="text-sm">Select Existing Items Only</span>
                </label>
              </div>
            </div>

            {/* Global Opening Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opening Stock Date *
              </label>
              <input
                type="date"
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* Existing Opening Stock Warning */}
            {existingOpeningStockExists && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <div className="flex items-start">
                  <span className="text-amber-600 mr-2">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm text-amber-800 mb-2">
                      Opening stock already exists for this project. Saving will REPLACE existing opening stock entries.
                    </p>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={openingExistingWarningAcknowledged}
                        onChange={(e) => setOpeningExistingWarningAcknowledged(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-amber-800">
                        I understand this will replace existing opening stock
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Bulk Table */}
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Material Name *
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Category
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Unit *
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Quantity *
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Unit Cost *
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Notes
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-12">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {openingRows.map((row) => (
                      <OpeningStockRowComponent
                        key={row.id}
                        row={row}
                        stockItems={stockItems}
                        openingMode={openingMode}
                        searchTerm={materialSearchTerm[row.id] || ''}
                        onUpdate={(updates) => updateOpeningRow(row.id, updates)}
                        onRemove={() => removeOpeningRow(row.id)}
                        onSearchChange={(term) =>
                          setMaterialSearchTerm({ ...materialSearchTerm, [row.id]: term })
                        }
                        onCreateItem={createStockItem}
                      />
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-sm font-medium text-gray-900">
                        Total:
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        {formatNumber(
                          openingRows.reduce(
                            (sum, row) => sum + (parseFloat(row.qty) || 0),
                            0
                          )
                        )}
                      </td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                        {formatCurrency(
                          openingRows.reduce(
                            (sum, row) =>
                              sum +
                              (parseFloat(row.qty) || 0) * (parseFloat(row.unitCost) || 0),
                            0
                          )
                        )}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Add Row Button */}
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={addOpeningRow}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add Row
              </button>
              <div className="text-sm text-gray-500">
                {(() => {
                  // Count rows that have material name and basic fields filled
                  // This is a relaxed check - actual validation happens on submit
                  const readyCount = openingRows.filter((row) => {
                    const hasName = row.nameInput?.trim().length > 0;
                    const hasUnit = row.unit && row.unit.trim().length > 0;
                    const hasQty = row.qty && parseFloat(String(row.qty)) > 0;
                    const hasUnitCost = row.unitCost !== '' && !isNaN(parseFloat(String(row.unitCost))) && parseFloat(String(row.unitCost)) >= 0;
                    return hasName && hasUnit && hasQty && hasUnitCost;
                  }).length;
                  return `${readyCount} item(s) ready`;
                })()}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <button
                type="submit"
                disabled={isSavingOpening || (existingOpeningStockExists && !openingExistingWarningAcknowledged)}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingOpening ? 'Saving...' : 'Save Opening Stock'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOpeningModal(false);
                  setOpeningRows([]);
                  setOpeningExistingWarningAcknowledged(false);
                  setMaterialSearchTerm({});
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Issue Stock Modal */}
      {showIssueModal && (
        <Modal
          title="Issue Stock"
          onClose={() => setShowIssueModal(false)}
        >
          <form onSubmit={handleIssueSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Item *
              </label>
              <select
                name="stockItemId"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select item...</option>
                {stockItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity *
              </label>
              <input
                type="number"
                name="qty"
                required
                step="0.001"
                min="0.001"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                name="movementDate"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks
              </label>
              <textarea
                name="notes"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Issue Stock
              </button>
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Wastage Modal */}
      {showWastageModal && (
        <Modal
          title="Record Wastage"
          onClose={() => setShowWastageModal(false)}
        >
          <form onSubmit={handleWastageSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Item *
              </label>
              <select
                name="stockItemId"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select item...</option>
                {stockItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity *
              </label>
              <input
                type="number"
                name="qty"
                required
                step="0.001"
                min="0.001"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                name="movementDate"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason * (required for wastage)
              </label>
              <textarea
                name="reason"
                required
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Explain the reason for wastage..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Record Wastage
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowWastageModal(false);
                  setShowAdjustmentModal(true);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Switch to Adjustment
              </button>
              <button
                type="button"
                onClick={() => setShowWastageModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Adjustment Modal */}
      {showAdjustmentModal && (
        <Modal
          title="Stock Adjustment"
          onClose={() => setShowAdjustmentModal(false)}
        >
          <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Item *
              </label>
              <select
                name="stockItemId"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select item...</option>
                {stockItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity * (+/-)
                </label>
                <input
                  type="number"
                  name="qty"
                  required
                  step="0.001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Positive or negative"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Cost (optional)
                </label>
                <input
                  type="number"
                  name="unitCost"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                name="movementDate"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason * (required for adjustment)
              </label>
              <textarea
                name="reason"
                required
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Explain the reason for adjustment..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Record Adjustment
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdjustmentModal(false);
                  setShowWastageModal(true);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Switch to Wastage
              </button>
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Opening Stock Row Component
function OpeningStockRowComponent({
  row,
  stockItems,
  openingMode,
  searchTerm,
  onUpdate,
  onRemove,
  onSearchChange,
  onCreateItem,
}: {
  row: OpeningStockRow;
  stockItems: StockItem[];
  openingMode: 'quick' | 'existing';
  searchTerm: string;
  onUpdate: (updates: Partial<OpeningStockRow>) => void;
  onRemove: () => void;
  onSearchChange: (term: string) => void;
  onCreateItem: (name: string, unit: string, category: string) => Promise<string>;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  const filteredItems = stockItems.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const hasExactMatch = stockItems.some(
    (item) => item.name.toLowerCase() === searchTerm.toLowerCase()
  );
  const showCreateOption = openingMode === 'quick' && searchTerm && !hasExactMatch && !row.stockItemId;

  const handleMaterialSelect = (item: StockItem) => {
    onUpdate({
      stockItemId: item.id,
      nameInput: item.name,
      unit: item.unit,
      category: item.category || '',
    });
    setShowDropdown(false);
    onSearchChange('');
  };

  const handleCreateNew = async () => {
    if (!searchTerm.trim()) return;
    setIsCreating(true);
    try {
      const newItemId = await onCreateItem(searchTerm.trim(), row.unit, row.category);
      onUpdate({
        stockItemId: newItemId,
        nameInput: searchTerm.trim(),
      });
      setShowDropdown(false);
      onSearchChange('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const total = (parseFloat(row.qty) || 0) * (parseFloat(row.unitCost) || 0);

  const commonUnits = ['Bag', 'Ton', 'CFT', 'KG', 'Piece'];

  return (
    <tr>
      <td className="px-3 py-2">
        <div className="relative" ref={dropdownRef}>
          {openingMode === 'quick' ? (
            <>
              <input
                type="text"
                value={row.nameInput}
                onChange={(e) => {
                  onUpdate({ nameInput: e.target.value });
                  onSearchChange(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Type material name..."
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
              />
              {showDropdown && (filteredItems.length > 0 || showCreateOption) && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleMaterialSelect(item)}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                    >
                      {item.name} ({item.unit})
                    </div>
                  ))}
                  {showCreateOption && (
                    <div
                      onClick={handleCreateNew}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-blue-600 font-medium border-t border-gray-200"
                    >
                      {isCreating ? 'Creating...' : `+ Create new item: ${searchTerm}`}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <select
              value={row.stockItemId || ''}
              onChange={(e) => {
                const selected = stockItems.find((item) => item.id === e.target.value);
                if (selected) {
                  handleMaterialSelect(selected);
                }
              }}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
            >
              <option value="">Select item...</option>
              {stockItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.unit})
                </option>
              ))}
            </select>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={row.category}
          onChange={(e) => onUpdate({ category: e.target.value })}
          placeholder="Category"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <select
            value={row.unit}
            onChange={(e) => onUpdate({ unit: e.target.value })}
            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md"
          >
            {commonUnits.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={commonUnits.includes(row.unit) ? '' : row.unit}
            onChange={(e) => onUpdate({ unit: e.target.value })}
            placeholder="Custom"
            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md"
            onFocus={(e) => {
              if (commonUnits.includes(row.unit)) {
                e.target.value = '';
                onUpdate({ unit: '' });
              }
            }}
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={row.qty}
          onChange={(e) => onUpdate({ qty: e.target.value })}
          step="0.001"
          min="0.001"
          placeholder="0.000"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md text-right"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={row.unitCost}
          onChange={(e) => onUpdate({ unitCost: e.target.value })}
          step="0.01"
          min="0"
          placeholder="0.00"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md text-right"
        />
      </td>
      <td className="px-3 py-2 text-sm text-gray-900 text-right">
        {total > 0 ? (
          new Intl.NumberFormat('en-BD', {
            style: 'currency',
            currency: 'BDT',
            minimumFractionDigits: 2,
          }).format(total)
        ) : (
          '-'
        )}
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={row.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Notes"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          onClick={onRemove}
          className="text-red-600 hover:text-red-800 text-sm font-medium"
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

// Modal Component
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Movement History Component
function MovementHistory({
  projectId,
  stockItemId,
}: {
  projectId: string;
  stockItemId?: string;
}) {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMovements();
  }, [projectId, stockItemId]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (stockItemId) {
        params.append('stockItemId', stockItemId);
      }
      const response = await fetch(`/api/projects/${projectId}/stock/movements?${params.toString()}`);
      const data = await response.json();
      if (data.ok) {
        setMovements(data.data ?? []);
      }
    } catch (err) {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return <div className="text-center py-4">Loading movements...</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td className="px-4 py-2 text-sm text-gray-900">{formatDate(movement.movementDate)}</td>
              <td className="px-4 py-2 text-sm text-gray-900">
                {movement.movementKind || movement.type}
              </td>
              <td className="px-4 py-2 text-sm text-gray-900">
                {movement.stockItem?.name}
              </td>
              <td className="px-4 py-2 text-sm text-gray-900 text-right">
                {movement.qty.toLocaleString('en-BD', { minimumFractionDigits: 3 })}
              </td>
              <td className="px-4 py-2 text-sm text-gray-900 text-right">
                {movement.unitCost ? formatCurrency(movement.qty * movement.unitCost) : '-'}
              </td>
              <td className="px-4 py-2 text-sm text-gray-500">
                {movement.createdBy?.name || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
