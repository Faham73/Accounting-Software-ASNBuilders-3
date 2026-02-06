import { ReactNode } from 'react';

interface ResponsiveFormGridProps {
  children: ReactNode;
  cols?: 2 | 3;
}

export function ResponsiveFormGrid({ children, cols = 2 }: ResponsiveFormGridProps) {
  const gridClass = cols === 3
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6'
    : 'grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6';
  return <div className={gridClass}>{children}</div>;
}
