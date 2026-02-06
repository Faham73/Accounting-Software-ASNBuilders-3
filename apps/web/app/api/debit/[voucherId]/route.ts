import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';

/**
 * GET /api/debit/[voucherId]
 * Return a voucher (debit voucher = at least one line with debit > 0) with all lines and joins.
 * Used by Debit Details page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { voucherId: string } }
) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'READ');

    const voucher = await prisma.voucher.findFirst({
      where: {
        id: params.voucherId,
        companyId: auth.companyId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            parentProjectId: true,
            parentProject: {
              select: { id: true, name: true },
            },
          },
        },
        postedBy: {
          select: { id: true, name: true },
        },
        lines: {
          include: {
            account: {
              select: { id: true, code: true, name: true, type: true },
            },
            project: {
              select: {
                id: true,
                name: true,
                parentProjectId: true,
                parentProject: {
                  select: { id: true, name: true },
                },
              },
            },
            paymentMethod: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!voucher) {
      return NextResponse.json(
        { ok: false, error: 'Voucher not found' },
        { status: 404 }
      );
    }

    const hasDebitLine = voucher.lines.some((l) => Number(l.debit) > 0);
    if (!hasDebitLine) {
      return NextResponse.json(
        { ok: false, error: 'Voucher has no debit lines' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: voucher,
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
