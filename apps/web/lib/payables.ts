import { prisma } from '@accounting/db';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Format Decimal to money string
 */
export function toMoney(decimal: Decimal | number | string | null | undefined): string {
  if (!decimal) return '0.00';
  const num = typeof decimal === 'string' ? parseFloat(decimal) : typeof decimal === 'number' ? decimal : Number(decimal);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Convert Decimal to number safely
 */
export function decimalToNumber(decimal: Decimal | number | string | null | undefined): number {
  if (!decimal) return 0;
  if (typeof decimal === 'number') return decimal;
  if (typeof decimal === 'string') return parseFloat(decimal) || 0;
  return Number(decimal);
}

/**
 * Get vendor ledger lines (all posted voucher lines for a vendor)
 * Includes running balance calculation
 */
export async function getVendorLedger(vendorId: string, companyId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId, companyId },
    select: { id: true, name: true, phone: true, address: true },
  });

  if (!vendor) {
    throw new Error('Vendor not found');
  }

  // Get all posted voucher lines for this vendor
  const lines = await prisma.voucherLine.findMany({
    where: {
      vendorId,
      companyId,
      voucher: {
        status: 'POSTED',
      },
    },
    include: {
      voucher: {
        select: {
          id: true,
          voucherNo: true,
          date: true,
          type: true,
          narration: true,
        },
      },
      account: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
    orderBy: [
      { voucher: { date: 'asc' } },
      { createdAt: 'asc' },
    ],
  });

  // Calculate running balance
  let runningBalance = 0;
  const ledgerLines = lines.map((line) => {
    const debit = decimalToNumber(line.debit);
    const credit = decimalToNumber(line.credit);
    const impact = credit - debit; // AP increases with credit
    runningBalance += impact;

    return {
      id: line.id,
      date: line.voucher.date,
      voucherId: line.voucher.id,
      voucherNo: line.voucher.voucherNo,
      voucherType: line.voucher.type,
      narration: line.voucher.narration || line.description || '',
      accountCode: line.account.code,
      accountName: line.account.name,
      debit,
      credit,
      impact,
      runningBalance,
    };
  });

  // Calculate GL balance (sum of all posted lines)
  const glBalance = ledgerLines.reduce((sum, line) => sum + line.impact, 0);

  return {
    vendor,
    lines: ledgerLines,
    glBalance,
  };
}

/**
 * Get vendor open items (payable source lines with outstanding amounts)
 * Used when creating payment vouchers
 */
