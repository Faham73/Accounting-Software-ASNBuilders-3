'use client';

import { ReactNode, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import MobileNav from './MobileNav';
import LogoutButton from '../logout-button';
import { ResponsivePageHeader } from './ui';

interface DashboardLayoutClientProps {
  children: ReactNode;
  title: string;
  actions?: ReactNode;
  sidebarContent: ReactNode;
}

export default function DashboardLayoutClient({
  children,
  title,
  actions,
  sidebarContent,
}: DashboardLayoutClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer when route changes (e.g. user clicks a nav link)
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen w-full flex bg-gray-50 overflow-x-hidden">
      {/* Mobile hamburger - fixed in header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur border-b border-gray-200 z-30 flex items-center px-3 sm:px-6 md:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 -ml-2 rounded-md text-gray-600 hover:bg-gray-100"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="ml-2 font-semibold text-gray-900 truncate">{title}</span>
      </header>

      {/* Mobile drawer */}
      <MobileNav
        sidebarContent={
          <div className="space-y-1">
            {sidebarContent}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <LogoutButton />
            </div>
          </div>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Desktop sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-64 shrink-0 sticky top-0 h-screen overflow-y-auto bg-white/80 backdrop-blur border-r border-gray-200/80 flex-col">
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="mb-4 pb-3 border-b border-gray-200/80">
            <Link href="/dashboard" className="text-base font-semibold text-gray-900 hover:text-gray-700">
              ASN Builders Accounts
            </Link>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-3 px-1">Navigation</p>
          <nav className="space-y-1">{sidebarContent}</nav>
        </div>
        <div className="p-4 border-t border-gray-200/80 bg-white/50">
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto w-full pt-14 md:pt-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 md:p-8">
            {/* Page header - hidden on mobile (title in fixed header) */}
            <div className="hidden md:block">
              <ResponsivePageHeader title={title} actions={actions} />
            </div>
            <div className="md:hidden mt-2 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {actions}
              </div>
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
