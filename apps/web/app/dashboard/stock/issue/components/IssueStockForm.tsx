'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface StockItem {
  id: string;
  name: string;
  unit: string;
  onHandQty: number;
}

interface Project {
  id: string;
  name: string;
}

export default function IssueStockForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    stockItemId: '',
    qty: '',
    projectId: '',
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
        console.log('[IssueStockForm] API response:', data);
        if (data.ok && data.data) {
          console.log('[IssueStockForm] Items received:', data.data.length);
          setStockItems(data.data);
        } else {
          console.error('[IssueStockForm] API error:', data.error);
          setItemsError(data.error || 'Failed to load stock items');
        }
      })
      .catch((error) => {
        console.error('[IssueStockForm] Fetch error:', error);
        setItemsError('Failed to load stock items');
      })
      .finally(() => {
        setIsLoadingItems(false);
      });

    // Fetch projects
    fetch('/api/projects?pageSize=1000')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setProjects(data.data);
        }
      });
  }, []);

  useEffect(() => {
    if (formData.stockItemId) {
      const item = stockItems.find((i) => i.id === formData.stockItemId);
      setSelectedItem(item || null);
    } else {
      setSelectedItem(null);
    }
  }, [formData.stockItemId, stockItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/stock/movements/out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockItemId: formData.stockItemId,
          qty: parseFloat(formData.qty),
          projectId: formData.projectId || null,
          notes: formData.notes || null,
          movementDate: formData.movementDate ? `${formData.movementDate}T00:00:00Z` : undefined,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        alert('Stock issued successfully!');
        router.push('/dashboard/stock');
      } else {
        alert(data.error || 'Failed to issue stock');
        setIsSubmitting(false);
      }
    } catch (error) {
      alert('An error occurred while issuing stock');
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
        ) : stockItems.length === 0 ? (
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
          <>
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
                  {item.name}{item.unit ? ` (${item.unit})` : ''} - Available: {(item.onHandQty || 0).toFixed(3)}
                </option>
              ))}
            </select>
            {selectedItem && (
              <p className="mt-1 text-sm text-gray-500">
                Available: {selectedItem.onHandQty.toFixed(3)} {selectedItem.unit}
              </p>
            )}
          </>
        )}
      </div>

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
          max={selectedItem ? selectedItem.onHandQty : undefined}
          value={formData.qty}
          onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
        {selectedItem && formData.qty && parseFloat(formData.qty) > selectedItem.onHandQty && (
          <p className="mt-1 text-sm text-red-600">
            Insufficient stock. Available: {selectedItem.onHandQty.toFixed(3)} {selectedItem.unit}
          </p>
        )}
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

      <div>
        <label htmlFor="projectId" className="block text-sm font-medium text-gray-700">
          Project
        </label>
        <select
          id="projectId"
          value={formData.projectId}
          onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
          disabled={isSubmitting || !!(selectedItem && formData.qty && parseFloat(formData.qty) > selectedItem.onHandQty)}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Issuing...' : 'Issue Stock'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
