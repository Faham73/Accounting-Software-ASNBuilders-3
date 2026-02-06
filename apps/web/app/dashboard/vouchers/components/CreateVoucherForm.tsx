'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Project {
  id: string;
  name: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
}

interface VoucherLine {
  accountId: string;
  description: string;
  debit: string | number; // Allow string for UI state (empty while typing)
  credit: string | number; // Allow string for UI state (empty while typing)
  projectId: string;
  isCompanyLevel: boolean;
  paymentMethodId: string;
  // PDF fields
  workDetails: string;
  paidBy: string;
  receivedBy: string;
  fileRef: string;
  voucherRef: string;
}

interface CreateVoucherFormProps {
  voucher?: any;
  voucherId?: string;
}

export default function CreateVoucherForm(props?: CreateVoucherFormProps) {
  const { voucher, voucherId } = props ?? {};
  const router = useRouter();
  const isEdit = Boolean(voucher && voucherId);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [formData, setFormData] = useState(() => {
    if (voucher) {
      return {
        date: new Date(voucher.date).toISOString().split('T')[0],
        narration: voucher.narration || '',
        projectId: voucher.projectId || '',
        expenseType: voucher.expenseType || 'PROJECT_EXPENSE',
      };
    }
    return {
      date: new Date().toISOString().split('T')[0],
      narration: '',
      projectId: '',
      expenseType: 'PROJECT_EXPENSE' as 'PROJECT_EXPENSE' | 'OFFICE_EXPENSE',
    };
  });

  const [lines, setLines] = useState<VoucherLine[]>(() => {
    if (voucher?.lines?.length >= 2) {
      return voucher.lines.map((l: any) => ({
        accountId: l.accountId,
        description: l.description || '',
        debit: Number(l.debit),
        credit: Number(l.credit),
        projectId: l.projectId || '',
        isCompanyLevel: l.isCompanyLevel || false,
        paymentMethodId: l.paymentMethodId || '',
        workDetails: l.workDetails || '',
        paidBy: l.paidBy || '',
        receivedBy: l.receivedBy || '',
        fileRef: l.fileRef || '',
        voucherRef: l.voucherRef || '',
      }));
    }
    return [
      { accountId: '', description: '', debit: '', credit: '', projectId: '', isCompanyLevel: false, paymentMethodId: '', workDetails: '', paidBy: '', receivedBy: '', fileRef: '', voucherRef: '' },
      { accountId: '', description: '', debit: '', credit: '', projectId: '', isCompanyLevel: false, paymentMethodId: '', workDetails: '', paidBy: '', receivedBy: '', fileRef: '', voucherRef: '' },
    ];
  });

  useEffect(() => {
    // Fetch accounts
    fetch('/api/chart-of-accounts?active=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setAccounts(data.data);
        }
      });

    // Fetch projects
    fetch('/api/projects?active=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setProjects(data.data);
        }
      });

    // Fetch payment methods
    fetch('/api/payment-methods?active=true')
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setPaymentMethods(data.data);
        }
      });
  }, []);

  const addLine = () => {
    setLines([...lines, { accountId: '', description: '', debit: '', credit: '', projectId: '', isCompanyLevel: false, paymentMethodId: '', workDetails: '', paidBy: '', receivedBy: '', fileRef: '', voucherRef: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof VoucherLine, value: any) => {
    setLines((prevLines) => {
      const newLines = [...prevLines];
      newLines[index] = { ...newLines[index], [field]: value };
      return newLines;
    });
  };

  const calculateTotals = () => {
    const totalDebit = lines.reduce((sum, line) => {
      const debit = typeof line.debit === 'string' ? parseFloat(line.debit) || 0 : line.debit || 0;
      return sum + debit;
    }, 0);
    const totalCredit = lines.reduce((sum, line) => {
      const credit = typeof line.credit === 'string' ? parseFloat(line.credit) || 0 : line.credit || 0;
      return sum + credit;
    }, 0);
    return { totalDebit, totalCredit, difference: totalDebit - totalCredit };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const { totalDebit, totalCredit, difference } = calculateTotals();
    if (Math.abs(difference) >= 0.01) {
      setError(`Voucher is not balanced. Debit: ${totalDebit.toFixed(2)}, Credit: ${totalCredit.toFixed(2)}, Difference: ${difference.toFixed(2)}`);
      return;
    }

    // Validate all lines have accounts
    if (lines.some((line) => !line.accountId)) {
      setError('All lines must have an account selected');
      return;
    }

    // Validate each line has either debit or credit
    if (lines.some((line) => {
      const debit = typeof line.debit === 'string' ? parseFloat(line.debit) || 0 : line.debit || 0;
      const credit = typeof line.credit === 'string' ? parseFloat(line.credit) || 0 : line.credit || 0;
      return debit === 0 && credit === 0;
    })) {
      setError('Each line must have either debit or credit amount');
      return;
    }

    setIsSubmitting(true);

    try {
      // If office expense, ensure projectId is null
      const finalProjectId = formData.expenseType === 'OFFICE_EXPENSE' ? null : (formData.projectId || null);

      const payload = {
        date: formData.date,
        narration: formData.narration || null,
        projectId: finalProjectId,
        expenseType: formData.expenseType,
        lines: lines.map((line) => {
          const isCompanyLevel = line.isCompanyLevel && line.projectId === '';
          return {
            accountId: line.accountId,
            description: line.description || null,
            debit: typeof line.debit === 'string' ? parseFloat(line.debit) || 0 : line.debit || 0,
            credit: typeof line.credit === 'string' ? parseFloat(line.credit) || 0 : line.credit || 0,
            projectId: formData.expenseType === 'OFFICE_EXPENSE' 
              ? null 
              : (isCompanyLevel ? null : (line.projectId || null)),
            isCompanyLevel: formData.expenseType === 'OFFICE_EXPENSE' ? false : isCompanyLevel,
            paymentMethodId: line.paymentMethodId || null,
            // PDF fields
            workDetails: line.workDetails || null,
            paidBy: line.paidBy || null,
            receivedBy: line.receivedBy || null,
            fileRef: line.fileRef || null,
            voucherRef: line.voucherRef || null,
          };
        }),
      };

      const url = isEdit ? `/api/vouchers/${voucherId}` : '/api/vouchers';
      const method = isEdit ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.ok) {
        setError(data.error || (isEdit ? 'Failed to update voucher' : 'Failed to create voucher'));
        return;
      }

      if (isEdit) {
        router.push(`/dashboard/vouchers/${voucherId}`);
      } else {
        router.push('/dashboard/vouchers');
      }
      router.refresh();
    } catch (err) {
      setError(isEdit ? 'An error occurred while updating the voucher' : 'An error occurred while creating the voucher');
    } finally {
      setIsSubmitting(false);
    }
  };

  const { totalDebit, totalCredit, difference } = calculateTotals();
  const isBalanced = Math.abs(difference) < 0.01;

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
          <label htmlFor="expenseType" className="block text-sm font-medium text-gray-700">
            Expense Type <span className="text-red-500">*</span>
          </label>
          <select
            id="expenseType"
            value={formData.expenseType}
            onChange={(e) => {
              const newExpenseType = e.target.value as 'PROJECT_EXPENSE' | 'OFFICE_EXPENSE';
              setFormData({
                ...formData,
                expenseType: newExpenseType,
                projectId: newExpenseType === 'OFFICE_EXPENSE' ? '' : formData.projectId,
              });
            }}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="PROJECT_EXPENSE">Project Expense</option>
            <option value="OFFICE_EXPENSE">Office (Overhead) Expense</option>
          </select>
        </div>

        <div>
          <label htmlFor="projectId" className="block text-sm font-medium text-gray-700">
            Project {formData.expenseType === 'PROJECT_EXPENSE' ? '(Optional)' : ''}
          </label>
          <select
            id="projectId"
            value={formData.projectId}
            onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
            disabled={formData.expenseType === 'OFFICE_EXPENSE'}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">{formData.expenseType === 'OFFICE_EXPENSE' ? 'N/A (Office Expense)' : 'None'}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {formData.expenseType === 'OFFICE_EXPENSE' && (
            <p className="mt-1 text-xs text-gray-500">Office expenses are not assigned to projects</p>
          )}
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

      {/* Voucher Lines */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Voucher Lines</h3>
          <button
            type="button"
            onClick={addLine}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Add Line
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account (Purpose)</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Work Details</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid By</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Received By</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">File Ref</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Voucher Ref</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lines.map((line, index) => (
                <tr key={index}>
                  <td className="px-2 py-2">
                    <select
                      required
                      value={line.accountId}
                      onChange={(e) => updateLine(index, 'accountId', e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="">Select Account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      placeholder="Note"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={line.isCompanyLevel ? 'COMPANY' : line.projectId}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'COMPANY') {
                          updateLine(index, 'isCompanyLevel', true);
                          updateLine(index, 'projectId', '');
                        } else {
                          updateLine(index, 'isCompanyLevel', false);
                          updateLine(index, 'projectId', value);
                        }
                      }}
                      disabled={formData.expenseType === 'OFFICE_EXPENSE'}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">{formData.expenseType === 'OFFICE_EXPENSE' ? 'N/A' : 'None'}</option>
                      {formData.expenseType !== 'OFFICE_EXPENSE' && (
                        <option value="COMPANY">Company (All Projects)</option>
                      )}
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={line.workDetails}
                      onChange={(e) => updateLine(index, 'workDetails', e.target.value)}
                      placeholder="Work details"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={line.paidBy}
                      onChange={(e) => updateLine(index, 'paidBy', e.target.value)}
                      placeholder="Paid by"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={line.receivedBy}
                      onChange={(e) => updateLine(index, 'receivedBy', e.target.value)}
                      placeholder="Received by"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={line.fileRef}
                      onChange={(e) => updateLine(index, 'fileRef', e.target.value)}
                      placeholder="e.g., 1*1"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={line.voucherRef}
                      onChange={(e) => updateLine(index, 'voucherRef', e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="">Select Voucher</option>
                      <option value="Khata">Khata</option>
                      <option value="Diary">Diary</option>
                      <option value="OC">OC</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={typeof line.debit === 'string' ? line.debit : (line.debit === 0 ? '' : String(line.debit))}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateLine(index, 'debit', value === '' ? '' : value);
                        // Clear credit if debit is being entered
                        if (value !== '' && parseFloat(value) > 0) {
                          updateLine(index, 'credit', '');
                        }
                      }}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-right"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={typeof line.credit === 'string' ? line.credit : (line.credit === 0 ? '' : String(line.credit))}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateLine(index, 'credit', value === '' ? '' : value);
                        // Clear debit if credit is being entered
                        if (value !== '' && parseFloat(value) > 0) {
                          updateLine(index, 'debit', '');
                        }
                      }}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-right"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    {lines.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="text-red-600 hover:text-red-900 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={9} className="px-2 py-2 text-right font-medium">Totals:</td>
                <td className="px-2 py-2 text-right font-medium">
                  {totalDebit.toFixed(2)}
                </td>
                <td className="px-2 py-2 text-right font-medium">
                  {totalCredit.toFixed(2)}
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={`text-sm font-medium ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                    {isBalanced ? '✓ Balanced' : `Diff: ${difference.toFixed(2)}`}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 justify-end">
        {isEdit ? (
          <a
            href={`/dashboard/vouchers/${voucherId}`}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </a>
        ) : (
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || !isBalanced}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save' : 'Create Voucher')}
        </button>
      </div>
    </form>
  );
}
