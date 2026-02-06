'use client';

import { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
}

interface CreateCreditFormProps {
  projectId?: string; // If provided, project is auto-selected and disabled
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CreateCreditForm({
  projectId: initialProjectId,
  onSuccess,
  onCancel,
}: CreateCreditFormProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    projectId: initialProjectId || '',
    date: new Date().toISOString().split('T')[0],
    purpose: '',
    paidBy: '',
    receivedBy: '',
    paymentMethod: 'Cash' as 'Cash' | 'Check' | 'Bank Transfer' | 'Bkash' | 'Other',
    paymentRef: '',
    amount: '',
    note: 'Done',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (initialProjectId) {
      setFormData((prev) => ({ ...prev, projectId: initialProjectId }));
    }
  }, [initialProjectId]);

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
      return project?.name || '';
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const project = projects.find((p) => p.id === formData.projectId);
      const projectSnapshotName = project?.name || 'Company (All Projects)';

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

      const response = await fetch('/api/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.ok) {
        // Reset form
        setFormData({
          projectId: initialProjectId || '',
          date: new Date().toISOString().split('T')[0],
          purpose: '',
          paidBy: '',
          receivedBy: '',
          paymentMethod: 'Cash',
          paymentRef: '',
          amount: '',
          note: 'Done',
        });
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(result.error || 'Failed to create credit entry');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create credit entry');
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
            disabled={!!initialProjectId}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Select Project</option>
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
          {loading ? 'Creating...' : 'Create Credit'}
        </button>
      </div>
    </form>
  );
}
