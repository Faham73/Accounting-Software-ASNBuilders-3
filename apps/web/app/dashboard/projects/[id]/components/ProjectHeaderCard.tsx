import type { ProjectStatus } from '@accounting/db';

export interface ProjectHeaderCardProps {
  name: string;
  location?: string | null;
  startDate?: Date | null;
  expectedEndDate?: Date | null;
  status: ProjectStatus;
  managerName?: string | null;
  clientName?: string | null;
  totalFloors?: number | null;
  totalUnits?: number | null;
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Draft',
  PLANNING: 'Planning',
  RUNNING: 'Running',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
};

const STATUS_STYLES: Record<ProjectStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PLANNING: 'bg-blue-100 text-blue-800',
  RUNNING: 'bg-green-100 text-green-800',
  ON_HOLD: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-slate-100 text-slate-800',
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export default function ProjectHeaderCard({
  name,
  location,
  startDate,
  expectedEndDate,
  status,
  managerName,
  clientName,
  totalFloors,
  totalUnits,
}: ProjectHeaderCardProps) {
  const statusLabel = STATUS_LABELS[status] ?? status;
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{name}</h1>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 mb-3">
        {location != null && location !== '' && (
          <span>{location}</span>
        )}
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle}`}
        >
          {statusLabel}
        </span>
      </div>

      {(startDate != null || expectedEndDate != null) && (
        <div className="text-sm text-gray-600 mb-2">
          {startDate != null && <span>{formatDate(startDate)}</span>}
          {startDate != null && expectedEndDate != null && (
            <span className="mx-2 text-gray-400">→</span>
          )}
          {expectedEndDate != null && (
            <span>{formatDate(expectedEndDate)}</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
        {managerName != null && managerName !== '' && (
          <span><span className="font-medium text-gray-700">Manager:</span> {managerName}</span>
        )}
        {clientName != null && clientName !== '' && (
          <span><span className="font-medium text-gray-700">Client:</span> {clientName}</span>
        )}
        {totalFloors != null && (
          <span><span className="font-medium text-gray-700">Floors:</span> {totalFloors}</span>
        )}
        {totalUnits != null && (
          <span><span className="font-medium text-gray-700">Units:</span> {totalUnits}</span>
        )}
      </div>
    </div>
  );
}
