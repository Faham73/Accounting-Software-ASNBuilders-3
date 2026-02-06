import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { createAuditLog } from '@/lib/audit';
import { validateVoucherBalance, isLeafAccount } from '@/lib/voucher';

/**
 * POST /api/tools/import/post
 * Bulk post imported vouchers
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'POST');

    const body = await request.json();
    const { voucherIds }: { voucherIds: string[] } = body;

    if (!voucherIds || !Array.isArray(voucherIds) || voucherIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No voucher IDs provided',
        },
        { status: 400 }
      );
    }

    const results = {
      posted: 0,
      skipped: 0,
      errors: [] as Array<{ voucherId: string; error: string }>,
    };

    // Post each voucher
    for (const voucherId of voucherIds) {
      try {
        const voucher = await prisma.voucher.findUnique({
          where: { id: voucherId },
          include: {
            lines: {
              include: {
                account: true,
              },
            },
          },
        });

        if (!voucher || voucher.companyId !== auth.companyId) {
          results.skipped++;
          results.errors.push({
            voucherId,
            error: 'Voucher not found or does not belong to your company',
          });
          continue;
        }

        // Only DRAFT vouchers can be posted
        if (voucher.status !== 'DRAFT') {
          results.skipped++;
          results.errors.push({
            voucherId,
            error: 'Only DRAFT vouchers can be posted',
          });
          continue;
        }

        // Validate balance
        const balanceCheck = validateVoucherBalance(
          voucher.lines.map((line) => ({
            debit: Number(line.debit),
            credit: Number(line.credit),
          }))
        );
        if (!balanceCheck.valid) {
          results.skipped++;
          results.errors.push({
            voucherId,
            error: balanceCheck.error || 'Voucher is not balanced',
          });
          continue;
        }

        // Validate all accounts are active
        const inactiveAccounts = voucher.lines.filter((line) => !line.account.isActive);
        if (inactiveAccounts.length > 0) {
          results.skipped++;
          results.errors.push({
            voucherId,
            error: 'Cannot post voucher with inactive accounts',
          });
          continue;
        }

        // Validate all accounts are leaf accounts
        let hasNonLeafAccount = false;
        for (const line of voucher.lines) {
          const isLeaf = await isLeafAccount(line.accountId);
          if (!isLeaf) {
            hasNonLeafAccount = true;
            break;
          }
        }

        if (hasNonLeafAccount) {
          results.skipped++;
          results.errors.push({
            voucherId,
            error: 'Cannot post voucher with non-leaf accounts',
          });
          continue;
        }

        const before = { ...voucher };

        // Update voucher status to POSTED
        const updated = await prisma.voucher.update({
          where: { id: voucherId },
          data: {
            status: 'POSTED',
            postedAt: new Date(),
            postedByUserId: auth.userId,
          },
          include: {
            project: {
              select: { id: true, name: true },
            },
            createdBy: {
              select: { id: true, name: true, email: true },
            },
            postedBy: {
              select: { id: true, name: true, email: true },
            },
            lines: {
              include: {
                account: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
          },
        });

        // Create audit log
        await createAuditLog({
          companyId: auth.companyId,
          actorUserId: auth.userId,
          entityType: 'VOUCHER',
          entityId: updated.id,
          action: 'POST',
          before,
          after: updated,
          request,
        });

        results.posted++;
      } catch (error) {
        results.skipped++;
        results.errors.push({
          voucherId,
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
