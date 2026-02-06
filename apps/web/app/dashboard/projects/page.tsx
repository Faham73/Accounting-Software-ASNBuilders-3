import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { can } from '@/lib/permissions';
import { prisma } from '@accounting/db';
import DashboardLayout from '../components/DashboardLayout';
import ProjectsList from './components/ProjectsList';
import Link from 'next/link';

export default async function ProjectsPage() {
  let auth;
  try {
    auth = await requirePermissionServer('projects', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  const canWrite = can(auth.role, 'projects', 'WRITE');

  // Fetch initial projects
  const projectsRaw = await prisma.project.findMany({
    where: {
      companyId: auth.companyId,
      isActive: true, // Default to active only
    },
    orderBy: { createdAt: 'desc' },
    include: {
      files: {
        select: { id: true },
      },
      vouchers: {
        select: { id: true },
      },
      parentProject: {
        select: { id: true, name: true },
      },
    },
  });

  // Transform to include computed fields
  const projects = projectsRaw.map((project) => {
    const entriesCount = project.vouchers.length;
    const filesCount = project.files.length;
    
    return {
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      clientContact: project.clientContact,
      siteLocation: project.siteLocation,
      startDate: project.startDate,
      expectedEndDate: project.expectedEndDate,
      contractValue: project.contractValue,
      status: project.status,
      assignedManager: project.assignedManager,
      isActive: project.isActive,
      address: project.address,
      projectManager: project.projectManager,
      projectEngineer: project.projectEngineer,
      companySiteName: project.companySiteName,
      reference: project.reference,
      isMain: project.isMain,
      parentProjectId: project.parentProjectId,
      parentProject: project.parentProject,
      entriesCount,
      filesCount,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  });

  return (
    <DashboardLayout
      title="Projects"
      actions={
        canWrite ? (
          <Link
            href="/dashboard/projects/new"
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            + Add Project
          </Link>
        ) : null
      }
    >
      <ProjectsList initialProjects={projects as any} canWrite={canWrite} />
    </DashboardLayout>
  );
}
