import { prisma } from '@accounting/db';
import { VoucherType, AccountType } from '@accounting/db';
import { Decimal } from '@prisma/client/runtime/library';

export interface ColumnMapping {
  [columnName: string]: string | null; // Maps CSV column to target field, or null to skip
}

export interface ImportOptions {
  voucherKeyColumn?: string | null;
  dateColumn: string;
  accountColumn: string;
  debitColumn: string;
  creditColumn: string;
  typeColumn?: string | null;
  referenceNoColumn?: string | null;
  narrationColumn?: string | null;
  lineMemoColumn?: string | null;
  vendorColumn?: string | null;
  constantType?: VoucherType | null;
  constantReferenceNo?: string | null;
}

export interface ParsedRow {
  [key: string]: string | number | null;
}

export interface VoucherGroup {
  key: string;
  header: {
    date: Date;
    type?: VoucherType;
    referenceNo?: string;
    narration?: string;
    vendor?: string;
  };
  lines: Array<{
    accountId: string | null;
    accountCode: string | null;
    accountName: string | null;
    rawAccountCode?: string | null;
    rawAccountName?: string | null;
    debit: number;
    credit: number;
    description?: string;
    matchedBy?: 'id' | 'code' | 'name' | 'none';
  }>;
  totals: {
    debit: number;
    credit: number;
    difference: number;
  };
  errors: string[];
  warnings: string[];
  parsedLineCount: number; // Total parsed lines before filtering
}

export interface ValidationResult {
  vouchers: VoucherGroup[];
  totalRows: number;
  totalVouchers: number;
  errors: Array<{ voucherKey: string; message: string; severity?: 'blocking' | 'warning' }>;
  warnings: Array<{ voucherKey: string; message: string }>;
  unresolvedAccounts: Array<{ accountCode?: string; accountName?: string; rowIndex: number }>;
}

/**
 * Parse CSV/XLSX data into rows
 */
export function parseFileData(data: any[], headers: string[]): ParsedRow[] {
  return data.map((row) => {
    const parsed: ParsedRow = {};
    headers.forEach((header, index) => {
      parsed[header] = row[index] ?? null;
    });
    return parsed;
  });
}

/**
 * Group rows into vouchers based on voucher key
 */
export function groupRowsIntoVouchers(
  rows: ParsedRow[],
  options: ImportOptions
): Map<string, ParsedRow[]> {
  const groups = new Map<string, ParsedRow[]>();

  for (const row of rows) {
    let key: string;

    if (options.voucherKeyColumn && row[options.voucherKeyColumn]) {
      // Use voucher key column
      key = String(row[options.voucherKeyColumn]);
    } else if (options.referenceNoColumn && row[options.referenceNoColumn] && row[options.dateColumn]) {
      // Group by date + referenceNo
      key = `${row[options.dateColumn]}_${row[options.referenceNoColumn]}`;
    } else {
      // Each row is its own voucher
      key = `row_${rows.indexOf(row)}`;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  }

  return groups;
}

/**
 * Parse date from various formats
 */
export function parseDate(value: string | number | null | undefined): Date | null {
  if (!value) return null;

  const str = String(value).trim();
  if (!str) return null;

  // Try ISO format first
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try common formats: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  ];

  for (const format of formats) {
    const match = str.match(format);
    if (match) {
      let day: number, month: number, year: number;
      if (format === formats[2]) {
        // YYYY-MM-DD
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10) - 1;
        day = parseInt(match[3], 10);
      } else {
        // DD/MM/YYYY or DD-MM-YYYY
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10) - 1;
        year = parseInt(match[3], 10);
      }
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return null;
}

/**
 * Parse number from string
 */
