'use client';

import { useState } from 'react';

interface AttachmentUploaderProps {
  projectId?: string;
  onAttachmentCreated?: () => void;
}

export default function AttachmentUploader({
  projectId,
  onAttachmentCreated,
}: AttachmentUploaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    url: '',
    fileName: '',
    mimeType: '',
    sizeBytes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        url: formData.url,
        fileName: formData.fileName,
        mimeType: formData.mimeType,
        sizeBytes: parseInt(formData.sizeBytes, 10),
      };

      const response = await fetch('/api/attachments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.ok) {
        setError(data.error || 'Failed to create attachment');
        return;
      }

      // Reset form and close
      setFormData({ url: '', fileName: '', mimeType: '', sizeBytes: '' });
      setIsOpen(false);
      if (onAttachmentCreated) {
        onAttachmentCreated();
      }
    } catch (err) {
      setError('An error occurred while creating attachment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-sm text-blue-600 hover:text-blue-900"
      >
        + Add Attachment
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-medium text-gray-900">Add Attachment (Dev Placeholder)</h4>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setError(null);
            setFormData({ url: '', fileName: '', mimeType: '', sizeBytes: '' });
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Note: This is a development placeholder. Actual file upload will be implemented later.
      </p>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 p-2">
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700">
              File URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              required
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://example.com/file.pdf"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              File Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.fileName}
              onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
              placeholder="document.pdf"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              MIME Type <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.mimeType}
              onChange={(e) => setFormData({ ...formData, mimeType: e.target.value })}
              placeholder="application/pdf"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              Size (bytes) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.sizeBytes}
              onChange={(e) => setFormData({ ...formData, sizeBytes: e.target.value })}
              placeholder="1024"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
            {formData.sizeBytes && (
              <p className="mt-1 text-xs text-gray-500">
                {formatFileSize(parseInt(formData.sizeBytes, 10))}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setError(null);
              setFormData({ url: '', fileName: '', mimeType: '', sizeBytes: '' });
            }}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Attachment'}
          </button>
        </div>
      </form>
    </div>
  );
}
