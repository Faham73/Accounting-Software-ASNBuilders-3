'use client';

import { useState, useEffect } from 'react';
import { Vendor } from '../../components/types';

interface VendorsListProps {
  initialVendors: Vendor[];
  canWrite: boolean;
}

export default function VendorsList({ initialVendors, canWrite }: VendorsListProps) {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | null>(true);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    isActive: true,
  });

  const fetchVendors = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (activeFilter !== null) params.append('active', activeFilter.toString());

      const response = await fetch(`/api/vendors?${params.toString()}`);
      const data = await response.json();

      if (data.ok) {
        setVendors(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchVendors();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeFilter]);

  const handleSubmit = async (e: React.FormEvent, vendorId?: string) => {
    e.preventDefault();
    try {
      const url = vendorId ? `/api/vendors/${vendorId}` : '/api/vendors';
      const method = vendorId ? 'PATCH' : 'POST';

      const payload: any = {
        name: formData.name,
        phone: formData.phone || null,
        address: formData.address || null,
        notes: formData.notes || null,
        isActive: formData.isActive,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.ok) {
        setEditingId(null);
        setShowCreateForm(false);
        setFormData({ name: '', phone: '', address: '', notes: '', isActive: true });
        fetchVendors();
      } else {
        alert(data.error || 'Failed to save vendor');
      }
    } catch (error) {
      alert('An error occurred');
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingId(vendor.id);
    setFormData({
      name: vendor.name,
      phone: vendor.phone || '',
      address: vendor.address || '',
      notes: vendor.notes || '',
      isActive: vendor.isActive,
    });
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this vendor?')) return;
    try {
      const response = await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.ok) fetchVendors();
      else alert(data.error);
    } catch (error) {
      alert('An error occurred');
    }
  };

  return (
    <div>
      {/* Filters and Create Button */}
      <div className="mb-6 space-y-4 md:flex md:space-y-0 md:space-x-4 md:items-center">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <select
            value={activeFilter === null ? 'all' : activeFilter.toString()}
            onChange={(e) => {
              const value = e.target.value;
              setActiveFilter(value === 'all' ? null : value === 'true');
            }}
            className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="true">Active</option>
            <option value="false">Archived</option>
            <option value="all">All</option>
          </select>
        </div>
        {canWrite && (
          <button
            onClick={() => {
              setShowCreateForm(true);
              setEditingId(null);
              setFormData({ name: '', phone: '', address: '', notes: '', isActive: true });
            }}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            New Vendor
          </button>
        )}
      </div>

      {/* Create Form */}
      {canWrite && showCreateForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium mb-4">Create New Vendor</h3>
          <form onSubmit={(e) => handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormData({ name: '', phone: '', address: '', notes: '', isActive: true });
                }}
                className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Create Vendor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : vendors.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No vendors found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active
                </th>
                {canWrite && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vendors.map((vendor) => (
                <tr key={vendor.id}>
                  {editingId === vendor.id ? (
                    <>
                      <td colSpan={canWrite ? 5 : 4} className="px-6 py-4">
                        <form
                          onSubmit={(e) => handleSubmit(e, vendor.id)}
                          className="space-y-4"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Name <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) =>
                                  setFormData({ ...formData, name: e.target.value })
                                }
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                autoFocus
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Phone
                              </label>
                              <input
                                type="text"
                                value={formData.phone}
                                onChange={(e) =>
                                  setFormData({ ...formData, phone: e.target.value })
                                }
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700">
                                Address
                              </label>
                              <input
                                type="text"
                                value={formData.address}
                                onChange={(e) =>
                                  setFormData({ ...formData, address: e.target.value })
                                }
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-medium text-gray-700">
                                Notes
                              </label>
                              <textarea
                                value={formData.notes}
                                onChange={(e) =>
                                  setFormData({ ...formData, notes: e.target.value })
                                }
                                rows={2}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                              />
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={(e) =>
                                  setFormData({ ...formData, isActive: e.target.checked })
                                }
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-2 block text-sm text-gray-900">Active</label>
                            </div>
                          </div>
                          <div className="flex justify-end space-x-4">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setFormData({
                                  name: '',
                                  phone: '',
                                  address: '',
                                  notes: '',
                                  isActive: true,
                                });
                              }}
                              className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                            >
                              Save
                            </button>
                          </div>
                        </form>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          <a
                            href={`/dashboard/vendors/${vendor.id}/ledger`}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            {vendor.name}
                          </a>
                        </div>
                        {vendor.notes && (
                          <div className="text-sm text-gray-500">{vendor.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {vendor.phone || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{vendor.address || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            vendor.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {vendor.isActive ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      {canWrite && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleEdit(vendor)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleArchive(vendor.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Archive
                          </button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
