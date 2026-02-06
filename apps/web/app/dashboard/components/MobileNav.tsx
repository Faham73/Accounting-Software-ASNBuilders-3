'use client';

import { ReactNode } from 'react';

interface MobileNavProps {
  sidebarContent: ReactNode;
  open: boolean;
  onClose: () => void;
}

export default function MobileNav({ sidebarContent, open, onClose }: MobileNavProps) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          role="presentation"
          aria-hidden="true"
        />
      )}
      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-64 max-w-[85vw] bg-white shadow-xl z-50 transform transition-transform duration-200 ease-out md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <span className="font-semibold text-gray-900">Menu</span>
            <button
              onClick={onClose}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">{sidebarContent}</div>
        </div>
      </div>
    </>
  );
}
