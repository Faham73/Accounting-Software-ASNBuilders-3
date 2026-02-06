import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import DashboardLayout from '../components/DashboardLayout';
import ExpensesList from './components/ExpensesList';

export default async function ExpensesPage() {
  let auth;
  try {
    auth = await requirePermissionServer('expenses', 'READ');
  } catch {
    redirect('/forbidden');
  }

  const canWrite = can(auth.role, 'expenses', 'WRITE');

  return (
    <DashboardLayout title="Expenses">
      <ExpensesList canWrite={canWrite} />
    </DashboardLayout>
  );
}
