import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { PurchaseUpdateSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { Prisma } from '@prisma/client';
import { resolvePaymentAccountId } from '@/lib/purchases/purchasePaymentDefaults.server';

/**
 * GET /api/purchases/[id]
 * Get a single purchase by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'purchases', 'READ');

    const purchase = await prisma.purchase.findUnique({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        subProject: {
          select: { id: true, name: true },
        },
        supplierVendor: {
          select: { id: true, name: true, phone: true, address: true },
        },
        paymentAccount: {
          select: { id: true, code: true, name: true, type: true },
        },
        lines: {
          include: {
            stockItem: {
              select: { id: true, name: true, unit: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Purchase not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: purchase,
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

/**
 * PUT /api/purchases/[id]
 * Update a purchase
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'purchases', 'WRITE');

    // Check if purchase exists and belongs to company
    const existingPurchase = await prisma.purchase.findUnique({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
      include: {
        voucher: {
          select: {
            id: true,
            status: true,
          },
        },
        paymentAccount: {
          select: { code: true },
        },
      },
    });

    if (!existingPurchase) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Purchase not found',
        },
        { status: 404 }
      );
    }

    // Only allow editing DRAFT purchases
    if (existingPurchase.status !== 'DRAFT') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Only DRAFT purchases can be edited',
        },
        { status: 400 }
      );
    }

    // Prevent editing if voucher exists and is not DRAFT
    if (existingPurchase.voucherId && existingPurchase.voucher && existingPurchase.voucher.status !== 'DRAFT') {
      return NextResponse.json(
        {
          ok: false,
          error: `Purchase cannot be edited when linked voucher is ${existingPurchase.voucher.status}`,
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = PurchaseUpdateSchema.parse(body);

    // Validate project if provided
    if (validatedData.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: validatedData.projectId },
      });

      if (!project || project.companyId !== auth.companyId) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Project not found or does not belong to your company',
          },
          { status: 400 }
        );
      }
    }

    // Validate sub-project if provided
    if (validatedData.subProjectId && validatedData.projectId) {
      const subProject = await prisma.project.findUnique({
        where: { id: validatedData.subProjectId },
      });

      if (!subProject || subProject.companyId !== auth.companyId || subProject.parentProjectId !== validatedData.projectId) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Sub-project not found, does not belong to your company, or is not a child of the main project',
          },
          { status: 400 }
        );
      }
    }

    // Validate supplier vendor if provided
    if (validatedData.supplierVendorId) {
      const supplier = await prisma.vendor.findUnique({
        where: { id: validatedData.supplierVendorId },
      });

      if (!supplier || supplier.companyId !== auth.companyId) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Supplier not found or does not belong to your company',
          },
          { status: 400 }
        );
      }
    }

    // Resolve paymentAccountId and paymentMethod for update (when paidAmount is provided)
    let paymentAccountId: string | null | undefined;
    let paymentMethod: 'CASH' | 'BANK' | null | undefined;
    const paidAmountForPayment =
      validatedData.paidAmount !== undefined
        ? validatedData.paidAmount
        : Number(existingPurchase.paidAmount);
    if (validatedData.paidAmount !== undefined || validatedData.paymentMethod !== undefined) {
      if (paidAmountForPayment > 0) {
        const derivedMethod =
          existingPurchase.paymentAccount?.code === '1020' ? 'BANK' : existingPurchase.paymentAccount?.code === '1010' ? 'CASH' : null;
        const method = validatedData.paymentMethod ?? (existingPurchase.paymentMethod as 'CASH' | 'BANK' | null) ?? derivedMethod;
        if (!method) {
          return NextResponse.json(
            { ok: false, error: 'Payment method (Cash or Bank) is required when paid amount > 0' },
            { status: 400 }
          );
        }
        const resolved = await resolvePaymentAccountId(auth.companyId, method);
        if ('error' in resolved) {
          return NextResponse.json({ ok: false, error: resolved.error }, { status: 400 });
        }
        paymentAccountId = resolved.paymentAccountId;
        paymentMethod = method;
      } else {
        paymentAccountId = null;
        paymentMethod = null;
      }
    }

    // Validate stock items and expense heads if lines are provided
    // New form uses materialName instead of stockItemId, so stockItemId is optional
    if (validatedData.lines) {
      const materialLines = validatedData.lines.filter((line) => line.lineType === 'MATERIAL');
      if (materialLines.length > 0) {
        const stockItemIds = materialLines
          .map((line) => line.stockItemId)
          .filter((id): id is string => Boolean(id));
        
        // Only validate stock items if any lines have stockItemId (backwards compatibility)
        if (stockItemIds.length > 0) {
          const stockItems = await prisma.stockItem.findMany({
            where: {
              id: { in: stockItemIds },
              companyId: auth.companyId,
              isActive: true,
            },
          });

          if (stockItems.length !== stockItemIds.length) {
            return NextResponse.json(
              {
                ok: false,
                error: 'One or more stock items not found, inactive, or do not belong to your company',
              },
              { status: 400 }
            );
          }
        }
      }

    }

    // Compute totals server-side if lines are provided
    let subtotal: Prisma.Decimal | undefined;
    let total: Prisma.Decimal | undefined;
    let dueAmount: Prisma.Decimal | undefined;

    if (validatedData.lines) {
      subtotal = new Prisma.Decimal(validatedData.lines.reduce((sum, line) => sum + line.lineTotal, 0));
      const discount = validatedData.discountPercent
        ? subtotal.mul(validatedData.discountPercent).div(100)
        : new Prisma.Decimal(0);
      total = subtotal.minus(discount);
      const paidAmount = validatedData.paidAmount !== undefined
        ? new Prisma.Decimal(validatedData.paidAmount)
        : existingPurchase.paidAmount;
      dueAmount = total.minus(paidAmount);
    }

    // Update purchase in a transaction
    const purchase = await prisma.$transaction(async (tx) => {
      // Delete existing lines if new lines are provided
      if (validatedData.lines) {
        await tx.purchaseLine.deleteMany({
          where: { purchaseId: params.id },
        });
      }

      // Delete existing attachments if new attachments are provided
      if (validatedData.attachments !== undefined) {
        await tx.purchaseAttachment.deleteMany({
          where: { purchaseId: params.id },
        });
      }

      const updateData = {
          ...(validatedData.date && { date: validatedData.date }),
          ...(validatedData.challanNo !== undefined && { challanNo: validatedData.challanNo }),
          ...(validatedData.projectId !== undefined
          ? { project: { connect: { id: validatedData.projectId } } }
          : {}),
          ...(validatedData.subProjectId !== undefined
          ? validatedData.subProjectId
            ? { subProject: { connect: { id: validatedData.subProjectId } } }
            : { subProject: { disconnect: true } }
          : {}),
          ...(validatedData.supplierVendorId !== undefined
          ? { supplierVendor: { connect: { id: validatedData.supplierVendorId } } }
          : {}),
          ...(validatedData.reference !== undefined && { reference: validatedData.reference }),
          ...(validatedData.discountPercent !== undefined && {
            discountPercent: validatedData.discountPercent ? new Prisma.Decimal(validatedData.discountPercent) : null,
          }),
          ...(subtotal !== undefined && { subtotal }),
          ...(total !== undefined && { total }),
          ...(validatedData.paidAmount !== undefined && { paidAmount: new Prisma.Decimal(validatedData.paidAmount) }),
          ...(dueAmount !== undefined && { dueAmount }),
          ...(paymentAccountId !== undefined
          ? paymentAccountId
            ? { paymentAccount: { connect: { id: paymentAccountId } } }
            : { paymentAccount: { disconnect: true } }
          : {}),
          ...(paymentMethod !== undefined && { paymentMethod }),
          ...(validatedData.lines && {
            lines: {
              create: validatedData.lines.map((line) => {
                // Compute lineTotal from qty * unitRate if not provided
                let lineTotal = line.lineTotal;
                if ((line.lineType === 'MATERIAL' || line.lineType === 'SERVICE') && line.quantity && line.unitRate) {
                  lineTotal = line.quantity * line.unitRate;
                }

                // Default lineType to MATERIAL if not provided
                const lineType = line.lineType || 'MATERIAL';

                const lineData: Record<string, unknown> = {
                  lineType,
                  quantity: line.quantity ? new Prisma.Decimal(line.quantity) : null,
                  unit: line.unit || null,
                  unitRate: line.unitRate ? new Prisma.Decimal(line.unitRate) : null,
                  description: line.description || null,
                  materialName: line.materialName || null,
                  lineTotal: new Prisma.Decimal(lineTotal),
                };
                // Use relation API for optional stockItem (Prisma nested create)
                if (line.stockItemId) {
                  lineData.stockItem = { connect: { id: line.stockItemId } };
                }
                return lineData;
              }),
            },
          }),
          ...(validatedData.attachments !== undefined && {
            attachments: {
              create: validatedData.attachments.map((att) => ({
                fileName: att.fileName,
                fileUrl: att.fileUrl,
                mimeType: att.mimeType,
                sizeBytes: att.sizeBytes,
              })),
            },
          }),
        } as Prisma.PurchaseUpdateInput;

      const updatedPurchase = await tx.purchase.update({
        where: { id: params.id },
        data: updateData,
        include: {
          project: {
            select: { id: true, name: true },
          },
          subProject: {
            select: { id: true, name: true },
          },
          supplierVendor: {
            select: { id: true, name: true },
          },
          lines: {
            include: {
              stockItem: {
                select: { id: true, name: true, unit: true },
              },
            },
          },
          attachments: true,
        },
      });

      return updatedPurchase;
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'Purchase',
      entityId: purchase.id,
      action: 'UPDATE',
      before: existingPurchase,
      after: purchase,
      request,
    });

    return NextResponse.json({
      ok: true,
      data: purchase,
    });
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

/**
 * DELETE /api/purchases/[id]
 * Delete a purchase
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'purchases', 'WRITE');

    // Check if purchase exists and belongs to company
    const existingPurchase = await prisma.purchase.findUnique({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!existingPurchase) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Purchase not found',
        },
        { status: 404 }
      );
    }

    // Only allow deleting DRAFT purchases
    if (existingPurchase.status !== 'DRAFT') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Only DRAFT purchases can be deleted',
        },
        { status: 400 }
      );
    }

    // Delete purchase (cascade will delete lines and attachments)
    await prisma.purchase.delete({
      where: { id: params.id },
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'Purchase',
      entityId: params.id,
      action: 'DELETE',
      before: existingPurchase,
      request,
    });

    return NextResponse.json({
      ok: true,
      message: 'Purchase deleted successfully',
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
