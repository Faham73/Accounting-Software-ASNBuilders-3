'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ProjectStatementActionsProps {
  projectId: string;
  projectName: string;
}

export default function ProjectStatementActions({
  projectId,
  projectName,
}: ProjectStatementActionsProps) {
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const from = new Date(year, month, 1);
    return from.toISOString().split('T')[0];
  });

  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const handleDownloadPDF = async () => {
    try {
      const params = new URLSearchParams();
      params.append('id', projectId);
      if (dateFrom) params.append('from', dateFrom);
      if (dateTo) params.append('to', dateTo);
      const response = await fetch(`/api/pdf/project-statement?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-statement-${projectName}-${dateFrom || 'all'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('An error occurred while generating the PDF');
    }
  };

  const printUrl = `/print/projects/${projectId}/statement?from=${dateFrom}&to=${dateTo}`;

  return (
    <div className="flex gap-2 items-center">
      <div className="flex gap-2 items-center text-sm">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-xs"
        />
        <span className="text-gray-500">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-xs"
        />
      </div>
      <Link
        href={printUrl}
        target="_blank"
        className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
      >
        <span>🖨️</span> Print Statement
      </Link>
      <button
        onClick={handleDownloadPDF}
        className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 inline-flex items-center gap-2"
      >
        <span>📄</span> PDF
      </button>
    </div>
  );
}
