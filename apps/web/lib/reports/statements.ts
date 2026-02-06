import { prisma } from '@accounting/db';
import { AccountType } from '@accounting/db';
import { decimalToNumber, sumDebitCredit } from './helpers';

export interface TrialBalanceEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  type: AccountType;
  debitTotal: number;
  creditTotal: number;
  netBalance: number;
}

export interface ProfitAndLossData {
  income: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    amount: number;
  }>;
  expenses: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    amount: number;
  }>;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}

export interface BalanceSheetData {
  assets: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    balance: number;
  }>;
  liabilities: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    balance: number;
  }>;
  equity: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    balance: number;
  }>;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  difference: number; // Assets - (Liabilities + Equity), should be 0
}

export interface ProjectProfitabilityData {
  projectId: string | null;
  projectName: string | null;
  income: number;
  expenses: number;
  profit: number;
  incomeByAccount: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    amount: number;
  }>;
  expensesByAccount: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    amount: number;
  }>;
}

/**
 * Get trial balance as of a specific date
 * Sums all posted voucher lines up to and including the asOf date
 */
export async function getTrialBalance(
  companyId: string,
  asOf: Date
): Promise<{
  entries: TrialBalanceEntry[];
  totalDebits: number;
  totalCredits: number;
  difference: number;
}> {
  // Get all accounts
  const accounts = await prisma.account.findMany({
    where: {
      companyId,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
    },
    orderBy: { code: 'asc' },
  });

  // Get all posted voucher lines up to asOf date
  const lines = await prisma.voucherLine.findMany({
    where: {
      companyId,
      voucher: {
        status: { in: ['POSTED', 'REVERSED'] },
        date: { lte: asOf },
      },
    },
    select: {
      accountId: true,
      debit: true,
      credit: true,
    },
  });

  // Group by account and sum
  const accountTotals = new Map<
    string,
    { account: typeof accounts[0]; debitTotal: number; creditTotal: number }
  >();

  // Initialize all accounts
  accounts.forEach((account) => {
    accountTotals.set(account.id, {
      account,
      debitTotal: 0,
      creditTotal: 0,
    });
  });

  // Sum lines
  lines.forEach((line) => {
    const totals = accountTotals.get(line.accountId);
    if (totals) {
      totals.debitTotal += decimalToNumber(line.debit);
      totals.creditTotal += decimalToNumber(line.credit);
    }
  });

  // Build entries
  const entries: TrialBalanceEntry[] = Array.from(accountTotals.values())
    .map(({ account, debitTotal, creditTotal }) => ({
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      type: account.type,
      debitTotal,
      creditTotal,
      netBalance: debitTotal - creditTotal,
    }))
    .filter((entry) => entry.debitTotal !== 0 || entry.creditTotal !== 0); // Only show accounts with activity

  // Calculate totals
  const totalDebits = entries.reduce((sum, e) => sum + e.debitTotal, 0);
  const totalCredits = entries.reduce((sum, e) => sum + e.creditTotal, 0);
  const difference = totalDebits - totalCredits;

  return {
    entries,
    totalDebits,
    totalCredits,
    difference,
  };
}

/**
 * Get Profit & Loss statement for a date range
 * Only includes INCOME and EXPENSE accounts
 */
