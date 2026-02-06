import { prisma } from '@accounting/db';

export interface WorkerPayablesAging {
  d0_7: number;
  d8_15: number;
  d16_30: number;
  d31_plus: number;
}

export interface WorkerPayablesItem {
  workerKey: string;
  workerLabel: string;
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
  aging: WorkerPayablesAging;
  lastWorkDate: string | null;
}

export interface ProjectWorkerPayables {
  totals: {
    totalLaborAmount: number;
    totalPaid: number;
    totalDue: number;
    workerCountWithDue: number;
  };
  workers: WorkerPayablesItem[];
}

function getAgingBucket(daysOutstanding: number): keyof WorkerPayablesAging {
  if (daysOutstanding <= 7) return 'd0_7';
  if (daysOutstanding <= 15) return 'd8_15';
  if (daysOutstanding <= 30) return 'd16_30';
  return 'd31_plus';
}

/**
 * Build worker key for grouping: "DAY|name" (Worker Payables is DAY labor only).
 */
function buildWorkerKey(workerName: string | null): string {
  const name = (workerName || 'Unknown').trim() || 'Unknown';
  return `DAY|${name}`;
}

/**
 * Get worker payables for a project: totals and per-worker breakdown with aging.
 * DAY labor ONLY (excludes MONTHLY and CONTRACT). Uses labor.date as work date for aging.
 * paid/due from schema; if due is null, due = max(0, amount - paid).
 * Aging buckets apply to DUE amount only.
 */
export async function getProjectWorkerPayables(
  projectId: string,
  companyId: string
): Promise<ProjectWorkerPayables> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true },
  });

  if (!project) {
    throw new Error('Project not found or does not belong to company');
  }

  const labors = await prisma.projectLabor.findMany({
    where: { projectId, companyId, type: 'DAY' },
    select: {
      id: true,
      type: true,
      date: true,
      amount: true,
      paid: true,
      due: true,
      workerName: true,
      employeeName: true,
    },
    orderBy: { date: 'desc' },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const workerMap = new Map<
    string,
    {
      workerKey: string;
      workerLabel: string;
      totalAmount: number;
      totalPaid: number;
      totalDue: number;
      aging: WorkerPayablesAging;
      lastWorkDate: Date | null;
    }
  >();

  for (const l of labors) {
    const amount = l.amount.toNumber();
    const paid = l.paid?.toNumber() ?? 0;
    const due =
      l.due != null
        ? Math.max(0, l.due.toNumber())
        : Math.max(0, amount - paid);

    const workerKey = buildWorkerKey(l.workerName);
    const workerLabel = (l.workerName || 'Unknown').trim() || 'Unknown';

    const workDate = new Date(l.date);
    workDate.setHours(0, 0, 0, 0);
    const daysOutstanding = Math.floor(
      (today.getTime() - workDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    const bucket = getAgingBucket(daysOutstanding);

    let row = workerMap.get(workerKey);
    if (!row) {
      row = {
        workerKey,
        workerLabel,
        totalAmount: 0,
        totalPaid: 0,
        totalDue: 0,
        aging: { d0_7: 0, d8_15: 0, d16_30: 0, d31_plus: 0 },
        lastWorkDate: null,
      };
      workerMap.set(workerKey, row);
    }

    row.totalAmount += amount;
    row.totalPaid += paid;
    row.totalDue += due;
    row.aging[bucket] += due;
    if (!row.lastWorkDate || l.date > row.lastWorkDate) {
      row.lastWorkDate = l.date;
    }
  }

  let totalLaborAmount = 0;
  let totalPaid = 0;
  let totalDue = 0;
  let workerCountWithDue = 0;
  const workers: WorkerPayablesItem[] = [];

  for (const row of workerMap.values()) {
    totalLaborAmount += row.totalAmount;
    totalPaid += row.totalPaid;
    totalDue += row.totalDue;
    if (row.totalDue > 0) workerCountWithDue++;
    workers.push({
      workerKey: row.workerKey,
      workerLabel: row.workerLabel,
      totalAmount: row.totalAmount,
      totalPaid: row.totalPaid,
      totalDue: row.totalDue,
      aging: { ...row.aging },
      lastWorkDate: row.lastWorkDate
        ? row.lastWorkDate.toISOString().split('T')[0]
        : null,
    });
  }

  workers.sort((a, b) => b.totalDue - a.totalDue);

  return {
    totals: {
      totalLaborAmount,
      totalPaid,
      totalDue,
      workerCountWithDue,
    },
    workers,
  };
}

export interface WorkerLedgerEntry {
  laborId: string;
  date: string;
  type: string;
  amount: number;
  paid: number;
  due: number;
  note: string | null;
  link: string;
}

export interface ProjectWorkerLedger {
  workerKey: string;
  workerLabel: string;
  summary: { totalAmount: number; totalPaid: number; totalDue: number };
  entries: WorkerLedgerEntry[];
}

/**
 * Parse workerKey from URL (e.g. "DAY%7CJohn" -> DAY|John)
 */
export function parseWorkerKey(encoded: string): { type: 'DAY' | 'MONTHLY'; name: string } | null {
  try {
    const decoded = decodeURIComponent(encoded);
    const idx = decoded.indexOf('|');
    if (idx === -1) return null;
    const type = decoded.slice(0, idx) as 'DAY' | 'MONTHLY';
    const name = decoded.slice(idx + 1);
    if (type !== 'DAY' && type !== 'MONTHLY') return null;
    return { type, name: name || 'Unknown' };
  } catch {
    return null;
  }
}

/**
 * Get ledger for a single worker (grouped by workerKey) in the project.
 */
export async function getProjectWorkerLedger(
  projectId: string,
  workerKeyEncoded: string,
  companyId: string
): Promise<ProjectWorkerLedger | null> {
  const parsed = parseWorkerKey(workerKeyEncoded);
  if (!parsed) return null;

  const { type, name } = parsed;

  const where =
    type === 'DAY'
      ? {
          projectId,
          companyId,
          type: 'DAY' as const,
          OR: [{ workerName: name }, { employeeName: name }],
        }
      : {
          projectId,
          companyId,
          type: 'MONTHLY' as const,
          OR: [{ employeeName: name }, { workerName: name }],
        };

  const labors = await prisma.projectLabor.findMany({
    where,
    select: {
      id: true,
      date: true,
      type: true,
      amount: true,
      paid: true,
      due: true,
      note: true,
    },
    orderBy: { date: 'asc' },
  });

  if (labors.length === 0) return null;

  let totalAmount = 0;
  let totalPaid = 0;
  let totalDue = 0;
  const entries: WorkerLedgerEntry[] = [];

  for (const l of labors) {
    const amount = l.amount.toNumber();
    const paid = l.paid?.toNumber() ?? 0;
    const due =
      l.due != null
        ? Math.max(0, l.due.toNumber())
        : Math.max(0, amount - paid);
    totalAmount += amount;
    totalPaid += paid;
    totalDue += due;
    entries.push({
      laborId: l.id,
      date: l.date.toISOString().split('T')[0],
      type: l.type,
      amount,
      paid,
      due,
      note: l.note,
      link: `/dashboard/projects/${projectId}/labor/${l.type === 'DAY' ? 'day' : 'monthly'}?laborId=${l.id}`,
    });
  }

  return {
    workerKey: workerKeyEncoded,
    workerLabel: name,
    summary: { totalAmount, totalPaid, totalDue },
    entries,
  };
}
