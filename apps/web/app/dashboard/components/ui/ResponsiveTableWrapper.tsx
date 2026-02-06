import { ReactNode } from 'react';

interface ResponsiveTableWrapperProps {
  children: ReactNode;
  minWidth?: number;
}

export function ResponsiveTableWrapper({ children, minWidth = 900 }: ResponsiveTableWrapperProps) {
  return (
    <div className="w-full overflow-x-auto -mx-3 sm:mx-0">
      <div className="px-3 sm:px-0" style={{ minWidth: `${minWidth}px` }}>
        {children}
      </div>
    </div>
  );
}
