'use client';

import { useState } from 'react';

export type UserRole = 'ADMIN' | 'ACCOUNTANT' | 'ENGINEER' | 'DATA_ENTRY' | 'VIEWER';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

interface UsersListProps {
  initialUsers: UserRow[];
  canWrite: boolean;
}

export default function UsersList({ initialUsers, canWrite }: UsersListProps) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    email: '',
    name: '',
    role: 'DATA_ENTRY' as UserRole,
    password: '', // optional; leave empty to generate temp password
  });
  const [createResultAlert, setCreateResultAlert] = useState<{
    setPasswordLink: string;
    email: string;
    temporaryPassword?: string;
  } | null>(null);
  const [resetLinkAlert, setResetLinkAlert] = useState<{ userId: string; link: string } | null>(null);
  const [resetPasswordLoadingId, setResetPasswordLoadingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.ok) setUsers(data.data);
      else setError(data.error || 'Failed to load users');
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const buildSetPasswordLink = (token: string) =>
    `${typeof window !== 'undefined' ? window.location.origin : ''}/set-password?token=${encodeURIComponent(token)}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { /* optional toast */ });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreateResultAlert(null);
    try {
      const payload: { email: string; name: string; role: UserRole; password?: string } = {
        email: addForm.email,
        name: addForm.name,
        role: addForm.role,
      };
      if (addForm.password.trim()) payload.password = addForm.password;
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to create user');
        return;
      }
      const link = data.setPasswordToken ? buildSetPasswordLink(data.setPasswordToken) : '';
      setCreateResultAlert({
        setPasswordLink: link,
        email: data.data.email,
        temporaryPassword: data.data?.temporaryPassword,
      });
      setShowAddForm(false);
      setAddForm({ email: '', name: '', role: 'DATA_ENTRY', password: '' });
      fetchUsers();
    } catch {
      setError('Failed to create user');
    }
  };

  const handleToggleActive = async (user: UserRow) => {
    if (!canWrite) return;
    setError('');
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to update user');
        return;
      }
      fetchUsers();
    } catch {
      setError('Failed to update user');
    }
  };

  const handleResetPassword = async (user: UserRow) => {
    if (!canWrite) return;
    setError('');
    setResetLinkAlert(null);
    setResetPasswordLoadingId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to generate reset link');
        setResetPasswordLoadingId(null);
        return;
      }
      setResetLinkAlert({
        userId: user.id,
        link: buildSetPasswordLink(data.setPasswordToken),
      });
      setResetPasswordLoadingId(null);
    } catch {
      setError('Failed to generate reset link');
      setResetPasswordLoadingId(null);
    }
  };

  const handleRoleChange = async (user: UserRow, newRole: UserRole) => {
    if (!canWrite || newRole === user.role) return;
    setError('');
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to update role');
        return;
      }
      fetchUsers();
    } catch {
      setError('Failed to update role');
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {createResultAlert && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-4 space-y-2">
          <p className="text-sm font-medium text-amber-900">Set password link (show once — copy and share securely)</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={createResultAlert.setPasswordLink}
              className="flex-1 px-2 py-1 text-sm border border-amber-200 rounded bg-white font-mono"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(createResultAlert.setPasswordLink)}
              className="py-1 px-3 rounded border border-amber-300 bg-amber-100 text-amber-900 text-sm font-medium hover:bg-amber-200"
            >
              Copy
            </button>
          </div>
          {createResultAlert.temporaryPassword && (
            <p className="text-sm text-amber-800">
              Or temporary password for <span className="font-mono">{createResultAlert.email}</span>: <span className="font-mono bg-amber-100 px-1">{createResultAlert.temporaryPassword}</span>
            </p>
          )}
          <button type="button" onClick={() => setCreateResultAlert(null)} className="text-sm text-amber-700 underline">
            Dismiss
          </button>
        </div>
      )}

      {resetLinkAlert && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-4 space-y-2">
          <p className="text-sm font-medium text-blue-900">Reset password link (show once — copy and share with user)</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={resetLinkAlert.link}
              className="flex-1 px-2 py-1 text-sm border border-blue-200 rounded bg-white font-mono"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(resetLinkAlert.link)}
              className="py-1 px-3 rounded border border-blue-300 bg-blue-100 text-blue-900 text-sm font-medium hover:bg-blue-200"
            >
              Copy
            </button>
          </div>
          <button type="button" onClick={() => setResetLinkAlert(null)} className="text-sm text-blue-700 underline">
            Dismiss
          </button>
        </div>
      )}

      {canWrite && (
        <div>
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Add user
            </button>
          ) : (
            <form onSubmit={handleCreate} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4 max-w-md">
              <h3 className="font-medium text-gray-900">Add user</h3>
              <p className="text-sm text-gray-600">A Set Password link is always generated. Optionally set a password here, or leave blank to also get a temporary password. No email is sent.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="VIEWER">Viewer</option>
                  <option value="DATA_ENTRY">Data Entry</option>
                  <option value="ENGINEER">Engineer</option>
                  <option value="ACCOUNTANT">Accountant</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password (optional; min 8 chars — or leave blank to generate)</label>
                <input
                  type="password"
                  minLength={8}
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Leave blank to auto-generate"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="py-2 px-4 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                  Create user
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} className="py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                {canWrite && <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className={!user.isActive ? 'bg-gray-50' : ''}>
                  <td className="px-4 py-2 text-sm text-gray-900">{user.email}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{user.name}</td>
                  <td className="px-4 py-2 text-sm">
                    {canWrite ? (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                        className="block w-full max-w-[140px] px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="DATA_ENTRY">Data Entry</option>
                        <option value="ENGINEER">Engineer</option>
                        <option value="ACCOUNTANT">Accountant</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    ) : (
                      <span className="text-gray-900">{user.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span className={user.isActive ? 'text-green-700' : 'text-gray-500'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="px-4 py-2 text-sm space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(user)}
                        className="text-blue-600 hover:underline"
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetPassword(user)}
                        disabled={resetPasswordLoadingId === user.id}
                        className="text-blue-600 hover:underline disabled:opacity-50"
                      >
                        {resetPasswordLoadingId === user.id ? 'Generating...' : 'Reset password'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
