'use client';

import { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
}

interface Credit {
  id: string;
  date: string;
  projectId: string | null;
  projectSnapshotName: string;
  purpose: string;
  paidBy: string;
  receivedBy: string;
  paymentMethod: string;
  paymentRef: string | null;
  amount: number;
  note: string | null;
}

interface EditCreditFormProps {
  credit: Credit;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function EditCreditForm({
  credit,
  onSuccess,
  onCancel,
}: EditCreditFormProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    projectId: credit.projectId || '',
    date: credit.date ? new Date(credit.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    purpose: credit.purpose || '',
    paidBy: credit.paidBy || '',
    receivedBy: credit.receivedBy || '',
    paymentMethod: (credit.paymentMethod || 'Cash') as 'Cash' | 'Check' | 'Bank Transfer' | 'Bkash' | 'Other',
    paymentRef: credit.paymentRef || '',
    amount: credit.amount?.toString() || '',
    note: credit.note || 'Done',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.ok) {
        setProjects(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load projects', err);
    }
  };

  const getProjectName = () => {
    if (formData.projectId) {
      const project = projects.find((p) => p.id === formData.projectId);
      return project?.name || credit.projectSnapshotName;
    }
    return credit.projectSnapshotName || 'Company (All Projects)';
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const project = formData.projectId ? projects.find((p) => p.id === formData.projectId) : null;
      const projectSnapshotName = project?.name || (formData.projectId ? credit.projectSnapshotName : 'Company (All Projects)');

      const payload = {
        projectId: formData.projectId || null,
        projectSnapshotName,
        date: formData.date,
        purpose: formData.purpose,
        paidBy: formData.paidBy,
        receivedBy: formData.receivedBy,
        paymentMethod: formData.paymentMethod,
        paymentRef: formData.paymentRef || null,
        amount: parseFloat(formData.amount),
        note: formData.note || 'Done',
      };

      const response = await fetch(`/api/credit/${credit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.ok) {
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(result.error || 'Failed to update credit entry');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update credit entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Project */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.projectId}
            onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Company (All Projects)</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Purpose/Details */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Purpose (Details) <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          value={formData.purpose}
          onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Enter purpose/details"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Paid By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Paid By <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.paidBy}
            onChange={(e) => setFormData({ ...formData, paidBy: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter name"
          />
        </div>

        {/* Received By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Received By <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.receivedBy}
            onChange={(e) => setFormData({ ...formData, receivedBy: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter name"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Method <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.paymentMethod}
            onChange={(e) =>
              setFormData({
                ...formData,
                paymentMethod: e.target.value as typeof formData.paymentMethod,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="Cash">Cash</option>
            <option value="Check">Check</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Bkash">Bkash</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Payment Ref */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Ref (Optional)
          </label>
          <input
            type="text"
            value={formData.paymentRef}
            onChange={(e) => setFormData({ ...formData, paymentRef: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g., DBBL AC (Shuvo), Check (IFIC Bank)"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Amount */}
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
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="0.00"
          />
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note (Optional)</label>
          <input
            type="text"
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Default: Done"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Updating...' : 'Update Credit'}
        </button>
      </div>
    </form>
  );
}