export async function getProfitAndLoss(
  companyId: string,
  from: Date,
  to: Date
): Promise<ProfitAndLossData> {
  // Get all income and expense accounts
  const accounts = await prisma.account.findMany({
    where: {
      companyId,
      isActive: true,
      type: { in: ['INCOME', 'EXPENSE'] },
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
    },
    orderBy: { code: 'asc' },
  });

  // Get all posted voucher lines in date range
  const lines = await prisma.voucherLine.findMany({
    where: {
      companyId,
      account: {
        type: { in: ['INCOME', 'EXPENSE'] },
      },
      voucher: {
        status: { in: ['POSTED', 'REVERSED'] },
        date: { gte: from, lte: to },
      },
    },
    select: {
      accountId: true,
      debit: true,
      credit: true,
    },
  });

  // Group by account and sum
  const accountTotals = new Map<
    string,
    { account: typeof accounts[0]; amount: number }
  >();

  accounts.forEach((account) => {
    accountTotals.set(account.id, { account, amount: 0 });
  });

  lines.forEach((line) => {
    const totals = accountTotals.get(line.accountId);
    if (totals) {
      const debit = decimalToNumber(line.debit);
      const credit = decimalToNumber(line.credit);
      // Income: credit - debit (income increases with credit)
      // Expense: debit - credit (expense increases with debit)
      if (totals.account.type === 'INCOME') {
        totals.amount += credit - debit;
      } else {
        totals.amount += debit - credit;
      }
    }
  });

  // Separate income and expenses
  const income: ProfitAndLossData['income'] = [];
  const expenses: ProfitAndLossData['expenses'] = [];

  accountTotals.forEach(({ account, amount }) => {
    if (amount === 0) return; // Skip accounts with no activity

    const entry = {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      amount,
    };

    if (account.type === 'INCOME') {
      income.push(entry);
    } else {
      expenses.push(entry);
    }
  });

  const totalIncome = income.reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  return {
    income,
    expenses,
    totalIncome,
    totalExpenses,
    netProfit,
  };
}

/**
 * Get Balance Sheet as of a specific date
 */
export async function getBalanceSheet(
  companyId: string,
  asOf: Date
): Promise<BalanceSheetData> {
  // Get all asset, liability, and equity accounts
  const accounts = await prisma.account.findMany({
    where: {
      companyId,
      isActive: true,
      type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] },
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
    },
    orderBy: { code: 'asc' },
  });

  // Get all posted voucher lines up to asOf date
  const lines = await prisma.voucherLine.findMany({
    where: {
      companyId,
      account: {
        type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] },
      },
      voucher: {
        status: { in: ['POSTED', 'REVERSED'] },
        date: { lte: asOf },
      },
    },
    select: {
      accountId: true,
      debit: true,
      credit: true,
    },
  });

  // Group by account and calculate balance
  const accountBalances = new Map<
    string,
    { account: typeof accounts[0]; balance: number }
  >();

  accounts.forEach((account) => {
    accountBalances.set(account.id, { account, balance: 0 });
  });

  lines.forEach((line) => {
    const balance = accountBalances.get(line.accountId);
    if (balance) {
      const debit = decimalToNumber(line.debit);
      const credit = decimalToNumber(line.credit);
      // Assets: debit - credit (assets increase with debit)
      // Liabilities/Equity: credit - debit (increase with credit)
      if (balance.account.type === 'ASSET') {
        balance.balance += debit - credit;
      } else {
        balance.balance += credit - debit;
      }
    }
  });

  // Separate by type
  const assets: BalanceSheetData['assets'] = [];
  const liabilities: BalanceSheetData['liabilities'] = [];
  const equity: BalanceSheetData['equity'] = [];

  accountBalances.forEach(({ account, balance }) => {
    if (balance === 0) return; // Skip accounts with no balance

    const entry = {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      balance,
    };

    if (account.type === 'ASSET') {
      assets.push(entry);
    } else if (account.type === 'LIABILITY') {
      liabilities.push(entry);
    } else {
      equity.push(entry);
    }
  });

  const totalAssets = assets.reduce((sum, e) => sum + e.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, e) => sum + e.balance, 0);
  const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const difference = totalAssets - totalLiabilitiesAndEquity;

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    difference,
  };
}

/**
 * Get project profitability for a date range
 * If projectId is provided, returns detail for that project
 * If not provided, returns summary for all projects
 */
