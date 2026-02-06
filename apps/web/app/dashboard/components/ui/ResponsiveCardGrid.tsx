import { ReactNode } from 'react';

interface ResponsiveCardGridProps {
  children: ReactNode;
  cols?: 3 | 5 | 6;
}

export function ResponsiveCardGrid({ children, cols = 3 }: ResponsiveCardGridProps) {
  const gridClass =
    cols === 6
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-6'
      : cols === 5
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6'
        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6';
  return <div className={gridClass}>{children}</div>;
}
