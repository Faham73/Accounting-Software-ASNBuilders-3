'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface StockItem {
  id: string;
  name: string;
  unit: string;
}

interface Project {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
}

export default function ReceiveStockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);
  const [vendorFormData, setVendorFormData] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [formData, setFormData] = useState({
    stockItemId: '',
    qty: '',
    unitCost: '',
    projectId: searchParams.get('projectId') || '',
    vendorId: '',
    referenceType: '',
    referenceId: '',
    notes: '',
    movementDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    // Fetch stock items
    setIsLoadingItems(true);
    setItemsError(null);
    fetch('/api/stock/items?pageSize=1000&isActive=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setStockItems(data.data ?? []);
        } else {
          setItemsError(data.error || 'Failed to load stock items');
        }
      })
      .catch((error) => {
        const errMsg = error instanceof Error ? error.message : String(error);
        setItemsError(errMsg || 'Failed to load stock items');
      })
      .finally(() => {
        setIsLoadingItems(false);
      });

    // Fetch projects
    fetch('/api/projects?pageSize=1000')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setProjects(data.data ?? []);
        }
      })
      .catch(() => {
        // Silently fail for projects/vendors
      });

    // Fetch vendors
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      const res = await fetch('/api/vendors?pageSize=1000');
      const data = await res.json();
      if (data.ok) {
        setVendors(data.data ?? []);
      }
    } catch {
      // Silently fail for vendors
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingVendor(true);

    try {
      const response = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: vendorFormData.name,
          phone: vendorFormData.phone || undefined,
          address: vendorFormData.address || undefined,
          notes: vendorFormData.notes || undefined,
          isActive: true,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        // Refresh vendors list
        await loadVendors();
        // Auto-select the newly created vendor
        setFormData({ ...formData, vendorId: data.data.id });
        // Close modal and reset form
        setShowVendorModal(false);
        setVendorFormData({ name: '', phone: '', address: '', notes: '' });
      } else {
        alert(data.error || 'Failed to create vendor');
      }
    } catch (error) {
      alert('An error occurred while creating vendor');
    } finally {
      setIsCreatingVendor(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/stock/movements/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockItemId: formData.stockItemId,
          qty: parseFloat(formData.qty),
          unitCost: formData.unitCost ? parseFloat(formData.unitCost) : undefined,
          projectId: formData.projectId || null,
          vendorId: formData.vendorId || null,
          referenceType: formData.referenceType || undefined,
          referenceId: formData.referenceId || undefined,
          notes: formData.notes || null,
          movementDate: formData.movementDate ? `${formData.movementDate}T00:00:00Z` : undefined,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        alert('Stock received successfully!');
        // Redirect back to project dashboard if projectId exists, otherwise go to stock page
        const projectIdFromUrl = searchParams.get('projectId');
        if (projectIdFromUrl) {
          router.push(`/dashboard/projects/${projectIdFromUrl}`);
        } else {
          router.push('/dashboard/stock');
        }
      } else {
        alert(data.error || 'Failed to receive stock');
        setIsSubmitting(false);
      }
    } catch (error) {
      alert('An error occurred while receiving stock');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <label htmlFor="stockItemId" className="block text-sm font-medium text-gray-700">
          Stock Item *
        </label>
        {isLoadingItems ? (
          <div className="mt-1 text-sm text-gray-500">Loading items...</div>
        ) : itemsError ? (
          <div className="mt-1 text-sm text-red-600">
            {itemsError}
          </div>
        ) : (stockItems ?? []).length === 0 ? (
          <div className="mt-1 space-y-2">
            <div className="text-sm text-amber-600">
              No materials found. Create materials in Stock Items.
            </div>
            <Link
              href="/dashboard/stock/items/new"
              className="inline-block py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Create Materials
            </Link>
          </div>
        ) : (
          <select
            id="stockItemId"
            required
            value={formData.stockItemId}
            onChange={(e) => setFormData({ ...formData, stockItemId: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select item...</option>
            {stockItems.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}{item.unit ? ` (${item.unit})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="qty" className="block text-sm font-medium text-gray-700">
            Quantity *
          </label>
          <input
            type="number"
            id="qty"
            required
            step="0.001"
            min="0.001"
            value={formData.qty}
            onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="unitCost" className="block text-sm font-medium text-gray-700">
            Unit Cost
          </label>
          <input
            type="number"
            id="unitCost"
            step="0.01"
            min="0"
            value={formData.unitCost}
            onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="movementDate" className="block text-sm font-medium text-gray-700">
          Date *
        </label>
        <input
          type="date"
          id="movementDate"
          required
          value={formData.movementDate}
          onChange={(e) => setFormData({ ...formData, movementDate: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="projectId" className="block text-sm font-medium text-gray-700">
            Project
          </label>
          <select
            id="projectId"
            value={formData.projectId}
            onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
            disabled={!!searchParams.get('projectId')}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">None</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {searchParams.get('projectId') && (
            <p className="mt-1 text-xs text-gray-500">Project is locked for this session</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="vendorId" className="block text-sm font-medium text-gray-700">
              Vendor
            </label>
            <button
              type="button"
              onClick={() => setShowVendorModal(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add Vendor
            </button>
          </div>
          <select
            id="vendorId"
            value={formData.vendorId}
            onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">None</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="referenceType" className="block text-sm font-medium text-gray-700">
            Reference Type
          </label>
          <input
            type="text"
            id="referenceType"
            value={formData.referenceType}
            onChange={(e) => setFormData({ ...formData, referenceType: e.target.value })}
            placeholder="e.g., PURCHASE, VOUCHER"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="referenceId" className="block text-sm font-medium text-gray-700">
            Reference ID
          </label>
          <input
            type="text"
            id="referenceId"
            value={formData.referenceId}
            onChange={(e) => setFormData({ ...formData, referenceId: e.target.value })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="flex space-x-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Receiving...' : 'Receive Stock'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      {/* Add Vendor Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add Vendor</h2>
            <form onSubmit={handleCreateVendor}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  value={vendorFormData.name}
                  onChange={(e) =>
                    setVendorFormData({ ...vendorFormData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter vendor name"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={vendorFormData.phone}
                  onChange={(e) =>
                    setVendorFormData({ ...vendorFormData, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter phone number"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={vendorFormData.address}
                  onChange={(e) =>
                    setVendorFormData({ ...vendorFormData, address: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter address"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={vendorFormData.notes}
                  onChange={(e) =>
                    setVendorFormData({ ...vendorFormData, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Enter notes (optional)"
                />
              </div>
              <div className="flex gap-2">
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
                    setShowVendorModal(false);
                    setVendorFormData({ name: '', phone: '', address: '', notes: '' });
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </form>
  );
}
