import { toMoney } from '@/lib/payables';

/**
 * Company information constants
 * TODO: Move these to database/configuration in future
 */
export const COMPANY_INFO = {
  name: 'ASN Builders',
  address: '123 Construction Street, Building City, BC 12345',
  phone: '+1 (555) 123-4567',
  email: 'info@asnbuilders.com',
};

/**
 * Format date for display
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format date and time for display
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format date for filename (YYYY-MM-DD)
 */
export function formatDateForFilename(date: Date | string | null | undefined): string {
  if (!date) return 'unknown';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Format money (re-export from payables for consistency)
 */
export { toMoney };

/**
 * Format period string (e.g., "January 1, 2024 to January 31, 2024")
 */
export function formatPeriod(from: Date | string, to: Date | string): string {
  const fromDate = typeof from === 'string' ? new Date(from) : from;
  const toDate = typeof to === 'string' ? new Date(to) : to;
  return `${formatDate(fromDate)} to ${formatDate(toDate)}`;
}

/**
 * Format period short (e.g., "Jan 1 - Jan 31, 2024")
 */
export function formatPeriodShort(from: Date | string, to: Date | string): string {
  const fromDate = typeof from === 'string' ? new Date(from) : from;
  const toDate = typeof to === 'string' ? new Date(to) : to;
  
  const fromStr = fromDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const toStr = toDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  
  return `${fromStr} - ${toStr}`;
}
