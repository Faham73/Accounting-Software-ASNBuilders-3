'use client';

import { useState, FormEvent, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

type PurchaseLineType = 'MATERIAL' | 'SERVICE' | 'OTHER';

interface PurchaseLine {
  id?: string;
  lineType: PurchaseLineType; // Always 'MATERIAL' for new lines, kept for backwards compat
  stockItemId?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitRate?: number | null;
  description?: string | null;
  materialName?: string | null; // New: free text material name
  lineTotal: number;
}

interface PurchaseAttachment {
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
}

interface Purchase {
  id: string;
  date: string;
  challanNo: string | null;
  projectId: string;
  subProjectId: string | null;
  supplierVendorId: string;
  reference: string | null;
  discountPercent: number | null;
  paidAmount: number;
  paymentAccountId?: string | null;
  paymentMethod?: 'CASH' | 'BANK' | null;
  paymentAccount?: { code: string; name?: string } | null;
  lines: Array<{
    id: string;
    stockItemId: string | null;
    quantity: number | null;
    unit: string | null;
    unitRate: number | null;
    lineTotal: number;
    materialName?: string | null;
    stockItem?: { id: string; name: string; unit: string } | null;
  }>;
  attachments: PurchaseAttachment[];
}

interface PurchaseFormProps {
  purchase?: Purchase;
}

interface Project {
  id: string;
  name: string;
  isMain: boolean;
  parentProjectId: string | null;
}

interface StockItem {
  id: string;
  name: string;
  unit: string;
  category?: string | null;
}

interface Vendor {
  id: string;
  name: string;
}

function toDateInputValue(input: unknown): string {
  if (input == null) return '';
  if (typeof input === 'string') {
    if (!input) return '';
    if (input.includes('T')) return input.split('T')[0];
    return input.slice(0, 10);
  }
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return '';
    return input.toISOString().slice(0, 10);
  }
  return '';
}

