import { ReactNode } from 'react';
import { headers } from 'next/headers';
import { requireAuthServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import Link from 'next/link';
import DashboardLayoutClient from './DashboardLayoutClient';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  actions?: ReactNode;
}

type NavLink = { label: string; href: string };
type NavSectionLink = { type: 'link'; label: string; href: string; show: boolean; accent?: string };
type NavSectionDropdown = {
  type: 'dropdown';
  label: string;
  pathPrefix: string;
  show: boolean;
  accent?: string;
  children: NavLink[];
};
type NavSectionDropdownNested = {
  type: 'dropdown-nested';
  label: string;
  pathPrefix: string;
  show: boolean;
  accent?: string;
  children: Array<NavLink | { label: string; children: NavLink[] }>;
};
type NavSection = NavSectionLink | NavSectionDropdown | NavSectionDropdownNested;

/** Inline collapsible group using <details> (no client JS). */
function CollapsibleNavGroup({
  label,
  children,
  defaultOpen,
  openWhen,
  accentClass = 'border-l-blue-500',
  pathname,
  pathPrefix,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Override: when true, section is open (e.g. Entries has multiple path prefixes). */
  openWhen?: boolean;
  accentClass?: string;
  pathname: string;
  pathPrefix: string;
}) {
  const isOpenByPath = openWhen ?? pathname.startsWith(pathPrefix);
  return (
    <details open={defaultOpen ?? isOpenByPath} className="group/details">
      <summary className="list-none [&::-webkit-details-marker]:hidden">
        <span
          className={`flex items-center justify-between gap-2 cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md select-none ${isOpenByPath ? `bg-gray-100 font-medium border-l-4 ${accentClass}` : ''}`}
        >
          {label}
          <span className="shrink-0 w-4 h-4 flex items-center justify-center transition-transform group-open/details:rotate-180">
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </span>
      </summary>
      <div className="mt-0.5 ml-0 border-l border-gray-200 pl-2 space-y-0.5">{children}</div>
    </details>
  );
}

