'use client';

import { useState, useEffect } from 'react';

interface Expense {
  id: string;
  projectId: string;
  project: { id: string; name: string; parentProjectId: string | null };
  mainProjectId: string;
  mainProject: { id: string; name: string };
  date: string;
  categoryId: string;
  category: { id: string; name: string };
  source: 'WAREHOUSE' | 'LABOR';
  amount: number;
  paidByUserId: string;
  paidByUser: { id: string; name: string; email: string };
  paidTo: string | null;
  vendorId: string | null;
  vendor: { id: string; name: string } | null;
  paymentMethodId: string;
  paymentMethod: { id: string; name: string };
  debitAccountId: string;
  debitAccount: { id: string; code: string; name: string };
  creditAccountId: string;
  creditAccount: { id: string; code: string; name: string };
  voucherId: string;
  voucher: { id: string; voucherNo: string; status: string };
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  isActive: boolean;
}

interface Project {
  id: string;
  name: string;
  parentProjectId: string | null;
  isMain: boolean;
}

interface ExpensesListProps {
  canWrite: boolean;
}

export default function ExpensesList({ canWrite }: ExpensesListProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string } | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    mainProjectId: '',
    projectId: '',
    from: '',
    to: '',
    categoryId: '',
    source: '',
    q: '',
  });

  // Options for dropdowns
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [mainProjects, setMainProjects] = useState<Project[]>([]);
  const [subProjects, setSubProjects] = useState<Project[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; name: string }>>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (data.ok && data.data?.user) {
          setCurrentUser(data.data.user);
        }
      } catch (error) {
        console.error('Failed to fetch current user:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.mainProjectId) params.append('mainProjectId', filters.mainProjectId);
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.source) params.append('source', filters.source);
      if (filters.q) params.append('q', filters.q);

      const response = await fetch(`/api/expenses?${params.toString()}`);
      const data = await response.json();

      if (data.ok) {
        setExpenses(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  // Fetch options for dropdowns
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [projectsRes, categoriesRes, paymentMethodsRes, accountsRes, vendorsRes] = await Promise.all([
          fetch('/api/projects?active=true'),
          fetch('/api/expense-categories?active=true'),
          fetch('/api/payment-methods?active=true'),
          fetch('/api/chart-of-accounts?active=true'),
          fetch('/api/vendors?active=true'),
        ]);

        if (projectsRes.ok) {
          const data = await projectsRes.json();
          const projects = data.data || [];
          setAllProjects(projects);
          // Separate main projects (parentProjectId is null or isMain is true) and subprojects
          const mains = projects.filter((p: Project) => !p.parentProjectId || p.isMain);
          const subs = projects.filter((p: Project) => p.parentProjectId && !p.isMain);
          setMainProjects(mains);
          setSubProjects(subs);
        }
        if (categoriesRes.ok) {
          const data = await categoriesRes.json();
          setExpenseCategories(data.data || []);
        }
        if (paymentMethodsRes.ok) {
          const data = await paymentMethodsRes.json();
          setPaymentMethods(data.data || []);
        }
        if (accountsRes.ok) {
          const data = await accountsRes.json();
          setAccounts(data.data || []);
        }
        if (vendorsRes.ok) {
          const data = await vendorsRes.json();
          setVendors(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch options:', error);
      }
    };

    fetchOptions();
  }, []);

  // Update subprojects when main project changes
  useEffect(() => {
    if (filters.mainProjectId) {
      const subs = allProjects.filter((p) => p.parentProjectId === filters.mainProjectId);
      setSubProjects(subs);
      // Clear subproject selection if it's not under the selected main project
      if (filters.projectId && !subs.find((p) => p.id === filters.projectId)) {
        setFilters({ ...filters, projectId: '' });
      }
    } else {
      setSubProjects([]);
      setFilters({ ...filters, projectId: '' });
    }
  }, [filters.mainProjectId, allProjects]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense? This will also delete the associated voucher.')) return;

    try {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.ok) {
        fetchExpenses();
      } else {
        alert(data.error || 'Failed to delete expense');
      }
    } catch (error) {
      alert('An error occurred');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Main Project</label>
            <select
              value={filters.mainProjectId}
              onChange={(e) => setFilters({ ...filters, mainProjectId: e.target.value, projectId: '' })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All Main Projects</option>
              {mainProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subproject</label>
            <select
              value={filters.projectId}
              onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
              disabled={!filters.mainProjectId}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
            >
              <option value="">All Subprojects</option>
              {subProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All Categories</option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              value={filters.source}
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">All Sources</option>
              <option value="WAREHOUSE">Warehouse</option>
              <option value="LABOR">Labor</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search (Paid To / Notes)</label>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Search by paid to or notes..."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilters({ mainProjectId: '', projectId: '', from: '', to: '', categoryId: '', source: '', q: '' })}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Actions */}
      {canWrite && (
        <div className="mb-4">
          <button
            onClick={() => {
              setEditingExpense(null);
              setShowForm(true);
            }}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            + Add Expense
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <ExpenseForm
          expense={editingExpense}
          mainProjects={mainProjects}
          allProjects={allProjects}
          expenseCategories={expenseCategories}
          setExpenseCategories={setExpenseCategories}
          paymentMethods={paymentMethods}
          accounts={accounts}
          vendors={vendors}
          currentUser={currentUser}
          onClose={() => {
            setShowForm(false);
            setEditingExpense(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditingExpense(null);
            fetchExpenses();
          }}
        />
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No expenses found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Main Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Debit Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credit Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voucher</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                {canWrite && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(expense.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.mainProject.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.project.name}
                    {expense.project.parentProjectId && (
                      <span className="ml-1 text-xs text-gray-500">(Sub)</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.category.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.source}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.paidByUser.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.vendor?.name || expense.paidTo || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.paymentMethod.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.debitAccount.code} - {expense.debitAccount.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {expense.creditAccount.code} - {expense.creditAccount.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="text-blue-600">{expense.voucher.voucherNo}</span>
                    <span className="ml-1 text-xs text-gray-500">({expense.voucher.status})</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {expense.notes || '-'}
                  </td>
                  {canWrite && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setEditingExpense(expense);
                          setShowForm(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
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

// Expense Form Component
function ExpenseForm({
  expense,
  mainProjects,
  allProjects,
  expenseCategories,
  setExpenseCategories,
  paymentMethods,
  accounts,
  vendors,
  currentUser,
  onClose,
  onSuccess,
}: {
  expense: Expense | null;
  mainProjects: Project[];
  allProjects: Project[];
  expenseCategories: ExpenseCategory[];
  setExpenseCategories: (categories: ExpenseCategory[]) => void;
  paymentMethods: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; code: string; name: string }>;
  vendors: Array<{ id: string; name: string }>;
  currentUser: { id: string; name: string; email: string } | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedMainProjectId, setSelectedMainProjectId] = useState<string>(
    expense?.mainProjectId || ''
  );
  const [availableSubProjects, setAvailableSubProjects] = useState<Project[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [formData, setFormData] = useState({
    projectId: expense?.projectId || '',
    date: expense?.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    categoryId: expense?.categoryId || '',
    source: (expense?.source || 'WAREHOUSE') as 'WAREHOUSE' | 'LABOR',
    amount: expense?.amount || 0,
    paidTo: expense?.paidTo || '',
    vendorId: expense?.vendorId || '',
    paymentMethodId: expense?.paymentMethodId || '',
    debitAccountId: expense?.debitAccountId || '',
    creditAccountId: expense?.creditAccountId || '',
    notes: expense?.notes || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseAccountsByCategory, setExpenseAccountsByCategory] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [loadingExpenseAccounts, setLoadingExpenseAccounts] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Update available subprojects when main project changes
  useEffect(() => {
    if (selectedMainProjectId) {
      const subs = allProjects.filter((p) => p.parentProjectId === selectedMainProjectId);
      setAvailableSubProjects(subs);
      // If current projectId is not in available subprojects, clear it
      if (formData.projectId && !subs.find((p) => p.id === formData.projectId)) {
        setFormData({ ...formData, projectId: '' });
      }
    } else {
      setAvailableSubProjects([]);
      setFormData({ ...formData, projectId: '' });
    }
  }, [selectedMainProjectId, allProjects]);

  // Set main project from expense if editing
  useEffect(() => {
    if (expense) {
      setSelectedMainProjectId(expense.mainProjectId);
    }
  }, [expense]);

  // Fetch expense accounts filtered by selected category; reset debit account when category changes
  useEffect(() => {
    if (!formData.categoryId) {
      setExpenseAccountsByCategory([]);
      return;
    }
    setLoadingExpenseAccounts(true);
    fetch(`/api/chart-of-accounts?active=true&categoryId=${formData.categoryId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.data)) {
          setExpenseAccountsByCategory(data.data);
        } else {
          setExpenseAccountsByCategory([]);
        }
      })
      .catch(() => setExpenseAccountsByCategory([]))
      .finally(() => setLoadingExpenseAccounts(false));
  }, [formData.categoryId]);

  // When category changes, clear debit account if it's not in the new category's list
  const handleCategoryChange = (categoryId: string) => {
    setFormData((prev) => ({
      ...prev,
      categoryId,
      debitAccountId: '', // reset so user picks from filtered list
    }));
    setFieldErrors((prev) => ({ ...prev, categoryId: '', debitAccountId: '' }));
  };

  // When payment method is selected, suggest credit account (Cash/Bank default)
  const handlePaymentMethodChange = async (paymentMethodId: string) => {
    setFormData((prev) => ({ ...prev, paymentMethodId }));
    if (!paymentMethodId) return;
    try {
      const res = await fetch(`/api/payment-methods/${paymentMethodId}/default-account`);
      const data = await res.json();
      if (data.ok && data.data?.accountId) {
        setFormData((prev) => ({ ...prev, paymentMethodId, creditAccountId: data.data.accountId }));
      }
    } catch {
      // ignore; user can select credit account manually
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      alert('Category name is required');
      return;
    }

    try {
      const response = await fetch('/api/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });

      const data = await response.json();

      if (data.ok) {
        setExpenseCategories([...expenseCategories, data.data]);
        setFormData({ ...formData, categoryId: data.data.id });
        setShowAddCategory(false);
        setNewCategoryName('');
      } else {
        alert(data.error || 'Failed to create category');
      }
    } catch (error) {
      alert('An error occurred');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!selectedMainProjectId) errors.mainProjectId = 'Main project is required';
    if (!formData.projectId) errors.projectId = 'Project is required';
    if (!formData.categoryId) errors.categoryId = 'Expense category is required';
    if (!formData.debitAccountId) errors.debitAccountId = 'Expense account (purpose) is required';
    if (!formData.paymentMethodId) errors.paymentMethodId = 'Payment method is required';
    if (!formData.creditAccountId) errors.creditAccountId = 'Credit account is required';
    if (formData.amount <= 0) errors.amount = 'Amount must be greater than 0';
    if (!formData.date) errors.date = 'Date is required';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);

    try {
      const payload: any = {
        projectId: formData.projectId,
        date: new Date(formData.date).toISOString(),
        categoryId: formData.categoryId,
        source: formData.source,
        amount: Number(formData.amount),
        paidTo: formData.paidTo || null,
        vendorId: formData.vendorId || null,
        paymentMethodId: formData.paymentMethodId,
        debitAccountId: formData.debitAccountId,
        creditAccountId: formData.creditAccountId,
        notes: formData.notes || null,
      };

      const url = expense ? `/api/expenses/${expense.id}` : '/api/expenses';
      const method = expense ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.ok) {
        onSuccess();
      } else {
        setFieldErrors({ submit: data.error || 'Failed to save expense' });
      }
    } catch (error) {
      setFieldErrors({ submit: 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Expense account options: from category filter; when editing, include current account if not in list
  const expenseAccountOptions = (() => {
    const byCategory = expenseAccountsByCategory;
    if (expense && formData.debitAccountId && !byCategory.some((a) => a.id === formData.debitAccountId)) {
      const current = accounts.find((a) => a.id === formData.debitAccountId);
      if (current) return [current, ...byCategory];
    }
    return byCategory;
  })();

  // Payment accounts (credit): Cash/Bank for payment method suggestion + manual override
  const paymentAccounts = accounts.filter((acc) =>
    acc.name.toLowerCase().includes('cash') ||
    acc.name.toLowerCase().includes('bank') ||
    acc.code.startsWith('1010') ||
    acc.code.startsWith('1020')
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">{expense ? 'Edit Expense' : 'Record Expense'}</h2>
        {fieldErrors.submit && (
          <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">{fieldErrors.submit}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Main Project <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={selectedMainProjectId}
                onChange={(e) => {
                  setSelectedMainProjectId(e.target.value);
                  setFormData({ ...formData, projectId: '' });
                  setFieldErrors((prev) => ({ ...prev, mainProjectId: '' }));
                }}
                className={`block w-full rounded-md shadow-sm focus:ring-blue-500 sm:text-sm ${fieldErrors.mainProjectId ? 'border-red-500' : 'border-gray-300 focus:border-blue-500'}`}
              >
                <option value="">Select Main Project</option>
                {mainProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {fieldErrors.mainProjectId && <p className="mt-1 text-xs text-red-600">{fieldErrors.mainProjectId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.projectId}
                onChange={(e) => {
                  setFormData({ ...formData, projectId: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, projectId: '' }));
                }}
                disabled={!selectedMainProjectId}
                className={`block w-full rounded-md shadow-sm sm:text-sm disabled:bg-gray-100 ${fieldErrors.projectId ? 'border-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
              >
                <option value="">Select Project</option>
                {/* Show main project as option */}
                {selectedMainProjectId && (
                  <option value={selectedMainProjectId}>
                    {mainProjects.find((p) => p.id === selectedMainProjectId)?.name} (Main)
                  </option>
                )}
                {/* Show subprojects */}
                {availableSubProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {fieldErrors.projectId && <p className="mt-1 text-xs text-red-600">{fieldErrors.projectId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => {
                  setFormData({ ...formData, date: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, date: '' }));
                }}
                className={`block w-full rounded-md shadow-sm sm:text-sm ${fieldErrors.date ? 'border-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
              />
              {fieldErrors.date && <p className="mt-1 text-xs text-red-600">{fieldErrors.date}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expense Category <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={`flex-1 block w-full rounded-md shadow-sm sm:text-sm ${fieldErrors.categoryId ? 'border-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                >
                  <option value="">Select Expense Category</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddCategory(!showAddCategory)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  title="Add new category"
                >
                  +
                </button>
              </div>
              {showAddCategory && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name"
                    className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-3 py-2 text-sm border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCategory(false);
                      setNewCategoryName('');
                    }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {fieldErrors.categoryId && <p className="mt-1 text-xs text-red-600">{fieldErrors.categoryId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expense Account (Purpose) <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.debitAccountId}
                onChange={(e) => {
                  setFormData({ ...formData, debitAccountId: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, debitAccountId: '' }));
                }}
                disabled={!formData.categoryId || loadingExpenseAccounts}
                className={`block w-full rounded-md shadow-sm sm:text-sm disabled:bg-gray-100 ${fieldErrors.debitAccountId ? 'border-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
              >
                <option value="">
                  {!formData.categoryId ? 'Select expense category first' : loadingExpenseAccounts ? 'Loading...' : 'Select Expense Account'}
                </option>
                {expenseAccountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
              {fieldErrors.debitAccountId && <p className="mt-1 text-xs text-red-600">{fieldErrors.debitAccountId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value as 'WAREHOUSE' | 'LABOR' })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="WAREHOUSE">Warehouse</option>
                <option value="LABOR">Labor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => {
                  setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 });
                  setFieldErrors((prev) => ({ ...prev, amount: '' }));
                }}
                className={`block w-full rounded-md shadow-sm sm:text-sm ${fieldErrors.amount ? 'border-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
              />
              {fieldErrors.amount && <p className="mt-1 text-xs text-red-600">{fieldErrors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method <span className="text-red-500">*</span></label>
              <select
                required
                value={formData.paymentMethodId}
                onChange={(e) => {
                  handlePaymentMethodChange(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, paymentMethodId: '' }));
                }}
                className={`block w-full rounded-md shadow-sm sm:text-sm ${fieldErrors.paymentMethodId ? 'border-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
              >
                <option value="">Select Payment Method</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
              {fieldErrors.paymentMethodId && <p className="mt-1 text-xs text-red-600">{fieldErrors.paymentMethodId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Credit Account (Cash/Bank) <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.creditAccountId}
                onChange={(e) => {
                  setFormData({ ...formData, creditAccountId: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, creditAccountId: '' }));
                }}
                className={`block w-full rounded-md shadow-sm sm:text-sm ${fieldErrors.creditAccountId ? 'border-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
              >
                <option value="">Select Payment Account</option>
                {paymentAccounts.length > 0 ? (
                  paymentAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))
                ) : (
                  accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))
                )}
              </select>
              {fieldErrors.creditAccountId && <p className="mt-1 text-xs text-red-600">{fieldErrors.creditAccountId}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid By</label>
              <input
                type="text"
                value={currentUser?.name || 'Loading...'}
                disabled
                className="block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Automatically set to current user</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
              <select
                value={formData.vendorId}
                onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">Select Vendor (or enter Paid To below)</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid To</label>
              <input
                type="text"
                value={formData.paidTo}
                onChange={(e) => setFormData({ ...formData, paidTo: e.target.value })}
                placeholder="Enter if vendor not selected"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Work / Material Details</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Description of work or materials"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : expense ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
