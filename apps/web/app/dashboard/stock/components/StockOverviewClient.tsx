'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface StockBalance {
  id: string;
  stockItemId: string;
  stockItem: {
    id: string;
    name: string;
    sku: string | null;
    unit: string;
    category: string | null;
    reorderLevel: number | null;
  };
  onHandQty: number;
  avgCost: number;
  isLowStock: boolean;
}

interface StockOverviewClientProps {
  canWrite: boolean;
}

export default function StockOverviewClient({ canWrite }: StockOverviewClientProps) {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockCount: 0,
  });

  const fetchBalances = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('pageSize', '100'); // Get more items for overview

      const response = await fetch(`/api/stock/balances?${params.toString()}`);
      const data = await response.json();

      if (data.ok) {
        setBalances(data.data);
        const lowStock = data.data.filter((b: StockBalance) => b.isLowStock).length;
        setStats({
          totalItems: data.data.length,
          lowStockCount: lowStock,
        });
      }
    } catch (error) {
      console.error('Failed to fetch stock balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [search]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Items</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalItems}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Low Stock Items</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">{stats.lowStockCount}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Actions</h3>
          <div className="mt-2 space-x-2">
            {canWrite && (
              <>
                <Link
                  href="/dashboard/stock/receive"
                  className="inline-block py-2 px-4 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                >
                  Receive Stock
                </Link>
                <Link
                  href="/dashboard/stock/issue"
                  className="inline-block py-2 px-4 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                >
                  Issue Stock
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Balances Table */}
      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  On Hand
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {balances.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No stock items found
                  </td>
                </tr>
              ) : (
                balances.map((balance) => (
                  <tr key={balance.id} className={balance.isLowStock ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {balance.stockItem.name}
                      </div>
                      {balance.stockItem.sku && (
                        <div className="text-sm text-gray-500">SKU: {balance.stockItem.sku}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {balance.stockItem.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {balance.onHandQty.toFixed(3)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(balance.avgCost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {balance.isLowStock ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
