import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { ExpenseUpdateSchema } from '@accounting/shared';
import { ZodError } from 'zod';

/**
 * GET /api/expenses/[id]
 * Get a single expense by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'expenses', 'READ');

    const expense = await prisma.expense.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            parentProjectId: true,
          },
        },
        mainProject: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
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
        paymentMethod: {
          select: {
            id: true,
            name: true,
          },
        },
        debitAccount: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        creditAccount: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        paidByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        voucher: {
          select: {
            id: true,
            voucherNo: true,
            status: true,
          },
        },
      },
    });

    if (!expense) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Expense not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        ...expense,
        amount: Number(expense.amount),
        categoryNameSnapshot: expense.categoryNameSnapshot ?? expense.category?.name ?? null,
      },
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
 * PUT /api/expenses/[id]
 * Update an expense (requires WRITE permission)
 * Note: Since vouchers are POSTED, only non-accounting fields can be updated safely.
 * For amount/account changes, delete and recreate the expense.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'expenses', 'WRITE');

    // Verify expense exists and belongs to user's company
    const existingExpense = await prisma.expense.findFirst({
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
      },
    });

    if (!existingExpense) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Expense not found',
        },
        { status: 404 }
      );
    }

    // If voucher is POSTED, prevent editing of accounting fields
    if (existingExpense.voucher.status === 'POSTED') {
      const body = await request.json();
      const validatedData = ExpenseUpdateSchema.parse(body);

      // Check if trying to edit accounting-critical fields
      if (
        validatedData.amount !== undefined ||
        validatedData.debitAccountId !== undefined ||
        validatedData.creditAccountId !== undefined ||
        validatedData.paymentMethodId !== undefined
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Cannot edit amount, accounts, or payment method for posted expenses. Please delete and recreate.',
          },
          { status: 400 }
        );
      }
    }

    const body = await request.json();
    const validatedData = ExpenseUpdateSchema.parse(body);

    // Verify project if provided
    let mainProjectId = existingExpense.mainProjectId;
    if (validatedData.projectId && validatedData.projectId !== existingExpense.projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: validatedData.projectId,
          companyId: auth.companyId,
        },
        include: {
          parentProject: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!project) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Project not found',
          },
          { status: 400 }
        );
      }

      mainProjectId = project.parentProjectId || project.id;
    }

    // Verify category if provided; keep for snapshot when updating
    let categorySnapshot: string | null = null;
    if (validatedData.categoryId) {
      const category = await prisma.expenseCategory.findFirst({
        where: {
          id: validatedData.categoryId,
          companyId: auth.companyId,
        },
      });

      if (!category) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Expense category not found',
          },
          { status: 400 }
        );
      }
      categorySnapshot = category.name;
    }

    // When updating accounting fields (category/debit account), validate category/account match
    if (existingExpense.voucher.status !== 'POSTED') {
      const newCategoryId = validatedData.categoryId ?? existingExpense.categoryId;
      const newDebitAccountId = validatedData.debitAccountId ?? existingExpense.debitAccountId;
      if (newCategoryId && newDebitAccountId) {
        const debitAccount = await prisma.account.findFirst({
          where: { id: newDebitAccountId, companyId: auth.companyId },
          select: { expenseCategoryId: true },
        });
        if (debitAccount && debitAccount.expenseCategoryId !== newCategoryId) {
          return NextResponse.json(
            { ok: false, error: 'Expense account must belong to the selected expense category' },
            { status: 400 }
          );
        }
      }
    }

    // Verify vendor if provided
    if (validatedData.vendorId !== undefined) {
      if (validatedData.vendorId) {
        const vendor = await prisma.vendor.findFirst({
          where: {
            id: validatedData.vendorId,
            companyId: auth.companyId,
          },
        });

        if (!vendor) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Vendor not found',
            },
            { status: 400 }
          );
        }
      }
    }

    // Date is already transformed by Zod schema if provided
    const expenseDate = validatedData.date ?? existingExpense.date;

    const newCategoryId = validatedData.categoryId ?? existingExpense.categoryId;
    const updateData: Record<string, unknown> = {
      projectId: validatedData.projectId ?? existingExpense.projectId,
      mainProjectId,
      date: expenseDate,
      categoryId: newCategoryId,
      ...(categorySnapshot !== null && { categoryNameSnapshot: categorySnapshot }),
      source: validatedData.source ?? existingExpense.source,
      paidTo: validatedData.paidTo !== undefined ? validatedData.paidTo : existingExpense.paidTo,
      vendorId: validatedData.vendorId !== undefined ? validatedData.vendorId : existingExpense.vendorId,
      notes: validatedData.notes !== undefined ? validatedData.notes : existingExpense.notes,
    };
    if (existingExpense.voucher.status !== 'POSTED') {
      updateData.amount = validatedData.amount ?? Number(existingExpense.amount);
      updateData.paymentMethodId = validatedData.paymentMethodId ?? existingExpense.paymentMethodId;
      updateData.debitAccountId = validatedData.debitAccountId ?? existingExpense.debitAccountId;
      updateData.creditAccountId = validatedData.creditAccountId ?? existingExpense.creditAccountId;
    }

    // Update expense (only safe fields if voucher is POSTED)
    const expense = await prisma.expense.update({
      where: {
        id: params.id,
      },
      data: updateData as Parameters<typeof prisma.expense.update>[0]['data'],
      include: {
        project: {
          select: {
            id: true,
            name: true,
            parentProjectId: true,
          },
        },
        mainProject: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
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
        paymentMethod: {
          select: {
            id: true,
            name: true,
          },
        },
        debitAccount: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        creditAccount: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        paidByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        voucher: {
          select: {
            id: true,
            voucherNo: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        ...expense,
        amount: Number(expense.amount),
      },
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
 * DELETE /api/expenses/[id]
 * Delete an expense (requires WRITE permission)
 * Note: This will also delete the associated voucher and voucher lines
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'expenses', 'WRITE');

    // Verify expense exists and belongs to user's company
    const expense = await prisma.expense.findFirst({
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
      },
    });

    if (!expense) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Expense not found',
        },
        { status: 404 }
      );
    }

    // If voucher is POSTED, we need to reverse it first
    // For now, we'll prevent deletion of posted expenses
    // In production, you'd want to create a reversal voucher
    if (expense.voucher.status === 'POSTED') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Cannot delete posted expense. Please create a reversal voucher instead.',
        },
        { status: 400 }
      );
    }

    // Delete expense (voucher will be deleted via cascade if configured, or delete manually)
    await prisma.$transaction(async (tx) => {
      // Delete voucher lines first (if not cascading)
      await tx.voucherLine.deleteMany({
        where: {
          voucherId: expense.voucherId,
        },
      });

      // Delete voucher
      await tx.voucher.delete({
        where: {
          id: expense.voucherId,
        },
      });

      // Delete expense
      await tx.expense.delete({
        where: {
          id: params.id,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      data: { id: params.id },
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
