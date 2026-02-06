'use client';

import { useMemo, useState } from 'react';
import {
  can,
  type UserRole,
  type Resource,
  type Action,
} from '@/lib/permissions';

// Display order for resources (grouped: Companies/Settings, then operational)
const RESOURCE_ORDER: Resource[] = [
  'companies',
  'projects',
  'vendors',
  'paymentMethods',
  'vouchers',
  'purchases',
  'expenses',
  'stock',
  'users',
];

const ACTION_ORDER: Action[] = ['READ', 'WRITE', 'POST', 'APPROVE'];

const RESOURCE_LABELS: Record<Resource, string> = {
  companies: 'Companies',
  projects: 'Projects',
  vendors: 'Vendors',
  paymentMethods: 'Payment Methods',
  vouchers: 'Vouchers',
  purchases: 'Purchases',
  expenses: 'Expenses',
  stock: 'Stock',
  users: 'Users',
};

const ACTION_LABELS: Record<Action, string> = {
  READ: 'View',
  WRITE: 'Create / edit draft',
  POST: 'Finalize entry',
  APPROVE: 'Approve before posting',
};

/** Human-readable legend for the legend box (short labels) */
const ACTION_LEGEND_SHORT: Record<Action, string> = {
  READ: 'View',
  WRITE: 'Create/edit draft',
  POST: 'Finalize entry',
  APPROVE: 'Approve before posting',
};

const ROLES_ORDER: UserRole[] = ['ADMIN', 'ACCOUNTANT', 'ENGINEER', 'DATA_ENTRY', 'VIEWER'];

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  ACCOUNTANT: 'Accountant',
  ENGINEER: 'Engineer',
  DATA_ENTRY: 'Data Entry',
  VIEWER: 'Viewer',
};

/**
 * Static "What they do" copy per role. Edit in one place here.
 */
const ROLE_DESCRIPTIONS: Record<UserRole, string[]> = {
  ADMIN: [
    'Full access to company settings and all modules.',
    'Manage users, roles, and company configuration.',
    'Can approve and post vouchers, and perform all accounting operations.',
  ],
  ACCOUNTANT: [
    'Day-to-day accounting and finance operations.',
    'Create and edit vouchers, purchases, expenses, and stock; submit and approve where applicable.',
    'View projects, vendors, and reports; no access to company or user management.',
  ],
  ENGINEER: [
    'View projects, vendors, vouchers, purchases, expenses, and stock for reference.',
    'No create/edit/post/approve permissions; read-only access to operational data.',
  ],
  DATA_ENTRY: [
    'View projects, vendors, payment methods, vouchers, purchases, expenses, and stock.',
    'Read-only; no create, edit, post, or approve permissions.',
  ],
  VIEWER: [
    'View-only access to projects, vendors, payment methods, vouchers, purchases, expenses, and stock.',
    'No create, edit, post, or approve permissions.',
  ],
};

/** Compute per-role access from permissions matrix: resource -> list of actions the role has */
function getRoleAccess(role: UserRole): Map<Resource, Action[]> {
  const map = new Map<Resource, Action[]>();
  for (const resource of RESOURCE_ORDER) {
    const actions: Action[] = [];
    for (const action of ACTION_ORDER) {
      if (can(role, resource, action)) actions.push(action);
    }
    if (actions.length > 0) map.set(resource, actions);
  }
  return map;
}

export default function RolesAndAccessCard() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('ADMIN');

  const roleAccess = useMemo(() => getRoleAccess(selectedRole), [selectedRole]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Roles & Permissions</h2>
      <p className="text-sm text-gray-600 mb-4">
        What each role can do and which areas of the app they can access. Access is derived from
        the current permission rules.
      </p>

      {/* Legend */}
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Action legend</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          {ACTION_ORDER.map((action) => (
            <li key={action}>
              <span className="font-medium text-gray-800">{action}</span> ={' '}
              {ACTION_LEGEND_SHORT[action]}
            </li>
          ))}
        </ul>
      </div>

      {/* Role tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex flex-wrap gap-1" aria-label="Roles">
          {ROLES_ORDER.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={`py-2 px-4 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
                selectedRole === role
                  ? 'border-indigo-600 text-indigo-600 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </nav>
      </div>

      {/* Selected role content */}
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">What they do</h3>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            {ROLE_DESCRIPTIONS[selectedRole].map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Access</h3>
          {roleAccess.size === 0 ? (
            <p className="text-sm text-gray-500">No resource access.</p>
          ) : (
            <ul className="space-y-3">
              {RESOURCE_ORDER.filter((r) => roleAccess.has(r)).map((resource) => (
                <li
                  key={resource}
                  className="border border-gray-200 rounded-lg p-3 bg-gray-50/50"
                >
                  <span className="font-medium text-gray-800">
                    {RESOURCE_LABELS[resource]}
                  </span>
                  <ul className="mt-1.5 flex flex-wrap gap-2">
                    {(roleAccess.get(resource) ?? []).map((action) => (
                      <span
                        key={action}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800"
                      >
                        {action}
                      </span>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
