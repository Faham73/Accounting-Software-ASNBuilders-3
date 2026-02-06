import { prisma } from '@accounting/db';
import { AccountType } from '@accounting/db';
import { decimalToNumber } from './helpers';

/**
 * Find cash accounts (by name containing "Cash")
 */
export async function findCashAccounts(companyId: string) {
  return prisma.account.findMany({
    where: {
      companyId,
      isActive: true,
      type: 'ASSET',
      name: { contains: 'Cash', mode: 'insensitive' },
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
    orderBy: { code: 'asc' },
  });
}

/**
 * Find bank accounts (by name containing "Bank")
 */
export async function findBankAccounts(companyId: string) {
  return prisma.account.findMany({
    where: {
      companyId,
      isActive: true,
      type: 'ASSET',
      name: { contains: 'Bank', mode: 'insensitive' },
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
    orderBy: { code: 'asc' },
  });
}

export interface LedgerEntry {
  id: string;
  date: Date;
  voucherId: string;
  voucherNo: string;
  voucherType: string | null;
  narration: string | null;
  projectId: string | null;
  projectName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  accountCode: string;
  accountName: string;
  description: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

/**
 * Get account ledger (all posted voucher lines for an account)
 * Returns entries sorted by date then voucher number, with running balance
 */
export async function getAccountLedger(
  accountId: string,
  companyId: string,
  from?: Date,
  to?: Date
): Promise<{
  account: { id: string; code: string; name: string; type: AccountType };
  entries: LedgerEntry[];
  openingBalance: number;
  closingBalance: number;
}> {
  // Get account details
  const account = await prisma.account.findUnique({
    where: { id: accountId, companyId },
  });

  if (!account) {
    throw new Error('Account not found');
  }

  // Build date filter
  const dateFilter: any = {};
  if (from || to) {
    dateFilter.voucher = {};
    if (from) {
      dateFilter.voucher.date = { ...dateFilter.voucher.date, gte: from };
    }
    if (to) {
      dateFilter.voucher.date = { ...dateFilter.voucher.date, lte: to };
    }
  }

  // Get all posted voucher lines for this account
  const lines = await prisma.voucherLine.findMany({
    where: {
      accountId,
      companyId,
      voucher: {
        status: { in: ['POSTED', 'REVERSED'] },
        ...dateFilter.voucher,
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
          projectId: true,
        },
      },
      account: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      vendor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { voucher: { date: 'asc' } },
      { voucher: { voucherNo: 'asc' } },
      { createdAt: 'asc' },
    ],
  });

  // Calculate opening balance (sum of all lines before 'from' date if specified)
  let openingBalance = 0;
  if (from) {
    const openingLines = await prisma.voucherLine.findMany({
      where: {
        accountId,
        companyId,
        voucher: {
          status: { in: ['POSTED', 'REVERSED'] },
          date: { lt: from },
        },
      },
      select: {
        debit: true,
        credit: true,
      },
    });

    for (const line of openingLines) {
      const debit = decimalToNumber(line.debit);
      const credit = decimalToNumber(line.credit);
      // For assets/expenses: balance = debit - credit
      // For liabilities/equity/income: balance = credit - debit
      if (account.type === 'ASSET' || account.type === 'EXPENSE') {
        openingBalance += debit - credit;
      } else {
        openingBalance += credit - debit;
      }
    }
  }

  // Calculate running balance
  let runningBalance = openingBalance;
  const entries: LedgerEntry[] = lines.map((line) => {
    const debit = decimalToNumber(line.debit);
    const credit = decimalToNumber(line.credit);

    // Calculate impact based on account type
    let impact: number;
    if (account.type === 'ASSET' || account.type === 'EXPENSE') {
      impact = debit - credit; // Assets/expenses increase with debit
    } else {
      impact = credit - debit; // Liabilities/equity/income increase with credit
    }

    runningBalance += impact;

    return {
      id: line.id,
      date: line.voucher.date,
      voucherId: line.voucher.id,
      voucherNo: line.voucher.voucherNo,
      voucherType: line.voucher.type,
      narration: line.voucher.narration,
      projectId: line.voucher.projectId,
      projectName: line.project?.name || null,
      vendorId: line.vendor?.id || null,
      vendorName: line.vendor?.name || null,
      accountCode: line.account.code,
      accountName: line.account.name,
      description: line.description,
      debit,
      credit,
      runningBalance,
    };
  });

  const closingBalance = runningBalance;

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
    },
    entries,
    openingBalance,
    closingBalance,
  };
}
