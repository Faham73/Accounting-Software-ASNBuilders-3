import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import DashboardLayout from '../components/DashboardLayout';
import ExpenseCategoriesList from './components/ExpenseCategoriesList';

export default async function ExpenseCategoriesPage() {
  let auth;
  try {
    auth = await requirePermissionServer('expenses', 'READ');
  } catch {
    redirect('/forbidden');
  }

  const canWrite = can(auth.role, 'expenses', 'WRITE');

  return (
    <DashboardLayout title="Expense Categories">
      <ExpenseCategoriesList canWrite={canWrite} />
    </DashboardLayout>
  );
}
