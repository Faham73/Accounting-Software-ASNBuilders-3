import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import DashboardLayout from '../../components/DashboardLayout';
import ProjectForm from '../components/ProjectForm';

export default async function NewProjectPage() {
  try {
    await requirePermissionServer('projects', 'WRITE');
  } catch (error) {
    redirect('/forbidden');
  }

  return (
    <DashboardLayout title="New Project">
      <ProjectForm />
    </DashboardLayout>
  );
}