export async function getVendorOpenItems(vendorId: string, companyId: string) {
  // Get all posted voucher lines for this vendor that increase payable (credit > debit)
  const payableLines = await prisma.voucherLine.findMany({
    where: {
      vendorId,
      companyId,
      voucher: {
        status: 'POSTED',
      },
    },
    include: {
      voucher: {
        select: {
          id: true,
          voucherNo: true,
          date: true,
          narration: true,
        },
      },
      account: {
        select: {
          code: true,
          name: true,
        },
      },
      sourceAllocations: {
        where: {
          paymentVoucher: {
            status: 'POSTED', // Only count allocations from posted payment vouchers
          },
        },
        select: {
          amount: true,
        },
      },
    },
    orderBy: [
      { voucher: { date: 'asc' } },
      { createdAt: 'asc' },
    ],
  });

  // Calculate outstanding for each line
  const openItems = payableLines
    .map((line) => {
      const debit = decimalToNumber(line.debit);
      const credit = decimalToNumber(line.credit);
      const originalAmount = credit - debit; // AP increases with credit

      // Only consider lines that increase payable (positive originalAmount)
      if (originalAmount <= 0) return null;

      // Sum allocations from posted payment vouchers
      const allocatedAmount = line.sourceAllocations.reduce(
        (sum, alloc) => sum + decimalToNumber(alloc.amount),
        0
      );

      const outstanding = originalAmount - allocatedAmount;

      // Only return items with outstanding > 0
      if (outstanding <= 0) return null;

      return {
        lineId: line.id,
        voucherId: line.voucher.id,
        voucherNo: line.voucher.voucherNo,
        date: line.voucher.date,
        narration: line.voucher.narration || line.description || '',
        accountCode: line.account.code,
        accountName: line.account.name,
        originalAmount,
        allocatedAmount,
        outstanding,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return openItems;
}

/**
 * Get payables summary (open balance per vendor)
 * Uses allocation method to compute outstanding payables
 */
export async function getPayablesSummary(companyId: string, showZeroBalances: boolean = false) {
  // Get all vendors
  const vendors = await prisma.vendor.findMany({
    where: {
      companyId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });

  // Get all posted voucher lines with vendors
  const vendorLines = await prisma.voucherLine.findMany({
    where: {
      companyId,
      vendorId: { not: null },
      voucher: {
        status: 'POSTED',
      },
    },
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
        },
      },
      voucher: {
        select: {
          id: true,
          date: true,
        },
      },
      sourceAllocations: {
        where: {
          paymentVoucher: {
            status: 'POSTED',
          },
        },
        select: {
          amount: true,
        },
      },
    },
  });

  // Group by vendor and calculate balances
  const vendorBalances = new Map<
    string,
    {
      vendorId: string;
      vendorName: string;
      glBalance: number;
      openBalance: number;
      lastActivityDate: Date | null;
    }
  >();

  // Initialize all vendors
  vendors.forEach((vendor) => {
    vendorBalances.set(vendor.id, {
      vendorId: vendor.id,
      vendorName: vendor.name,
      glBalance: 0,
      openBalance: 0,
      lastActivityDate: null,
    });
  });

  // Process lines
  vendorLines.forEach((line) => {
    if (!line.vendor) return;

    const vendorId = line.vendor.id;
    const balance = vendorBalances.get(vendorId);
    if (!balance) return;

    const debit = decimalToNumber(line.debit);
    const credit = decimalToNumber(line.credit);
    const impact = credit - debit;

    // Update GL balance
    balance.glBalance += impact;

    // Update open balance (only for payable-increasing lines)
    if (impact > 0) {
      const allocatedAmount = line.sourceAllocations.reduce(
        (sum, alloc) => sum + decimalToNumber(alloc.amount),
        0
      );
      const outstanding = impact - allocatedAmount;
      if (outstanding > 0) {
        balance.openBalance += outstanding;
      }
    }

    // Update last activity date
    if (!balance.lastActivityDate || line.voucher.date > balance.lastActivityDate) {
      balance.lastActivityDate = line.voucher.date;
    }
  });

  // Convert to array and filter
  let summary = Array.from(vendorBalances.values());

  // Filter zero balances if requested
  if (!showZeroBalances) {
    summary = summary.filter((item) => item.openBalance > 0);
  }

  // Sort by open balance descending
  summary.sort((a, b) => b.openBalance - a.openBalance);

  return summary;
}

/**
 * Get vendor GL balance (sum of all posted lines)
 */
export async function getVendorGLBalance(vendorId: string, companyId: string): Promise<number> {
  const result = await prisma.voucherLine.aggregate({
    where: {
      vendorId,
      companyId,
      voucher: {
        status: 'POSTED',
      },
    },
    _sum: {
      debit: true,
      credit: true,
    },
  });

  const totalDebit = decimalToNumber(result._sum.debit);
  const totalCredit = decimalToNumber(result._sum.credit);
  return totalCredit - totalDebit; // AP increases with credit
}

/**
 * Get vendor open balance (outstanding payables using allocations)
 */
export async function getVendorOpenBalance(vendorId: string, companyId: string): Promise<number> {
  const openItems = await getVendorOpenItems(vendorId, companyId);
  return openItems.reduce((sum, item) => sum + item.outstanding, 0);
}
