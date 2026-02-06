import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { createAuditLog } from '@/lib/audit';
import { generateVoucherNumber } from '@/lib/voucher';
import { VoucherGroup, autoCreateMissingAccounts, resolveAccount } from '@/lib/importTools';

/**
 * POST /api/tools/import/commit
 * Import vouchers into database as DRAFT
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    const body = await request.json();
    const { vouchers, options }: { vouchers: any[]; options?: { autoCreateAccounts?: boolean } } = body;

    if (!vouchers || !Array.isArray(vouchers) || vouchers.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No vouchers provided',
        },
        { status: 400 }
      );
    }

    // Accounts are system-managed - auto-creation is disabled
    const autoCreateAccounts = false; // DISABLED: Accounts are system-managed only

    // Validate all vouchers have no blocking errors (excluding "Account not found" if auto-create is enabled)
    const vouchersWithErrors = vouchers.filter((v) => {
      if (!v.errors || v.errors.length === 0) return false;
      // Check for blocking errors (not just warnings)
      return v.errors.some((err: string) => {
        // If auto-create is enabled, skip "Account not found" errors (they become warnings)
        if (autoCreateAccounts && err.includes('Account not found')) {
          return false;
        }
        // Blocking errors: invalid date, unbalanced, < 2 lines, both debit/credit > 0
        return (
          err.includes('Invalid date') ||
          err.includes('not balanced') ||
          err.includes('must have at least 2 lines') ||
          err.includes('Both debit and credit cannot be greater than 0')
        );
      });
    });
    if (vouchersWithErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot import vouchers with blocking errors. ${vouchersWithErrors.length} voucher(s) have errors that must be fixed first.`,
          details: vouchersWithErrors.map((v) => ({
            voucherKey: v.key,
            errors: v.errors,
          })),
        },
        { status: 400 }
      );
    }

    // Collect unresolved accounts
    const unresolvedAccounts: Array<{ accountCode?: string | null; accountName?: string | null }> = [];
    for (const voucher of vouchers) {
      for (const line of voucher.lines) {
        if (!line.accountId) {
          unresolvedAccounts.push({
            accountCode: line.rawAccountCode || line.accountCode,
            accountName: line.rawAccountName || line.accountName,
          });
        }
      }
    }

    // Auto-create accounts if enabled
    let createdAccounts: Array<{ id: string; code: string; name: string }> = [];
    if (autoCreateAccounts && unresolvedAccounts.length > 0) {
      // Build account cache for re-resolution
      const accountCache = new Map<
        string,
        { account: { id: string; code: string; name: string } | null; matchedBy: 'id' | 'code' | 'name' | 'none' }
      >();
      
      // Re-resolve all accounts first (in case some were created manually)
      for (const acc of unresolvedAccounts) {
        const key = (acc.accountCode || acc.accountName || '').trim();
        if (key && !accountCache.has(key)) {
          const resolved = await resolveAccount(
            auth.companyId,
            undefined,
            acc.accountCode || undefined,
            acc.accountName || undefined
          );
          accountCache.set(key, resolved);
        }
      }

      // Create missing accounts
      const createResult = await autoCreateMissingAccounts(
        auth.companyId,
        unresolvedAccounts,
        accountCache
      );
      createdAccounts = createResult.created;

      if (createResult.errors.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `Failed to create some accounts: ${createResult.errors.join(', ')}`,
          },
          { status: 400 }
        );
      }

      // Re-resolve accounts in voucher lines using the updated cache
      for (const voucher of vouchers) {
        for (const line of voucher.lines) {
          if (!line.accountId) {
            const key = (line.rawAccountCode || line.rawAccountName || line.accountCode || line.accountName || '').trim();
            if (key) {
              const resolved = accountCache.get(key);
              if (resolved && resolved.account) {
                line.accountId = resolved.account.id;
                line.accountCode = resolved.account.code;
                line.accountName = resolved.account.name;
              } else {
                // Try one more time to resolve (in case it was just created)
                const reResolved = await resolveAccount(
                  auth.companyId,
                  undefined,
                  line.rawAccountCode || line.accountCode || undefined,
                  line.rawAccountName || line.accountName || undefined
                );
                if (reResolved.account) {
                  line.accountId = reResolved.account.id;
                  line.accountCode = reResolved.account.code;
                  line.accountName = reResolved.account.name;
                  accountCache.set(key, reResolved);
                }
              }
            }
          }
        }
      }
    } else {
      // Validate all lines have resolved accounts (accounts are system-managed, no auto-creation)
      for (const voucher of vouchers) {
        const unresolvedLines = voucher.lines.filter((line: { accountId?: string | null }) => !line.accountId);
        if (unresolvedLines.length > 0) {
          return NextResponse.json(
            {
              ok: false,
              error: `Cannot import voucher ${voucher.key}: ${unresolvedLines.length} line(s) have unresolved accounts. All accounts must be system accounts that exist in the system.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as Array<{ voucherKey: string; error: string }>,
      voucherIds: [] as string[],
      createdAccountsCount: createdAccounts.length,
      createdAccounts: createdAccounts.map((acc) => ({
        id: acc.id,
        code: acc.code,
        name: acc.name,
      })),
      importedVoucherCount: 0,
      importedLineCount: 0,
    };

    // Import each voucher in a transaction
    for (const voucher of vouchers) {
      try {
        // Convert date string to Date object
        const voucherDate = voucher.header.date instanceof Date
          ? voucher.header.date
          : new Date(voucher.header.date);

        if (isNaN(voucherDate.getTime())) {
          throw new Error('Invalid date');
        }

        // Generate voucher number
        const voucherNo = await generateVoucherNumber(auth.companyId, voucherDate);

        // Create voucher with lines in transaction
        const created = await prisma.$transaction(async (tx) => {
          const newVoucher = await tx.voucher.create({
            data: {
              companyId: auth.companyId,
              voucherNo,
              date: voucherDate,
              type: voucher.header.type || 'JOURNAL',
              status: 'DRAFT',
              narration: voucher.header.narration || null,
              createdByUserId: auth.userId,
              lines: {
                create: voucher.lines
                  .filter((line: { accountId?: string | null }) => line.accountId !== null) // Only import resolved lines
                  .map((line: { accountId: string; description?: string | null; debit: number; credit: number }) => ({
                    companyId: auth.companyId,
                    accountId: line.accountId!,
                    description: line.description || null,
                    debit: line.debit,
                    credit: line.credit,
                  })),
              },
            },
            include: {
              lines: {
                include: {
                  account: {
                    select: { id: true, code: true, name: true },
                  },
                },
              },
            },
          });

          return newVoucher;
        });

        // Create audit log
        await createAuditLog({
          companyId: auth.companyId,
          actorUserId: auth.userId,
          entityType: 'VOUCHER',
          entityId: created.id,
          action: 'CREATE',
          after: created,
          request,
        });

        results.imported++;
        results.importedVoucherCount++;
        results.importedLineCount += created.lines.length;
        results.voucherIds.push(created.id);
      } catch (error) {
        results.skipped++;
        results.errors.push({
          voucherKey: voucher.key,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      ok: true,
      data: results,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}
