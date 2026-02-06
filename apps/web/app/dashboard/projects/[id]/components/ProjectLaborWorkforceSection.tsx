'use client';

import ProjectWorkerPayables from './ProjectWorkerPayables';
import ProjectLaborSummary from './ProjectLaborSummary';

interface ProjectLaborWorkforceSectionProps {
  projectId: string;
}

/**
 * Combined "Labor & Workforce" section: Worker Payables (Day labor only) + Labor & Workforce Summary (all types).
 * Rendered BEFORE Purchases & Payables on the project dashboard.
 */
export default function ProjectLaborWorkforceSection({
  projectId,
}: ProjectLaborWorkforceSectionProps) {
  return (
    <section className="mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Labor & Workforce</h2>
      <div className="flex flex-col gap-6 w-full">
        <div className="w-full">
          <ProjectWorkerPayables projectId={projectId} />
        </div>
        <div className="w-full">
          <ProjectLaborSummary projectId={projectId} />
        </div>
      </div>
    </section>
  );
}