export async function getProjectProfitability(
  companyId: string,
  from: Date,
  to: Date,
  projectId?: string
): Promise<ProjectProfitabilityData[] | ProjectProfitabilityData> {
  // Get all income and expense accounts
  const accounts = await prisma.account.findMany({
    where: {
      companyId,
      isActive: true,
      type: { in: ['INCOME', 'EXPENSE'] },
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
    },
  });

  // Build filter
  const lineFilter: any = {
    companyId,
    account: {
      type: { in: ['INCOME', 'EXPENSE'] },
    },
    voucher: {
      status: { in: ['POSTED', 'REVERSED'] },
      date: { gte: from, lte: to },
    },
  };

  if (projectId) {
    lineFilter.projectId = projectId;
  }

  // Get all posted voucher lines in date range
  const lines = await prisma.voucherLine.findMany({
    where: lineFilter,
    include: {
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
    },
  });

  if (projectId) {
    // Return detailed breakdown for single project
    const project = await prisma.project.findUnique({
      where: { id: projectId, companyId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Group by account
    const accountTotals = new Map<
      string,
      { account: typeof accounts[0]; amount: number }
    >();

    accounts.forEach((account) => {
      accountTotals.set(account.id, { account, amount: 0 });
    });

    lines.forEach((line) => {
      const totals = accountTotals.get(line.account.id);
      if (totals) {
        const debit = decimalToNumber(line.debit);
        const credit = decimalToNumber(line.credit);
        if (totals.account.type === 'INCOME') {
          totals.amount += credit - debit;
        } else {
          totals.amount += debit - credit;
        }
      }
    });

    const incomeByAccount: ProjectProfitabilityData['incomeByAccount'] = [];
    const expensesByAccount: ProjectProfitabilityData['expensesByAccount'] = [];
    let income = 0;
    let expenses = 0;

    accountTotals.forEach(({ account, amount }) => {
      if (amount === 0) return;

      const entry = {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        amount,
      };

      if (account.type === 'INCOME') {
        incomeByAccount.push(entry);
        income += amount;
      } else {
        expensesByAccount.push(entry);
        expenses += amount;
      }
    });

    return {
      projectId: project.id,
      projectName: project.name,
      income,
      expenses,
      profit: income - expenses,
      incomeByAccount,
      expensesByAccount,
    };
  } else {
    // Return summary for all projects
    // Group by project
    const projectTotals = new Map<
      string,
      {
        projectId: string;
        projectName: string | null;
        income: number;
        expenses: number;
      }
    >();

    lines.forEach((line) => {
      const projectId = line.projectId || 'null';
      const projectName = line.project?.name || null;

      if (!projectTotals.has(projectId)) {
        projectTotals.set(projectId, {
          projectId: projectId === 'null' ? '' : projectId,
          projectName,
          income: 0,
          expenses: 0,
        });
      }

      const totals = projectTotals.get(projectId)!;
      const debit = decimalToNumber(line.debit);
      const credit = decimalToNumber(line.credit);

      if (line.account.type === 'INCOME') {
        totals.income += credit - debit;
      } else {
        totals.expenses += debit - credit;
      }
    });

    // Convert to array and build detailed data
    const results: ProjectProfitabilityData[] = [];

    for (const [projectId, totals] of projectTotals) {
      // Get account-level breakdown for this project
      const projectLines = lines.filter(
        (l) => (l.projectId || 'null') === projectId
      );

      const accountTotals = new Map<string, { account: typeof accounts[0]; income: number; expenses: number }>();

      accounts.forEach((account) => {
        accountTotals.set(account.id, { account, income: 0, expenses: 0 });
      });

      projectLines.forEach((line) => {
        const accTotals = accountTotals.get(line.account.id);
        if (accTotals) {
          const debit = decimalToNumber(line.debit);
          const credit = decimalToNumber(line.credit);
          if (line.account.type === 'INCOME') {
            accTotals.income += credit - debit;
          } else {
            accTotals.expenses += debit - credit;
          }
        }
      });

      const incomeByAccount: ProjectProfitabilityData['incomeByAccount'] = [];
      const expensesByAccount: ProjectProfitabilityData['expensesByAccount'] = [];

      accountTotals.forEach(({ account, income: accIncome, expenses: accExpenses }) => {
        if (accIncome !== 0) {
          incomeByAccount.push({
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            amount: accIncome,
          });
        }
        if (accExpenses !== 0) {
          expensesByAccount.push({
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            amount: accExpenses,
          });
        }
      });

      results.push({
        projectId: totals.projectId,
        projectName: totals.projectName,
        income: totals.income,
        expenses: totals.expenses,
        profit: totals.income - totals.expenses,
        incomeByAccount,
        expensesByAccount,
      });
    }

    return results;
  }
}
