import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { createAuditLog } from '@/lib/audit';
import { generateVoucherNumber, validateVoucherBalance } from '@/lib/voucher';
import { getVendorOpenItems, decimalToNumber } from '@/lib/payables';
import { z, ZodError } from 'zod';

const PaymentVoucherCreateSchema = z.object({
  vendorId: z.string(),
  date: z.string().transform((str) => new Date(str)),
  narration: z.string().optional().nullable(),
  paymentAccountId: z.string(), // Cash/Bank account
  allocations: z.array(
    z.object({
      sourceLineId: z.string(),
      amount: z.number().positive(),
    })
  ),
});

/**
 * POST /api/vouchers/payment
 * Create a payment voucher with allocations to vendor payable lines
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    const body = await request.json();
    const validatedData = PaymentVoucherCreateSchema.parse(body);

    // Validate vendor exists and belongs to company
    const vendor = await prisma.vendor.findUnique({
      where: { id: validatedData.vendorId },
    });

    if (!vendor || vendor.companyId !== auth.companyId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Vendor not found or does not belong to your company',
        },
        { status: 400 }
      );
    }

    // Validate payment account exists and is active
    const paymentAccount = await prisma.account.findUnique({
      where: { id: validatedData.paymentAccountId },
    });

    if (!paymentAccount || paymentAccount.companyId !== auth.companyId || !paymentAccount.isActive || !paymentAccount.isSystem) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Payment account not found, inactive, or is not a system account',
        },
        { status: 400 }
      );
    }

    // Get open items to validate allocations
    const openItems = await getVendorOpenItems(validatedData.vendorId, auth.companyId);
    const openItemsMap = new Map(openItems.map((item) => [item.lineId, item]));

    // Validate allocations
    let totalPayment = 0;
    for (const alloc of validatedData.allocations) {
      const openItem = openItemsMap.get(alloc.sourceLineId);
      if (!openItem) {
        return NextResponse.json(
          {
            ok: false,
            error: `Source line ${alloc.sourceLineId} not found or has no outstanding balance`,
          },
          { status: 400 }
        );
      }

      if (alloc.amount > openItem.outstanding) {
        return NextResponse.json(
          {
            ok: false,
            error: `Allocation amount ${alloc.amount} exceeds outstanding ${openItem.outstanding} for line ${openItem.voucherNo}`,
          },
          { status: 400 }
        );
      }

      totalPayment += alloc.amount;
    }

    if (validatedData.allocations.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'At least one allocation is required',
        },
        { status: 400 }
      );
    }

    // Find Accounts Payable account (LIABILITY type)
    // For v1, we'll search for an account with type LIABILITY
    // In a real system, you'd have a specific AP account or account code
    const apAccount = await prisma.account.findFirst({
      where: {
        companyId: auth.companyId,
        type: 'LIABILITY',
        isActive: true,
      },
    });

    if (!apAccount) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Accounts Payable account not found. Please create a LIABILITY account first.',
        },
        { status: 400 }
      );
    }

    // Generate voucher number
    const voucherNo = await generateVoucherNumber(auth.companyId, validatedData.date);

    // Create voucher with lines and allocations in a transaction
    const voucher = await prisma.$transaction(async (tx) => {
      // Create payment voucher
      const newVoucher = await tx.voucher.create({
        data: {
          companyId: auth.companyId,
          voucherNo,
          type: 'PAYMENT',
          date: validatedData.date,
          status: 'DRAFT',
          narration: validatedData.narration || null,
          createdByUserId: auth.userId,
          lines: {
            create: [
              // Payment account (credit - money going out)
              {
                companyId: auth.companyId,
                accountId: validatedData.paymentAccountId,
                description: `Payment to ${vendor.name}`,
                debit: 0,
                credit: totalPayment,
                vendorId: null,
              },
              // Accounts Payable (debit - reducing liability)
              {
                companyId: auth.companyId,
                accountId: apAccount.id,
                description: `Payment to ${vendor.name}`,
                debit: totalPayment,
                credit: 0,
                vendorId: validatedData.vendorId,
              },
            ],
          },
        },
        include: {
          lines: true,
        },
      });

      // Create allocations
      await tx.vendorAllocation.createMany({
        data: validatedData.allocations.map((alloc) => ({
          paymentVoucherId: newVoucher.id,
          sourceLineId: alloc.sourceLineId,
          amount: alloc.amount,
        })),
      });

      // Fetch complete voucher with relations
      return await tx.voucher.findUnique({
        where: { id: newVoucher.id },
        include: {
          project: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          lines: {
            include: {
              account: {
                select: { id: true, code: true, name: true },
              },
            },
          },
          allocations: {
            include: {
              sourceLine: {
                include: {
                  voucher: {
                    select: { id: true, voucherNo: true },
                  },
                },
              },
            },
          },
        },
      });
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'VOUCHER',
      entityId: voucher!.id,
      action: 'CREATE',
      after: voucher,
      request,
    });

    return NextResponse.json(
      {
        ok: true,
        data: voucher,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.errors[0]?.message || 'Validation error',
        },
        { status: 400 }
      );
    }
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}