export default function PurchaseForm({ purchase }: PurchaseFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);
  const [newVendorData, setNewVendorData] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });

  // Close Add Vendor modal on Escape
  useEffect(() => {
    if (!showAddVendorModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAddVendorModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showAddVendorModal]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [subProjects, setSubProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);

  // Get projectId and returnTo from URL if launched from project dashboard
  const projectIdFromUrl = searchParams.get('projectId') || '';
  const returnTo = searchParams.get('returnTo') || '';

  const [formData, setFormData] = useState({
    date: toDateInputValue(purchase?.date || new Date()),
    challanNo: purchase?.challanNo || '',
    projectId: purchase?.projectId || projectIdFromUrl || '',
    subProjectId: purchase?.subProjectId || '',
    supplierVendorId: purchase?.supplierVendorId || '',
    reference: purchase?.reference || '',
    discountPercent: purchase?.discountPercent?.toString() || '',
    paidAmount: purchase?.paidAmount?.toString() || '0',
    paymentAccountId: purchase?.paymentAccountId || '',
    paymentMethod: (() => {
      if (purchase?.paymentMethod) return purchase.paymentMethod;
      const code = purchase?.paymentAccount?.code;
      if (code === '1010') return 'CASH';
      if (code === '1020') return 'BANK';
      return Number(purchase?.paidAmount) > 0 ? 'CASH' : '';
    })(),
  });

  // Determine if project should be disabled (preselected from project dashboard)
  const isProjectPreselected = Boolean(projectIdFromUrl && !purchase);

  const [lines, setLines] = useState<PurchaseLine[]>(
    purchase?.lines.length
      ? purchase.lines.map((l: any) => ({
          id: l.id,
          lineType: (l.lineType || 'MATERIAL') as PurchaseLineType, // Default to MATERIAL
          stockItemId: l.stockItemId || null,
          quantity: l.quantity ? Number(l.quantity) : null,
          unit: l.unit || null,
          unitRate: l.unitRate ? Number(l.unitRate) : null,
          description: l.description || null,
          // For backwards compatibility: use materialName if present, else stockItem.name, else description
          materialName: l.materialName || l.stockItem?.name || l.description || null,
          lineTotal: Number(l.lineTotal),
        }))
      : [
          {
            lineType: 'MATERIAL' as PurchaseLineType,
            stockItemId: null,
            quantity: null,
            unit: null,
            unitRate: null,
            description: null,
            materialName: null,
            lineTotal: 0,
          },
        ]
  );

  const [attachments, setAttachments] = useState<PurchaseAttachment[]>(
    purchase?.attachments || []
  );

  // Fetch dropdown data and handle project preselection
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch projects
        const projectsRes = await fetch('/api/projects?status=all&active=all');
        const projectsData = await projectsRes.json();
        
        if (projectsData.ok) {
          const allProjects = projectsData.data;
          const mainProjects = allProjects.filter((p: Project) => p.isMain);
          setProjects(mainProjects);
          
          // Handle project preselection from URL
          if (projectIdFromUrl) {
            const selectedProject = allProjects.find((p: Project) => p.id === projectIdFromUrl);
            if (selectedProject) {
              if (selectedProject.isMain) {
                // It's a main project - set as main project and show its sub-projects
                setFormData((prev) => ({
                  ...prev,
                  projectId: projectIdFromUrl,
                  subProjectId: '',
                }));
                const subs = allProjects.filter(
                  (p: Project) => p.parentProjectId === projectIdFromUrl
                );
                setSubProjects(subs);
              } else {
                // It's a sub-project - set main project and sub-project
                setFormData((prev) => ({
                  ...prev,
                  projectId: selectedProject.parentProjectId || projectIdFromUrl,
                  subProjectId: projectIdFromUrl,
                }));
                const subs = allProjects.filter(
                  (p: Project) => p.parentProjectId === selectedProject.parentProjectId
                );
                setSubProjects(subs);
              }
            }
          } else if (formData.projectId) {
            // Handle existing projectId from formData (edit mode)
            const selectedProject = allProjects.find((p: Project) => p.id === formData.projectId);
            if (selectedProject) {
              const subs = allProjects.filter(
                (p: Project) => p.parentProjectId === formData.projectId
              );
              setSubProjects(subs);
            }
          }
        } else {
          console.error('Failed to fetch projects:', projectsData);
        }

        // Fetch vendors (active vendors by default)
        setIsLoadingVendors(true);
        try {
          const vendorsRes = await fetch('/api/vendors', {
            credentials: 'include',
          });
          const vendorsData = await vendorsRes.json();
          if (vendorsData.ok) {
            // Filter to active vendors on client side if needed
            const activeVendors = (vendorsData.data || []).filter((v: Vendor & { isActive?: boolean }) => v.isActive !== false);
            setVendors(activeVendors);
          } else {
            console.error('Failed to fetch vendors:', vendorsData);
            setError(vendorsData.error || 'Failed to load vendors');
          }
        } catch (err) {
          console.error('Failed to fetch vendors:', err);
          setError('Failed to load vendors. Please refresh the page.');
        } finally {
          setIsLoadingVendors(false);
        }

      } catch (err) {
        console.error('Failed to fetch dropdown data:', err);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdFromUrl]); // Only re-run if projectIdFromUrl changes


  // Update sub-projects when main project changes (only if not preselected)
  useEffect(() => {
    if (isProjectPreselected) {
      return; // Don't update if project is preselected
    }

    const fetchSubProjects = async () => {
      if (!formData.projectId) {
        setSubProjects([]);
        setFormData((prev) => ({ ...prev, subProjectId: '' }));
        return;
      }

      try {
        const response = await fetch('/api/projects?status=all&active=all');
        const data = await response.json();
        if (data.ok) {
          const subs = data.data.filter(
            (p: Project) => p.parentProjectId === formData.projectId
          );
          setSubProjects(subs);
          // Clear sub-project if it's not a child of the new main project
          if (formData.subProjectId && !subs.find((p: Project) => p.id === formData.subProjectId)) {
            setFormData((prev) => ({ ...prev, subProjectId: '' }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch sub-projects:', err);
      }
    };

    fetchSubProjects();
  }, [formData.projectId, isProjectPreselected]);

  const addLine = () => {
    setLines([
      ...lines,
      {
        lineType: 'MATERIAL', // Always MATERIAL for new lines
        stockItemId: null,
        quantity: null,
        unit: null,
        unitRate: null,
        description: null,
        materialName: null,
        lineTotal: 0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof PurchaseLine, value: any) => {
    const newLines = [...lines];
    const line = newLines[index];
    newLines[index] = { ...line, [field]: value };

    // Recalculate line total when quantity or unitRate changes
    if (field === 'quantity' || field === 'unitRate') {
      const quantity = field === 'quantity' ? (value || 0) : (line.quantity || 0);
      const unitRate = field === 'unitRate' ? (value || 0) : (line.unitRate || 0);
      newLines[index].lineTotal = quantity * unitRate;
    }

    setLines(newLines);
  };

  const calculateTotals = () => {
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const discount = formData.discountPercent
      ? (subtotal * parseFloat(formData.discountPercent)) / 100
      : 0;
    const total = subtotal - discount;
    const paid = parseFloat(formData.paidAmount) || 0;
    const due = total - paid;

    return { subtotal, discount, total, paid, due };
  };

  const handleFileUpload = async (file: File) => {
    // For now, we'll create a placeholder URL
    // In production, you'd upload to S3 or your file storage
    const formData = new FormData();
    formData.append('file', file);

    try {
      // If you have an upload endpoint, use it here
      // For now, create a mock attachment
      const attachment: PurchaseAttachment = {
        fileName: file.name,
        fileUrl: URL.createObjectURL(file), // Temporary URL
        mimeType: file.type,
        sizeBytes: file.size,
      };

      setAttachments([...attachments, attachment]);
    } catch (err) {
      console.error('File upload failed:', err);
      alert('Failed to upload file');
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.projectId) {
      setError('Main project is required');
      return;
    }
    if (!formData.supplierVendorId) {
      setError('Vendor is required');
      return;
    }
    if (lines.length === 0) {
      setError('At least one line item is required');
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // All lines are now MATERIAL - validate materialName, quantity, unitRate
      if (!line.materialName || line.materialName.trim() === '') {
        setError(`Line ${i + 1}: Material name is required`);
        return;
      }
      if (!line.quantity || line.quantity <= 0) {
        setError(`Line ${i + 1}: Quantity must be greater than 0`);
        return;
      }
      if (!line.unitRate || line.unitRate < 0) {
        setError(`Line ${i + 1}: Unit rate is required`);
        return;
      }
    }

    const { total, paid } = calculateTotals();
    if (paid > total) {
      setError('Paid amount cannot exceed total amount');
      return;
    }

    // Validate payment method is required when paid amount > 0
    if (paid > 0 && !formData.paymentMethod) {
      setError('Payment method (Cash or Bank) is required when paid amount > 0');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        date: formData.date,
        challanNo: formData.challanNo || null,
        projectId: formData.projectId,
        subProjectId: formData.subProjectId || null,
        supplierVendorId: formData.supplierVendorId,
        reference: formData.reference || null,
        discountPercent: formData.discountPercent ? parseFloat(formData.discountPercent) : null,
        paidAmount: parseFloat(formData.paidAmount) || 0,
        paymentAccountId: formData.paymentAccountId || null,
        lines: lines.map((line) => ({
          lineType: 'MATERIAL', // Always MATERIAL for new form
          stockItemId: null, // Not used in new form
          quantity: line.quantity || null,
          unit: line.unit || null,
          unitRate: line.unitRate || null,
          description: line.description || null, // Optional notes
          materialName: line.materialName || null,
          lineTotal: line.lineTotal,
        })),
        attachments: attachments,
      };

      const url = purchase ? `/api/purchases/${purchase.id}` : '/api/purchases';
      const method = purchase ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.ok) {
        // Navigate back to project purchases list if returnTo is provided, otherwise go to main purchases list
        if (returnTo) {
          router.push(returnTo);
        } else {
          router.push('/dashboard/purchases');
        }
        router.refresh();
      } else {
        setError(data.error || 'Failed to save purchase');
      }
    } catch (err) {
      setError('An error occurred while saving the purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const { subtotal, discount, total, paid, due } = calculateTotals();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Header Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Date *</label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="mt-1 block w-full min-h-[40px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Challan Number</label>
          <input
            type="text"
            value={formData.challanNo}
            onChange={(e) => setFormData({ ...formData, challanNo: e.target.value })}
            className="mt-1 block w-full min-h-[40px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Main Project *</label>
          <select
            required
            value={formData.projectId}
            onChange={(e) => setFormData({ ...formData, projectId: e.target.value, subProjectId: '' })}
            disabled={isProjectPreselected}
            className={`mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
              isProjectPreselected ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
            }`}
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {isProjectPreselected && (
            <p className="mt-1 text-xs text-gray-500">Project preselected from project dashboard</p>
          )}
          {projects.length === 0 && (
            <p className="mt-1 text-xs text-gray-500">No main projects found. Please create a main project first.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Sub Project</label>
          <select
            value={formData.subProjectId}
            onChange={(e) => setFormData({ ...formData, subProjectId: e.target.value })}
            disabled={isProjectPreselected || !formData.projectId || subProjects.length === 0}
            className={`mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
              isProjectPreselected || !formData.projectId || subProjects.length === 0
                ? 'bg-gray-100 cursor-not-allowed text-gray-500'
                : 'bg-white'
            }`}
          >
            <option value="">None</option>
            {subProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Vendor *</label>
            <button
              type="button"
              onClick={() => {
                setShowAddVendorModal(true);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add Vendor
            </button>
          </div>
          <select
            required
            value={formData.supplierVendorId}
            onChange={(e) => setFormData({ ...formData, supplierVendorId: e.target.value })}
            disabled={isLoadingVendors}
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">{isLoadingVendors ? 'Loading vendors...' : 'Select vendor'}</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {vendors.length === 0 && !isLoadingVendors && (
            <p className="mt-1 text-xs text-gray-500">No vendors found. Click "+ Add Vendor" to create one.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Reference</label>
          <input
            type="text"
            value={formData.reference}
            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
            className="mt-1 block w-full min-h-[40px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Line Items */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Line Items</h3>
          <button
            type="button"
            onClick={addLine}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Line Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lines.map((line, index) => (
                <tr key={index}>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      required
                      placeholder="Enter material name"
                      value={line.materialName || ''}
                      onChange={(e) => updateLine(index, 'materialName', e.target.value)}
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="number"
                      required
                      min="0.001"
                      step="0.001"
                      value={line.quantity || ''}
                      onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || null)}
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={line.unit || ''}
                      onChange={(e) => updateLine(index, 'unit', e.target.value)}
                      placeholder="Unit (e.g., Pcs, Kg)"
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={line.unitRate || ''}
                      onChange={(e) => updateLine(index, 'unitRate', parseFloat(e.target.value) || null)}
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="number"
                      readOnly
                      value={line.lineTotal.toFixed(2)}
                      className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 shadow-sm"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Discount (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formData.discountPercent}
              onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
              className="mt-1 block w-full min-h-[40px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Total Price</label>
            <input
              type="text"
              readOnly
              value={total.toFixed(2)}
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Paid Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.paidAmount}
              onChange={(e) => {
                const newPaidAmount = e.target.value;
                const paymentMethod = parseFloat(newPaidAmount) > 0 ? formData.paymentMethod : '';
                setFormData({ ...formData, paidAmount: newPaidAmount, paymentMethod });
              }}
              className="mt-1 block w-full min-h-[40px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Due Amount</label>
            <input
              type="text"
              readOnly
              value={due.toFixed(2)}
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
            />
          </div>
        </div>

        <div className="space-y-4">
          {parseFloat(formData.paidAmount) > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as 'CASH' | 'BANK' })}
                className={`mt-1 block w-full rounded-md border px-3 py-2 text-gray-900 shadow-sm focus:ring-2 focus:ring-blue-500 ${
                  !formData.paymentMethod
                    ? 'border-red-300 bg-red-50 focus:border-red-500'
                    : 'border-gray-300 bg-white focus:border-blue-500'
                }`}
              >
                <option value="">Select method</option>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Required when Paid Amount &gt; 0. Cash → 1010, Bank → 1020.
              </p>
              {!formData.paymentMethod && (
                <p className="mt-1 text-xs text-red-600">
                  Please select Cash or Bank
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Document Files</label>
            <input
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  Array.from(e.target.files).forEach((file) => handleFileUpload(file));
                }
              }}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attachments.map((att, index) => (
                  <li key={index} className="flex items-center justify-between text-sm">
                    <span>{att.fileName}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:justify-end">
        <button
          type="button"
          onClick={() => {
            if (returnTo) {
              router.push(returnTo);
            } else {
              router.back();
            }
          }}
          className="w-full sm:w-auto min-h-[40px] px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto min-h-[40px] px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : purchase ? 'Update' : 'Create'}
        </button>
      </div>

      {/* Add Vendor Modal - rendered via portal to avoid overflow/z-index issues */}
      {showAddVendorModal && (
        <Portal>
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
            onClick={() => setShowAddVendorModal(false)}
            role="presentation"
          >
            <div
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-vendor-title"
            >
            <h2 id="add-vendor-title" className="text-xl font-bold mb-4">Add New Vendor</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsCreatingVendor(true);
                try {
                  const normalize = (v: unknown) => {
                    if (v === null || v === undefined) return undefined;
                    if (typeof v === 'string') {
                      const t = v.trim();
                      return t === '' ? undefined : t;
                    }
                    return undefined;
                  };

                  const payload = {
                    name: (newVendorData.name ?? '').trim(),
                    phone: normalize(newVendorData.phone),
                    address: normalize(newVendorData.address),
                    notes: normalize(newVendorData.notes),
                    isActive: true,
                  };

                  const response = await fetch('/api/vendors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                  });

                  const data = await response.json();
                  if (data.ok) {
                    // Add new vendor to list and select it
                    const newVendor = data.data;
                    setVendors((prev) => [...prev, newVendor]);
                    setFormData((prev) => ({ ...prev, supplierVendorId: newVendor.id }));
                    setError(null); // Clear any prior "Vendor is required" (or other) error
                    setShowAddVendorModal(false);
                    setNewVendorData({ name: '', phone: '', address: '', notes: '' });
                  } else {
                    alert(data.error || 'Failed to create vendor');
                  }
                } catch (err) {
                  alert('Failed to create vendor');
                  console.error(err);
                } finally {
                  setIsCreatingVendor(false);
                }
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newVendorData.name}
                    onChange={(e) => setNewVendorData({ ...newVendorData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter vendor name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={newVendorData.phone}
                    onChange={(e) => setNewVendorData({ ...newVendorData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    value={newVendorData.address}
                    onChange={(e) => setNewVendorData({ ...newVendorData, address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={newVendorData.notes}
                    onChange={(e) => setNewVendorData({ ...newVendorData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Enter notes (optional)"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="submit"
                  disabled={isCreatingVendor}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCreatingVendor ? 'Creating...' : 'Create Vendor'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddVendorModal(false);
                    setNewVendorData({ name: '', phone: '', address: '', notes: '' });
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
            </div>
          </div>
        </Portal>
      )}
    </form>
  );
}
