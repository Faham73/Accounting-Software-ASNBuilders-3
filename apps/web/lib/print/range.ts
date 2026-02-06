/**
 * Date range utilities for print/export features
 */

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Parse date range from query params
 */
export function parseDateRange(searchParams: URLSearchParams): DateRange | null {
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  if (!fromParam || !toParam) {
    return null;
  }

  const from = new Date(fromParam);
  const to = new Date(toParam);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return null;
  }

  // Ensure to date includes full day
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

/**
 * Get default date range (current month)
 */
export function getDefaultDateRange(): DateRange {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return { from, to };
}

/**
 * Get last 30 days date range
 */
export function getLast30DaysRange(): DateRange {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  from.setHours(0, 0, 0, 0);

  return { from, to };
}

/**
 * Get date range from query params or use default
 */
export function getDateRange(searchParams: URLSearchParams, defaultRange: () => DateRange = getDefaultDateRange): DateRange {
  const parsed = parseDateRange(searchParams);
  return parsed || defaultRange();
}
