'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface Vendor {
  id: string;
  name: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface OpenItem {
  lineId: string;
  voucherId: string;
  voucherNo: string;
  date: string;
  narration: string;
  accountCode: string;
  accountName: string;
  originalAmount: number;
  allocatedAmount: number;
  outstanding: number;
}

interface CreatePaymentVoucherFormProps {
  initialVendorId?: string;
}

export default function CreatePaymentVoucherForm({ initialVendorId }: CreatePaymentVoucherFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [openItems, setOpenItems] = useState<OpenItem[]>([]);

  const [formData, setFormData] = useState({
    vendorId: initialVendorId || '',
    date: new Date().toISOString().split('T')[0],
    narration: '',
    paymentAccountId: '',
  });

  const [allocations, setAllocations] = useState<Record<string, number>>({});

  // Fetch vendors and accounts on mount
  useEffect(() => {
    fetch('/api/vendors?active=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setVendors(data.data);
        }
      });

    // Fetch asset accounts (Cash/Bank) for payment
    fetch('/api/chart-of-accounts?active=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          // Filter for ASSET accounts (Cash/Bank)
          const assetAccounts = data.data.filter((acc: Account) => acc.type === 'ASSET');
          setAccounts(assetAccounts);
          // Auto-select first account if available
          if (assetAccounts.length > 0 && !formData.paymentAccountId) {
            setFormData((prev) => ({ ...prev, paymentAccountId: assetAccounts[0].id }));
          }
        }
      });
  }, []);

  // Fetch open items when vendor is selected
  useEffect(() => {
    if (formData.vendorId) {
      fetch(`/api/vendors/${formData.vendorId}/open-items`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) {
            setOpenItems(data.data);
            // Initialize allocations with 0
            const initialAllocations: Record<string, number> = {};
            data.data.forEach((item: OpenItem) => {
              initialAllocations[item.lineId] = 0;
            });
            setAllocations(initialAllocations);
          } else {
            setOpenItems([]);
            setAllocations({});
          }
        })
        .catch(() => {
          setOpenItems([]);
          setAllocations({});
        });
    } else {
      setOpenItems([]);
      setAllocations({});
    }
  }, [formData.vendorId]);

  const updateAllocation = (lineId: string, amount: number) => {
    const item = openItems.find((i) => i.lineId === lineId);
    if (!item) return;

    // Validate amount doesn't exceed outstanding
    const validAmount = Math.max(0, Math.min(amount, item.outstanding));
    setAllocations((prev) => ({
      ...prev,
      [lineId]: validAmount,
    }));
  };

  const totalPayment = Object.values(allocations).reduce((sum, amount) => sum + amount, 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.vendorId) {
      setError('Please select a vendor');
      return;
    }

    if (!formData.paymentAccountId) {
      setError('Please select a payment account');
      return;
    }

    if (openItems.length === 0) {
      setError('No open items found for this vendor');
      return;
    }

    // Build allocations array (only include non-zero allocations)
    const allocationEntries = Object.entries(allocations)
      .filter(([_, amount]) => amount > 0)
      .map(([sourceLineId, amount]) => ({
        sourceLineId,
        amount,
      }));

    if (allocationEntries.length === 0) {
      setError('Please allocate at least one payment amount');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/vouchers/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendorId: formData.vendorId,
          date: formData.date,
          narration: formData.narration || null,
          paymentAccountId: formData.paymentAccountId,
          allocations: allocationEntries,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        setError(data.error || 'Failed to create payment voucher');
        return;
      }

      router.push(`/dashboard/vouchers/${data.data.id}`);
      router.refresh();
    } catch (err) {
      setError('An error occurred while creating the payment voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Header Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="vendorId" className="block text-sm font-medium text-gray-700">
            Vendor <span className="text-red-500">*</span>
          </label>
          <select
            id="vendorId"
            required
            value={formData.vendorId}
            onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">Select Vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="paymentAccountId" className="block text-sm font-medium text-gray-700">
            Payment Account (Cash/Bank) <span className="text-red-500">*</span>
          </label>
          <select
            id="paymentAccountId"
            required
            value={formData.paymentAccountId}
            onChange={(e) => setFormData({ ...formData, paymentAccountId: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">Select Account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="narration" className="block text-sm font-medium text-gray-700">
            Narration
          </label>
          <textarea
            id="narration"
            value={formData.narration}
            onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
            rows={2}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Open Items Table */}
      {formData.vendorId && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Open Items</h3>
            {openItems.length > 0 && (
              <div className="text-sm font-medium text-gray-700">
                Total Payment: <span className="text-green-600">{totalPayment.toFixed(2)}</span>
              </div>
            )}
          </div>

          {openItems.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                No open items found for this vendor. All payables have been fully paid.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Voucher No</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Original</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pay Now</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {openItems.map((item) => (
                    <tr key={item.lineId}>
                      <td className="px-4 py-2 text-sm text-gray-900">{item.voucherNo}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">{item.narration || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">
                        {item.originalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500 text-right">
                        {item.allocatedAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                        {item.outstanding.toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={item.outstanding}
                          value={allocations[item.lineId] || 0}
                          onChange={(e) => updateAllocation(item.lineId, parseFloat(e.target.value) || 0)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-right"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !formData.vendorId || totalPayment === 0}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Payment Voucher'}
        </button>
      </div>
    </form>
  );
}
