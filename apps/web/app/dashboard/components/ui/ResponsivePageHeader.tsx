import { ReactNode } from 'react';
import Link from 'next/link';

interface ResponsivePageHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function ResponsivePageHeader({ title, actions }: ResponsivePageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{title}</h1>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
        {actions}
        <Link
          href="/dashboard"
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 text-center"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
