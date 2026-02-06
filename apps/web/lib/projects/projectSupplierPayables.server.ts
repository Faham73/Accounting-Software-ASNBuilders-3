import { prisma } from '@accounting/db';
import { Prisma } from '@prisma/client';

export interface SupplierPayablesAging {
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
}

export interface SupplierPayablesItem {
  supplierId: string;
  supplierName: string;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  aging: SupplierPayablesAging;
  lastInvoiceDate: string | null;
}

export interface ProjectSupplierPayables {
  totals: {
    totalDue: number;
    totalPaid: number;
    supplierCountWithDue: number;
  };
  suppliers: SupplierPayablesItem[];
}

function buildPurchaseWhere(projectId: string, companyId: string) {
  return prisma.project
    .findFirst({
      where: { id: projectId, companyId },
      select: { id: true, isMain: true, parentProjectId: true },
    })
    .then((project) => {
      if (!project) return null;
      const where: Prisma.PurchaseWhereInput = { companyId };
      if (project.isMain) {
        where.projectId = projectId;
      } else {
        where.projectId = project.parentProjectId ?? projectId;
        where.subProjectId = projectId;
      }
      return where;
    });
}

function getAgingBucket(daysOutstanding: number): keyof SupplierPayablesAging {
  if (daysOutstanding <= 30) return 'd0_30';
  if (daysOutstanding <= 60) return 'd31_60';
  if (daysOutstanding <= 90) return 'd61_90';
  return 'd90_plus';
}

/**
 * Get supplier payables for a project: totals and per-supplier breakdown with aging.
 * Uses purchase.date as invoice date; due amount from purchase.dueAmount.
 */
export async function getProjectSupplierPayables(
  projectId: string,
  companyId: string
): Promise<ProjectSupplierPayables> {
  const baseWhere = await buildPurchaseWhere(projectId, companyId);
  if (!baseWhere) {
    throw new Error('Project not found or does not belong to company');
  }

  const purchases = await prisma.purchase.findMany({
    where: baseWhere,
    select: {
      id: true,
      date: true,
      total: true,
      paidAmount: true,
      dueAmount: true,
      supplierVendorId: true,
      supplierVendor: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const supplierMap = new Map<
    string,
    {
      supplierId: string;
      supplierName: string;
      totalBilled: number;
      totalPaid: number;
      totalDue: number;
      aging: SupplierPayablesAging;
      lastInvoiceDate: Date | null;
    }
  >();

  for (const p of purchases) {
    const supplierId = p.supplierVendorId;
    const total = p.total.toNumber();
    const paid = p.paidAmount.toNumber();
    const due = Math.max(p.dueAmount.toNumber(), 0);

    const invoiceDate = new Date(p.date);
    invoiceDate.setHours(0, 0, 0, 0);
    const daysOutstanding = Math.floor(
      (today.getTime() - invoiceDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    const bucket = getAgingBucket(daysOutstanding);

    let row = supplierMap.get(supplierId);
    if (!row) {
      row = {
        supplierId: p.supplierVendor.id,
        supplierName: p.supplierVendor.name,
        totalBilled: 0,
        totalPaid: 0,
        totalDue: 0,
        aging: { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 },
        lastInvoiceDate: null,
      };
      supplierMap.set(supplierId, row);
    }

    row.totalBilled += total;
    row.totalPaid += paid;
    row.totalDue += due;
    row.aging[bucket] += due;
    if (!row.lastInvoiceDate || p.date > row.lastInvoiceDate) {
      row.lastInvoiceDate = p.date;
    }
  }

  let totalDue = 0;
  let totalPaid = 0;
  let supplierCountWithDue = 0;

  const suppliers: SupplierPayablesItem[] = [];

  for (const row of supplierMap.values()) {
    totalDue += row.totalDue;
    totalPaid += row.totalPaid;
    if (row.totalDue > 0) supplierCountWithDue++;
    suppliers.push({
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      totalBilled: row.totalBilled,
      totalPaid: row.totalPaid,
      totalDue: row.totalDue,
      aging: { ...row.aging },
      lastInvoiceDate: row.lastInvoiceDate
        ? row.lastInvoiceDate.toISOString().split('T')[0]
        : null,
    });
  }

  suppliers.sort((a, b) => b.totalDue - a.totalDue);

  return {
    totals: {
      totalDue,
      totalPaid,
      supplierCountWithDue,
    },
    suppliers,
  };
}

export interface SupplierLedgerInvoice {
  purchaseId: string;
  date: string;
  challanNo: string | null;
  reference: string | null;
  total: number;
  paid: number;
  due: number;
  ageDays: number;
  link: string;
}

export interface ProjectSupplierLedger {
  supplier: { id: string; name: string };
  summary: { totalBilled: number; totalPaid: number; totalDue: number };
  invoices: SupplierLedgerInvoice[];
}

/**
 * Get ledger for a single supplier within a project: summary + list of purchases (invoices).
 */
export async function getProjectSupplierLedger(
  projectId: string,
  supplierId: string,
  companyId: string
): Promise<ProjectSupplierLedger | null> {
  const baseWhere = await buildPurchaseWhere(projectId, companyId);
  if (!baseWhere) {
    throw new Error('Project not found or does not belong to company');
  }

  const purchases = await prisma.purchase.findMany({
    where: {
      ...baseWhere,
      supplierVendorId: supplierId,
    },
    select: {
      id: true,
      date: true,
      challanNo: true,
      reference: true,
      total: true,
      paidAmount: true,
      dueAmount: true,
      supplierVendor: { select: { id: true, name: true } },
    },
    orderBy: { date: 'asc' },
  });

  if (purchases.length === 0) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalBilled = 0;
  let totalPaid = 0;
  let totalDue = 0;
  const invoices: SupplierLedgerInvoice[] = [];

  for (const p of purchases) {
    const total = p.total.toNumber();
    const paid = p.paidAmount.toNumber();
    const due = Math.max(p.dueAmount.toNumber(), 0);
    totalBilled += total;
    totalPaid += paid;
    totalDue += due;

    const invoiceDate = new Date(p.date);
    invoiceDate.setHours(0, 0, 0, 0);
    const ageDays = Math.floor(
      (today.getTime() - invoiceDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    invoices.push({
      purchaseId: p.id,
      date: p.date.toISOString().split('T')[0],
      challanNo: p.challanNo,
      reference: p.reference,
      total,
      paid,
      due,
      ageDays,
      link: `/dashboard/purchases/${p.id}`,
    });
  }

  return {
    supplier: {
      id: purchases[0].supplierVendor.id,
      name: purchases[0].supplierVendor.name,
    },
    summary: { totalBilled, totalPaid, totalDue },
    invoices,
  };
}