export default async function DashboardLayout({
  children,
  title,
  actions,
}: DashboardLayoutProps) {
  const auth = await requireAuthServer();
  const role = auth.role;
  const h = await headers();
  const pathname = h.get('x-pathname') ?? '';

  const isActive = (href: string) => pathname.includes(href);
  const isExact = (href: string) => pathname === href || pathname === href + '/';

  // Permissions (unchanged)
  const canReadProjects = can(role, 'projects', 'READ');
  const canReadVendors = can(role, 'vendors', 'READ');
  const canReadPaymentMethods = can(role, 'paymentMethods', 'READ');
  const canReadVouchers = can(role, 'vouchers', 'READ');
  const canReadPurchases = can(role, 'purchases', 'READ');
  const canReadExpenses = can(role, 'expenses', 'READ');
  const canReadStock = can(role, 'stock', 'READ');
  const canReadUsers = can(role, 'users', 'READ');
  const canWriteProjects = can(role, 'projects', 'WRITE');
  const canWriteVendors = can(role, 'vendors', 'WRITE');
  const canWritePaymentMethods = can(role, 'paymentMethods', 'WRITE');
  const canWriteExpenses = can(role, 'expenses', 'WRITE');
  const canWriteStock = can(role, 'stock', 'WRITE');

  const linkClass = (href: string, exact = false) => {
    const active = exact ? isExact(href) : isActive(href);
    return `block px-3 py-2 text-sm rounded-md hover:bg-gray-50 ${active ? 'bg-gray-100 font-medium text-gray-900 border-l-4 border-blue-500' : 'text-gray-600'}`;
  };
  const subLinkClass = (href: string) => {
    const active = pathname === href || pathname === href + '/' || (href !== '/dashboard' && pathname.startsWith(href));
    return `block pl-8 pr-3 py-1.5 text-sm rounded-md hover:bg-gray-50 ${active ? 'bg-gray-100 font-medium text-gray-900 border-l-4 border-blue-500' : 'text-gray-600'}`;
  };

  // Data-driven nav: single link or dropdown with children
  const navSections: NavSection[] = [
    { type: 'link', label: 'Dashboard', href: '/dashboard', show: true },
    { type: 'link', label: 'Users', href: '/dashboard/users', show: canReadUsers },
    {
      type: 'link',
      label: `Projects ${canWriteProjects ? '✏️' : ''}`,
      href: '/dashboard/projects',
      show: canReadProjects,
    },
    {
      type: 'link',
      label: `Vendors ${canWriteVendors ? '✏️' : ''}`,
      href: '/dashboard/vendors',
      show: canReadVendors,
    },
    {
      type: 'link',
      label: `Payment Methods ${canWritePaymentMethods ? '✏️' : ''}`,
      href: '/dashboard/payment-methods',
      show: canReadPaymentMethods,
    },
    { type: 'link', label: 'Vouchers', href: '/dashboard/vouchers', show: canReadVouchers },
    { type: 'link', label: 'Purchases', href: '/dashboard/purchases', show: canReadPurchases },
    {
      type: 'dropdown',
      label: 'Entries',
      pathPrefix: '/dashboard/investments',
      show: canReadVouchers,
      accent: 'border-l-amber-500',
      children: [
        { label: 'Total Investment', href: '/dashboard/investments' },
        { label: 'Total Expense', href: '/dashboard/debit' },
        { label: 'Total Credit', href: '/dashboard/credit' },
      ],
    },
    {
      type: 'dropdown',
      label: `Expenses ${canWriteExpenses ? '✏️' : ''}`,
      pathPrefix: '/dashboard/expenses',
      show: canReadExpenses,
      accent: 'border-l-emerald-500',
      children: [
        { label: 'Expense Categories', href: '/dashboard/expense-categories' },
      ],
    },
    {
      type: 'dropdown',
      label: `Stock ${canWriteStock ? '✏️' : ''}`,
      pathPrefix: '/dashboard/stock',
      show: canReadStock,
      accent: 'border-l-violet-500',
      children: [
        { label: 'Stock (Overview)', href: '/dashboard/stock' },
        { label: 'Stock Items', href: '/dashboard/stock/items' },
        { label: 'Receive Stock', href: '/dashboard/stock/receive' },
        { label: 'Issue Stock', href: '/dashboard/stock/issue' },
        { label: 'Stock Ledger', href: '/dashboard/stock/ledger' },
      ],
    },
    {
      type: 'dropdown',
      label: 'Tools',
      pathPrefix: '/dashboard/tools',
      show: canReadVouchers,
      accent: 'border-l-slate-500',
      children: [{ label: 'Import Transactions', href: '/dashboard/tools/import-transactions' }],
    },
    {
      type: 'dropdown-nested',
      label: 'Reports',
      pathPrefix: '/dashboard/reports',
      show: canReadVouchers,
      accent: 'border-l-indigo-500',
      children: [
        { label: 'Payables', href: '/dashboard/reports/payables' },
        { label: 'Overhead', href: '/dashboard/reports/overhead' },
        {
          label: 'Financial Statements',
          children: [
            { label: 'Cash Book', href: '/dashboard/reports/financial/cash-book' },
            { label: 'Bank Book', href: '/dashboard/reports/financial/bank-book' },
            { label: 'Trial Balance', href: '/dashboard/reports/financial/trial-balance' },
            { label: 'Profit & Loss', href: '/dashboard/reports/financial/profit-loss' },
            { label: 'Balance Sheet', href: '/dashboard/reports/financial/balance-sheet' },
            { label: 'Project Profitability', href: '/dashboard/reports/financial/project-profitability' },
          ],
        },
      ],
    },
  ];

  const hasVisibleChildren = (section: NavSection) => {
    if (section.type === 'link') return true;
    if (section.type === 'dropdown') return section.children.length > 0;
    if (section.type === 'dropdown-nested') return section.children.length > 0;
    return false;
  };

  const sidebarContent = (
    <>
      {navSections.map((section, i) => {
        if (!section.show || !hasVisibleChildren(section)) return null;

        if (section.type === 'link') {
          return (
            <div key={i} className={i > 0 ? 'mt-3 pt-3 border-t border-gray-100' : ''}>
              <Link
                href={section.href}
                className={linkClass(section.href, section.href === '/dashboard')}
              >
                {section.label}
              </Link>
            </div>
          );
        }

        if (section.type === 'dropdown') {
          const entriesOpen =
            section.pathPrefix === '/dashboard/investments' &&
            (pathname.includes('/dashboard/investments') ||
              pathname.includes('/dashboard/debit') ||
              pathname.includes('/dashboard/credit'));
          return (
            <div key={i} className={i > 0 ? 'mt-3 pt-3 border-t border-gray-100' : ''}>
              <CollapsibleNavGroup
                label={section.label}
                pathPrefix={section.pathPrefix}
                openWhen={entriesOpen}
                accentClass={section.accent ?? 'border-l-blue-500'}
                pathname={pathname}
              >
                {section.children.map((c) => (
                  <Link key={c.href} href={c.href} className={subLinkClass(c.href)}>
                    {c.label}
                  </Link>
                ))}
              </CollapsibleNavGroup>
            </div>
          );
        }

        // dropdown-nested (Reports)
        return (
          <div key={i} className={i > 0 ? 'mt-3 pt-3 border-t border-gray-100' : ''}>
            <CollapsibleNavGroup
              label={section.label}
              pathPrefix={section.pathPrefix}
              accentClass={section.accent ?? 'border-l-blue-500'}
              pathname={pathname}
            >
              <div className="space-y-0.5">
                {section.children.map((item) => {
                  if ('href' in item) {
                    return (
                      <Link key={item.href} href={item.href} className={subLinkClass(item.href)}>
                        {item.label}
                      </Link>
                    );
                  }
                  return (
                    <details
                      key={item.label}
                      open={pathname.startsWith('/dashboard/reports/financial')}
                      className="group/nested"
                    >
                      <summary className="list-none [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center justify-between gap-2 cursor-pointer pl-8 pr-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-md select-none">
                          {item.label}
                          <span className="shrink-0 w-3 h-3 transition-transform group-open/nested:rotate-180">
                            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </span>
                        </span>
                      </summary>
                      <div className="ml-0 pl-2 space-y-0.5 mt-0.5">
                        {item.children.map((c) => (
                          <Link
                            key={c.href}
                            href={c.href}
                            className="block pl-10 pr-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-md hover:text-gray-900"
                          >
                            {pathname === c.href || pathname === c.href + '/' ? (
                              <span className="font-medium text-gray-900 border-l-4 border-indigo-400 -ml-2 pl-2 block">
                                {c.label}
                              </span>
                            ) : (
                              c.label
                            )}
                          </Link>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </CollapsibleNavGroup>
          </div>
        );
      })}
    </>
  );

  return (
    <DashboardLayoutClient title={title} actions={actions} sidebarContent={sidebarContent}>
      {children}
    </DashboardLayoutClient>
  );
}
