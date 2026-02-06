'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
}

interface CreateDebitVoucherFormProps {
  projectId: string;
  projectName: string;
  returnTo?: string;
}

export default function CreateDebitVoucherForm({
  projectId,
  projectName,
  returnTo,
}: CreateDebitVoucherFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    workDetails: '',
    purpose: '',
    paidBy: '',
    receivedBy: '',
    paymentMethodId: '',
    amount: '',
    note: '',
    debitAccountId: '',
    creditAccountId: '',
  });

  useEffect(() => {
    fetch('/api/chart-of-accounts?active=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setAccounts(data.data || []);
      });
    fetch('/api/payment-methods?active=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setPaymentMethods(data.data || []);
      });
  }, []);

  const handlePaymentMethodChange = (paymentMethodId: string) => {
    setFormData((prev) => ({ ...prev, paymentMethodId, creditAccountId: '' }));
    if (!paymentMethodId) return;
    fetch(`/api/payment-methods/${paymentMethodId}/default-account`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.data?.accountId) {
          setFormData((prev) => ({ ...prev, creditAccountId: data.data.accountId }));
        }
      })
      .catch(() => {});
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Amount must be a positive number');
      return;
    }
    if (!formData.debitAccountId) {
      setError('Expense account is required');
      return;
    }
    if (!formData.creditAccountId) {
      setError('Credit account is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        date: formData.date,
        projectId,
        narration: formData.note || formData.purpose || null,
        expenseType: 'PROJECT_EXPENSE',
        lines: [
          {
            accountId: formData.debitAccountId,
            description: formData.purpose || formData.note || null,
            debit: amount,
            credit: 0,
            projectId,
            isCompanyLevel: false,
            paymentMethodId: formData.paymentMethodId || null,
            workDetails: formData.workDetails || null,
            paidBy: formData.paidBy || null,
            receivedBy: formData.receivedBy || null,
            fileRef: null,
            voucherRef: null,
          },
          {
            accountId: formData.creditAccountId,
            description: formData.note || formData.purpose || `Payment - ${formData.workDetails || 'Debit'}`,
            debit: 0,
            credit: amount,
            projectId,
            isCompanyLevel: false,
            paymentMethodId: formData.paymentMethodId || null,
            workDetails: null,
            paidBy: null,
            receivedBy: null,
            fileRef: null,
            voucherRef: null,
          },
        ],
      };

      const response = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data.ok) {
        setError(data.error || 'Failed to record expense');
        return;
      }

      // Redirect to returnTo if provided, otherwise default to project debit list
      const redirectUrl = returnTo
        ? `${returnTo}${returnTo.includes('?') ? '&' : '?'}created=1`
        : `/dashboard/debit?projectId=${projectId}&created=1`;
      router.push(redirectUrl);
      router.refresh();
    } catch (err) {
      setError('An error occurred while creating the voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-500 mb-4">
        Project: <span className="font-medium text-gray-700">{projectName}</span>
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (Tk) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expense Account (Purpose) <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.debitAccountId}
            onChange={(e) => setFormData({ ...formData, debitAccountId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Select account</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} - {acc.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Credit Account (Cash/Bank) <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.creditAccountId}
            onChange={(e) => setFormData({ ...formData, creditAccountId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Select account (or choose payment method to suggest)</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.code} - {acc.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
          <select
            value={formData.paymentMethodId}
            onChange={(e) => handlePaymentMethodChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Select (optional – can auto-fill credit account for Cash/Bank)</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Work Details</label>
          <input
            type="text"
            value={formData.workDetails}
            onChange={(e) => setFormData({ ...formData, workDetails: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Brief work description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
          <input
            type="text"
            value={formData.purpose}
            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Purpose of expense"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paid By</label>
            <input
              type="text"
              value={formData.paidBy}
              onChange={(e) => setFormData({ ...formData, paidBy: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Received By</label>
            <input
              type="text"
              value={formData.receivedBy}
              onChange={(e) => setFormData({ ...formData, receivedBy: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note / Description</label>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows={2}
            placeholder="Optional note"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto min-h-[40px] px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
          >
            {isSubmitting ? 'Creating…' : 'Record Expense'}
          </button>
          <Link
            href={`/dashboard/debit?projectId=${projectId}`}
            className="w-full sm:w-auto min-h-[40px] px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium text-center flex items-center justify-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
