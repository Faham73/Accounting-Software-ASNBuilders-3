'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '../../components/types';
import AttachmentUploader from './AttachmentUploader';

/**
 * Normalize date-like values to YYYY-MM-DD for <input type="date">.
 * Handles string (ISO or YYYY-MM-DD), Date, null, undefined.
 */
function toDateInputValue(input: unknown): string {
  if (input == null) return '';
  if (typeof input === 'string') {
    if (!input) return '';
    if (input.includes('T')) return input.split('T')[0];
    return input.slice(0, 10);
  }
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return '';
    return input.toISOString().slice(0, 10);
  }
  return '';
}

interface ProjectFormProps {
  project?: Project;
  onDuplicate?: () => void;
}

interface MainProject {
  id: string;
  name: string;
}

export default function ProjectForm({ project, onDuplicate }: ProjectFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mainProjects, setMainProjects] = useState<MainProject[]>([]);

  const [formData, setFormData] = useState({
    name: project?.name || '',
    clientName: project?.clientName || '',
    clientContact: project?.clientContact || '',
    siteLocation: project?.siteLocation || '',
    startDate: toDateInputValue(project?.startDate),
    expectedEndDate: toDateInputValue(project?.expectedEndDate),
    contractValue: project?.contractValue?.toString() || '',
    budgetTotal: project?.budgetTotal?.toString() || '',
    status: project?.status || 'DRAFT',
    assignedManager: project?.assignedManager || '',
    isActive: project?.isActive ?? true,
    // New fields
    address: project?.address || '',
    projectManager: project?.projectManager || '',
    projectEngineer: project?.projectEngineer || '',
    companySiteName: project?.companySiteName || '',
    reference: project?.reference || '',
    isMain: project?.isMain ?? false,
    parentProjectId: project?.parentProjectId || '',
  });

  // Fetch main projects for parent project dropdown
  useEffect(() => {
    const fetchMainProjects = async () => {
      try {
        const response = await fetch('/api/projects?status=all&active=all');
        const data = await response.json();
        if (data.ok) {
          const mainProjectsList = data.data.filter((p: Project) => p.isMain && p.id !== project?.id);
          setMainProjects(mainProjectsList);
        }
      } catch {
        // Silently ignore fetch errors; main projects dropdown may be empty
      }
    };
    fetchMainProjects();
  }, [project?.id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload: any = {
        name: formData.name,
        clientName: formData.clientName || null,
        clientContact: formData.clientContact || null,
        siteLocation: formData.siteLocation || null,
        startDate: formData.startDate || null,
        expectedEndDate: formData.expectedEndDate || null,
        contractValue: formData.contractValue ? parseFloat(formData.contractValue) : null,
        budgetTotal: formData.budgetTotal ? parseFloat(formData.budgetTotal) : null,
        status: formData.status,
        assignedManager: formData.assignedManager || null,
        isActive: formData.isActive,
        // New fields
        address: formData.address || null,
        projectManager: formData.projectManager || null,
        projectEngineer: formData.projectEngineer || null,
        companySiteName: formData.companySiteName || null,
        reference: formData.reference || null,
        isMain: formData.isMain,
        parentProjectId: formData.isMain ? null : (formData.parentProjectId || null),
      };

      const url = project ? `/api/projects/${project.id}` : '/api/projects';
      const method = project ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.ok) {
        setError(data.error || 'Failed to save project');
        return;
      }

      router.push('/dashboard/projects');
      router.refresh();
    } catch (err) {
      setError('An error occurred while saving the project');
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="DRAFT">Draft</option>
            <option value="RUNNING">Running</option>
            <option value="COMPLETED">Completed</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <div>
          <label htmlFor="clientName" className="block text-sm font-medium text-gray-700">
            Client Name
          </label>
          <input
            type="text"
            id="clientName"
            value={formData.clientName}
            onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="clientContact" className="block text-sm font-medium text-gray-700">
            Client Contact
          </label>
          <input
            type="text"
            id="clientContact"
            value={formData.clientContact}
            onChange={(e) => setFormData({ ...formData, clientContact: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="siteLocation" className="block text-sm font-medium text-gray-700">
            Site Location
          </label>
          <input
            type="text"
            id="siteLocation"
            value={formData.siteLocation}
            onChange={(e) => setFormData({ ...formData, siteLocation: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="assignedManager" className="block text-sm font-medium text-gray-700">
            Assigned Manager
          </label>
          <input
            type="text"
            id="assignedManager"
            value={formData.assignedManager}
            onChange={(e) => setFormData({ ...formData, assignedManager: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="expectedEndDate" className="block text-sm font-medium text-gray-700">
            Expected End Date
          </label>
          <input
            type="date"
            id="expectedEndDate"
            value={formData.expectedEndDate}
            onChange={(e) => setFormData({ ...formData, expectedEndDate: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="contractValue" className="block text-sm font-medium text-gray-700">
            Contract Value
          </label>
          <input
            type="number"
            id="contractValue"
            step="0.01"
            min="0"
            value={formData.contractValue}
            onChange={(e) => setFormData({ ...formData, contractValue: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="budgetTotal" className="block text-sm font-medium text-gray-700">
            Project Budget (BDT)
          </label>
          <input
            type="number"
            id="budgetTotal"
            step="0.01"
            min="0"
            value={formData.budgetTotal}
            onChange={(e) => setFormData({ ...formData, budgetTotal: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Project Address
          </label>
          <input
            type="text"
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="projectManager" className="block text-sm font-medium text-gray-700">
            Project Manager
          </label>
          <input
            type="text"
            id="projectManager"
            value={formData.projectManager}
            onChange={(e) => setFormData({ ...formData, projectManager: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="projectEngineer" className="block text-sm font-medium text-gray-700">
            Project Engineer
          </label>
          <input
            type="text"
            id="projectEngineer"
            value={formData.projectEngineer}
            onChange={(e) => setFormData({ ...formData, projectEngineer: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="companySiteName" className="block text-sm font-medium text-gray-700">
            Company Site Name
          </label>
          <input
            type="text"
            id="companySiteName"
            value={formData.companySiteName}
            onChange={(e) => setFormData({ ...formData, companySiteName: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="reference" className="block text-sm font-medium text-gray-700">
            Reference
          </label>
          <input
            type="text"
            id="reference"
            value={formData.reference}
            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="isMain"
            checked={formData.isMain}
            onChange={(e) => {
              const isMain = e.target.checked;
              setFormData({
                ...formData,
                isMain,
                parentProjectId: isMain ? '' : formData.parentProjectId, // Clear parent if main
              });
            }}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="isMain" className="ml-2 block text-sm text-gray-900">
            Is Main Project
          </label>
        </div>

        {!formData.isMain && (
          <div>
            <label htmlFor="parentProjectId" className="block text-sm font-medium text-gray-700">
              Parent Project
            </label>
            <select
              id="parentProjectId"
              value={formData.parentProjectId}
              onChange={(e) => setFormData({ ...formData, parentProjectId: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Select a main project...</option>
              {mainProjects.map((mainProject) => (
                <option key={mainProject.id} value={mainProject.id}>
                  {mainProject.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
            Active
          </label>
        </div>
      </div>

      {/* Attachments section - only show on edit page */}
      {project && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Attachments</h3>
          <AttachmentUploader projectId={project.id} />
        </div>
      )}

      <div className="flex justify-end space-x-4">
        {onDuplicate && (
          <button
            type="button"
            onClick={onDuplicate}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Duplicate Last Project
          </button>
        )}
        <button
          type="button"
          onClick={() => router.back()}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
        </button>
      </div>
    </form>
  );
}