export function parseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const str = String(value).trim().replace(/,/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Resolve account by ID, code, or name with priority
 * Returns account info and how it was matched
 */
export async function resolveAccount(
  companyId: string,
  accountId?: string | null,
  accountCode?: string | null,
  accountName?: string | null
): Promise<{
  account: { id: string; code: string; name: string } | null;
  matchedBy: 'id' | 'code' | 'name' | 'none';
}> {
  // Priority 1: If accountId provided, use it directly
  if (accountId) {
    const byId = await prisma.account.findFirst({
      where: {
        id: accountId,
        companyId,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (byId) {
      return { account: byId, matchedBy: 'id' };
    }
  }

  // Priority 2: Try by code (trim and normalize)
  if (accountCode) {
    const normalizedCode = String(accountCode).trim().replace(/\s+/g, ' ');
    const byCode = await prisma.account.findFirst({
      where: {
        companyId,
        code: normalizedCode,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (byCode) {
      return { account: byCode, matchedBy: 'code' };
    }
  }

  // Priority 3: Try by exact name match
  if (accountName) {
    const normalizedName = String(accountName).trim().replace(/\s+/g, ' ');
    const byExactName = await prisma.account.findFirst({
      where: {
        companyId,
        name: normalizedName,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (byExactName) {
      return { account: byExactName, matchedBy: 'name' };
    }

    // Priority 4: Try case-insensitive match
    const byName = await prisma.account.findFirst({
      where: {
        companyId,
        name: { equals: normalizedName, mode: 'insensitive' },
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (byName) {
      return { account: byName, matchedBy: 'name' };
    }
  }

  return { account: null, matchedBy: 'none' };
}

/**
 * Determine account type from code prefix
 */
export function getAccountTypeFromCode(code: string): AccountType {
  const firstChar = code.trim().charAt(0);
  switch (firstChar) {
    case '1':
      return AccountType.ASSET;
    case '2':
      return AccountType.LIABILITY;
    case '3':
      return AccountType.EQUITY;
    case '4':
      return AccountType.INCOME;
    case '5':
    case '6':
      return AccountType.EXPENSE;
    default:
      return AccountType.EXPENSE;
  }
}

/**
 * Auto-create missing accounts
 * Returns created accounts and updates account cache
 */
export async function autoCreateMissingAccounts(
  companyId: string,
  unresolvedAccounts: Array<{ accountCode?: string | null; accountName?: string | null }>,
  accountCache: Map<string, { account: { id: string; code: string; name: string } | null; matchedBy: 'id' | 'code' | 'name' | 'none' }>
): Promise<{
  created: Array<{ id: string; code: string; name: string }>;
  errors: string[];
}> {
  const created: Array<{ id: string; code: string; name: string }> = [];
  const errors: string[] = [];

  // Get distinct unresolved accounts
  const toCreate = new Map<string, { accountCode?: string | null; accountName?: string | null }>();
  
  for (const acc of unresolvedAccounts) {
    const key = acc.accountCode || acc.accountName || '';
    if (key && !toCreate.has(key)) {
      // Check if it already exists (maybe was created in a previous iteration)
      const existing = accountCache.get(key);
      if (!existing || !existing.account) {
        toCreate.set(key, acc);
      }
    }
  }

  // Create accounts
  for (const [key, acc] of toCreate.entries()) {
    try {
      // Determine code and name
      const accountCode = acc.accountCode || key;
      const accountName = acc.accountName || key;

      // Check if account already exists (double-check)
      const existing = await prisma.account.findFirst({
        where: {
          companyId,
          OR: [
            { code: accountCode },
            { name: accountName },
          ],
        },
      });

      if (existing) {
        // Account exists, update cache
        accountCache.set(key, {
          account: { id: existing.id, code: existing.code, name: existing.name },
          matchedBy: existing.code === accountCode ? 'code' : 'name',
        });
        continue;
      }

      // Determine account type from code prefix
      const accountType = getAccountTypeFromCode(accountCode);

      // Create account
      const newAccount = await prisma.account.create({
        data: {
          companyId,
          code: accountCode,
          name: accountName,
          type: accountType,
          isActive: true,
        },
        select: { id: true, code: true, name: true },
      });

      created.push(newAccount);

      // Update cache
      accountCache.set(key, {
        account: newAccount,
        matchedBy: 'code',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to create account ${acc.accountCode || acc.accountName}: ${errorMsg}`);
    }
  }

  return { created, errors };
}

/**
 * Parse and validate vouchers from rows
 */
export async function parseAndValidateVouchers(
  rows: ParsedRow[],
  options: ImportOptions,
  companyId: string
): Promise<ValidationResult> {
  const groups = groupRowsIntoVouchers(rows, options);
  const vouchers: VoucherGroup[] = [];
  const errors: Array<{ voucherKey: string; message: string; severity?: 'blocking' | 'warning' }> = [];
  const warnings: Array<{ voucherKey: string; message: string }> = [];
  const unresolvedAccounts: Array<{ accountCode?: string; accountName?: string; rowIndex: number }> = [];

  // Get all unique account values for batch resolution
  const accountLookups = new Map<
    string,
    { accountId?: string; accountCode?: string; accountName?: string }
  >();
  for (const row of rows) {
    const accountValue = row[options.accountColumn];
    if (accountValue) {
      const key = String(accountValue).trim();
      if (!accountLookups.has(key)) {
        // Try to determine if it's an ID, code, or name
        // IDs are usually UUIDs or CUIDs
        const isLikelyId = /^[a-z0-9]{20,}$/i.test(key);
        const isLikelyCode = /^[A-Z0-9-]+$/i.test(key) && key.length <= 20 && !isLikelyId;
        accountLookups.set(key, {
          accountId: isLikelyId ? key : undefined,
          accountCode: isLikelyCode ? key : undefined,
          accountName: !isLikelyId && !isLikelyCode ? key : undefined,
        });
      }
    }
  }

  // Batch resolve accounts
  const accountCache = new Map<
    string,
    { account: { id: string; code: string; name: string } | null; matchedBy: 'id' | 'code' | 'name' | 'none' }
  >();
  for (const [key, lookup] of accountLookups.entries()) {
    const resolved = await resolveAccount(
      companyId,
      lookup.accountId,
      lookup.accountCode,
      lookup.accountName
    );
    accountCache.set(key, resolved);
  }

  // Process each voucher group
  for (const [voucherKey, groupRows] of groups.entries()) {
    const voucherErrors: string[] = [];
    const voucherWarnings: string[] = [];

    // Parse header from first row
    const firstRow = groupRows[0];
    const date = parseDate(firstRow[options.dateColumn]);
    if (!date) {
      voucherErrors.push(`Invalid date: ${firstRow[options.dateColumn]}`);
    }

    const type = options.typeColumn && firstRow[options.typeColumn]
      ? (firstRow[options.typeColumn] as VoucherType)
      : options.constantType || VoucherType.JOURNAL;

    const referenceNo = options.referenceNoColumn && firstRow[options.referenceNoColumn]
      ? String(firstRow[options.referenceNoColumn])
      : options.constantReferenceNo || undefined;

    const narration = options.narrationColumn && firstRow[options.narrationColumn]
      ? String(firstRow[options.narrationColumn])
      : undefined;

    const vendor = options.vendorColumn && firstRow[options.vendorColumn]
      ? String(firstRow[options.vendorColumn])
      : undefined;

    // Parse lines - NEVER drop lines, keep all even if account is unresolved
    const lines: VoucherGroup['lines'] = [];
    let totalDebit = 0;
    let totalCredit = 0;
    const parsedLineCount = groupRows.length;

    for (let i = 0; i < groupRows.length; i++) {
      const row = groupRows[i];
      const accountValue = String(row[options.accountColumn] || '').trim();
      const debit = parseNumber(row[options.debitColumn]);
      const credit = parseNumber(row[options.creditColumn]);

      // Validate debit/credit - this is a blocking error
      if (debit > 0 && credit > 0) {
        voucherErrors.push(`Row ${i + 1}: Both debit and credit cannot be greater than 0`);
      }

      // Always compute totals from parsed values
      totalDebit += debit;
      totalCredit += credit;

      // Resolve account
      const accountResult = accountCache.get(accountValue);
      const resolvedAccount = accountResult?.account || null;
      const matchedBy = accountResult?.matchedBy || 'none';

      // Determine raw account code/name for display
      const isLikelyCode = /^[A-Z0-9-]+$/i.test(accountValue) && accountValue.length <= 20;
      const rawAccountCode = isLikelyCode ? accountValue : null;
      const rawAccountName = !isLikelyCode ? accountValue : null;

      // If account not resolved, add error but keep the line
      if (!resolvedAccount) {
        voucherErrors.push(`Row ${i + 1}: Account not found: ${accountValue}`);
        unresolvedAccounts.push({
          accountCode: rawAccountCode ?? undefined,
          accountName: rawAccountName ?? undefined,
          rowIndex: rows.indexOf(row),
        });
      }

      const description = options.lineMemoColumn && row[options.lineMemoColumn]
        ? String(row[options.lineMemoColumn])
        : undefined;

      // Always add the line, even if account is unresolved
      lines.push({
        accountId: resolvedAccount?.id || null,
        accountCode: resolvedAccount?.code || null,
        accountName: resolvedAccount?.name || null,
        rawAccountCode: rawAccountCode || null,
        rawAccountName: rawAccountName || null,
        debit,
        credit,
        description,
        matchedBy,
      });
    }

    // Validate balance - compute from all parsed lines
    const difference = Math.abs(totalDebit - totalCredit);
    if (difference >= 0.01) {
      voucherErrors.push(
        `Voucher is not balanced. Debit: ${totalDebit.toFixed(2)}, Credit: ${totalCredit.toFixed(2)}, Difference: ${difference.toFixed(2)}`
      );
    }

    // Validate line count based on parsed rows, not resolved lines
    if (parsedLineCount < 2) {
      voucherErrors.push('Voucher must have at least 2 lines');
    }

    vouchers.push({
      key: voucherKey,
      header: {
        date: date || new Date(),
        type,
        referenceNo,
        narration,
        vendor,
      },
      lines,
      totals: {
        debit: totalDebit,
        credit: totalCredit,
        difference,
      },
      errors: voucherErrors,
      warnings: voucherWarnings,
      parsedLineCount,
    });

    // Collect errors and warnings with severity
    voucherErrors.forEach((err) => {
      // Determine severity: account not found is warning-level, others are blocking
      const severity = err.includes('Account not found') ? 'warning' : 'blocking';
      errors.push({ voucherKey, message: err, severity });
    });
    voucherWarnings.forEach((warn) => warnings.push({ voucherKey, message: warn }));
  }

  return {
    vouchers,
    totalRows: rows.length,
    totalVouchers: vouchers.length,
    errors,
    warnings,
    unresolvedAccounts: Array.from(
      new Map(unresolvedAccounts.map((item) => [`${item.accountCode || item.accountName}`, item])).values()
    ),
  };
}

/**
 * Convert VoucherType string to enum
 */
export function parseVoucherType(value: string | null | undefined): VoucherType | null {
  if (!value) return null;
  const upper = String(value).toUpperCase().trim();
  if (['RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA'].includes(upper)) {
    return upper as VoucherType;
  }
  return null;
}
