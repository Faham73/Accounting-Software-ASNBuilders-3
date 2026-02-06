'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getPurchaseMaterialsLabel } from '@/lib/purchases/materialsDisplay';

interface PurchaseLineForList {
  lineType: 'MATERIAL' | 'SERVICE' | 'OTHER';
  materialName?: string | null;
  description?: string | null;
  stockItem?: { name: string } | null;
}

interface Purchase {
  id: string;
  date: string;
  challanNo: string | null;
  reference: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'REVERSED';
  total: number;
  paidAmount: number;
  dueAmount: number;
  project: { id: string; name: string };
  subProject: { id: string; name: string } | null;
  supplierVendor: { id: string; name: string };
  voucher: { id: string; voucherNo: string } | null;
  lines: PurchaseLineForList[];
  _count: { attachments: number };
}

interface Project {
  id: string;
  name: string;
  isMain: boolean;
  parentProjectId: string | null;
}

interface ProjectPurchasesListProps {
  projectId: string;
  project: Project;
  canWrite: boolean;
}

export default function ProjectPurchasesList({
  projectId,
  project,
  canWrite,
}: ProjectPurchasesListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    dateFrom: '',
    dateTo: '',
    supplierId: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totals, setTotals] = useState({ total: 0, paid: 0, due: 0 });

  const fetchPurchases = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.supplierId) params.append('supplierId', filters.supplierId);
      
      // Filter by projectId (main project) or subProjectId (sub-project)
      if (project.isMain) {
        params.append('projectId', projectId);
      } else {
        // For sub-projects, filter by parent projectId and subProjectId
        if (project.parentProjectId) {
          params.append('projectId', project.parentProjectId);
        }
        params.append('subProjectId', projectId);
      }
      
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      const response = await fetch(`/api/purchases?${params.toString()}`);
      const data = await response.json();

      if (data.ok) {
        setPurchases(data.data);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages);
        }
        if (data.totals) {
          setTotals(data.totals);
        }
      }
    } catch (error) {
      console.error('Failed to fetch purchases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [filters.search, filters.dateFrom, filters.dateTo, filters.supplierId, page, pageSize]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this purchase? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/purchases/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.ok) {
        fetchPurchases();
      } else {
        alert(data.error || 'Failed to delete purchase');
      }
    } catch (error) {
      alert('An error occurred while deleting the purchase');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div>
      {/* Project Info Banner */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-900">
          Showing purchases for: <span className="font-bold">{project.name}</span>
        </h2>
        {project.isMain && (
          <p className="text-sm text-blue-700 mt-1">
            Includes all purchases for this main project and its sub-projects
          </p>
        )}
        {!project.isMain && (
          <p className="text-sm text-blue-700 mt-1">
            Showing only purchases for this sub-project
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4 md:flex md:space-y-0 md:space-x-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by challan no, vendor, reference..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            placeholder="From Date"
            className="block rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            placeholder="To Date"
            className="block rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Totals */}
      <div className="mb-4 grid grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-md">
          <div className="text-sm text-gray-600">Total</div>
          <div className="text-xl font-semibold text-blue-900">{formatCurrency(totals.total)}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-md">
          <div className="text-sm text-gray-600">Paid</div>
          <div className="text-xl font-semibold text-green-900">{formatCurrency(totals.paid)}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-md">
          <div className="text-sm text-gray-600">Due</div>
          <div className="text-xl font-semibold text-red-900">{formatCurrency(totals.due)}</div>
        </div>
      </div>

      {/* Page Size Selector */}
      <div className="mb-4 flex items-center space-x-2">
        <label className="text-sm text-gray-700">Show entries:</label>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No purchases found for this project
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material(s)</th>
                  {project.isMain && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sub Project</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Challan No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voucher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Files</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {purchases.map((purchase, index) => (
                  <tr key={purchase.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          purchase.status === 'POSTED'
                            ? 'bg-green-100 text-green-800'
                            : purchase.status === 'APPROVED'
                            ? 'bg-blue-100 text-blue-800'
                            : purchase.status === 'SUBMITTED'
                            ? 'bg-yellow-100 text-yellow-800'
                            : purchase.status === 'REVERSED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {purchase.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-[200px]">
                      {getPurchaseMaterialsLabel(purchase.lines)}
                    </td>
                    {project.isMain && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {purchase.subProject?.name || '-'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {purchase.challanNo || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {purchase.supplierVendor.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {purchase.reference || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(purchase.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      {formatCurrency(purchase.paidAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {formatCurrency(purchase.dueAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {purchase.voucher ? (
                        <Link
                          href={`/dashboard/vouchers/${purchase.voucher.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {purchase.voucher.voucherNo}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {purchase._count.attachments}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <Link
                        href={`/dashboard/purchases/${purchase.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>
                      {canWrite && purchase.status === 'DRAFT' && !purchase.voucher?.id && (
                        <>
                          <Link
                            href={`/dashboard/purchases/${purchase.id}/edit?returnTo=/dashboard/projects/${projectId}/purchases`}
                            className="text-green-600 hover:text-green-900"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(purchase.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
