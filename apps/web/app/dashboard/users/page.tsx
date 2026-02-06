import { redirect } from 'next/navigation';
import { requireAdminServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import { prisma } from '@accounting/db';
import DashboardLayout from '../components/DashboardLayout';
import RolesAndAccessCard from '@/components/users/RolesAndAccessCard';
import UsersList from './components/UsersList';

export default async function UsersPage() {
  let auth;
  try {
    auth = await requireAdminServer();
  } catch {
    redirect('/login');
  }

  const canWrite = can(auth.role, 'users', 'WRITE');
  const users = await prisma.user.findMany({
    where: { companyId: auth.companyId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const userRows = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <DashboardLayout title="Users">
      <UsersList initialUsers={userRows} canWrite={canWrite} />
      <RolesAndAccessCard />
    </DashboardLayout>
  );
}
