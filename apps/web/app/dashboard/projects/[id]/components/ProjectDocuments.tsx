'use client';

import { useState, useEffect, useRef } from 'react';

interface DocumentItem {
  id: string;
  title: string;
  fileUrl: string;
  uploadedAt: string;
}

interface ProjectDocumentsProps {
  projectId: string;
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export default function ProjectDocuments({ projectId }: ProjectDocumentsProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/documents`);
      const json = await res.json();
      if (json.ok && json.data) {
        setDocuments(json.data);
        setError(null);
      } else {
        setError(json.error ?? 'Failed to load documents');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (uploadTitle.trim()) {
        formData.append('title', uploadTitle.trim());
      }

      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.ok && json.data) {
        setDocuments((prev) => [json.data, ...prev]);
        setUploadTitle('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        alert(json.error ?? 'Upload failed');
      }
    } catch (err) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading && documents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Project Documents</h2>
        <div className="text-center py-6 text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Project Documents</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,image/*,.doc,.docx"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={uploading}
          className="inline-flex items-center gap-2 py-2 px-4 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input
          type="text"
          placeholder="Title (optional)"
          value={uploadTitle}
          onChange={(e) => setUploadTitle(e.target.value)}
          className="py-2 px-3 border border-gray-300 rounded-md text-sm w-48"
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 py-2">{error}</div>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">No documents yet. Upload a file to get started.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between py-2 px-3 rounded-md border border-gray-100 hover:bg-gray-50"
            >
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:text-blue-800 truncate flex-1 min-w-0"
              >
                {doc.title}
              </a>
              <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                {formatDate(doc.uploadedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
