import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';

/**
 * GET /api/chart-of-accounts/[id]
 * Get system account by ID (internal use only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request);

    const account = await prisma.account.findUnique({
      where: { id: params.id },
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
        children: {
          select: { id: true, code: true, name: true },
        },
        _count: {
          select: { voucherLines: true },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Account not found',
        },
        { status: 404 }
      );
    }

    if (account.companyId !== auth.companyId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Account not found',
        },
        { status: 404 }
      );
    }

    // Only return system accounts
    if (!account.isSystem) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Account not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: account,
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
 * PATCH /api/chart-of-accounts/[id]
 * DISABLED: Accounts are system-managed only. System accounts cannot be modified.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    {
      ok: false,
      error: 'Account updates are disabled. Accounts are system-managed only.',
    },
    { status: 403 }
  );
  /* DISABLED - Accounts are system-managed
  try {
    const auth = await requirePermission(request, 'chartOfAccounts', 'WRITE');

    const account = await prisma.account.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            voucherLines: {
              where: {
                voucher: {
                  status: 'POSTED',
                },
              },
            },
          },
        },
      },
    });

    if (!account || account.companyId !== auth.companyId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Account not found',
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = AccountUpdateSchema.parse(body);

    // If code is being changed, check if account is used in posted vouchers
    if (validatedData.code && validatedData.code !== account.code) {
      if (account._count.voucherLines > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Cannot change account code because it is used in posted vouchers',
          },
          { status: 400 }
        );
      }
    }

    // Validate parent if provided
    if (validatedData.parentId !== undefined) {
      if (validatedData.parentId) {
        const parent = await prisma.account.findUnique({
          where: { id: validatedData.parentId },
        });

        if (!parent || parent.companyId !== auth.companyId) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Parent account not found or does not belong to your company',
            },
            { status: 400 }
          );
        }

        // Prevent circular reference
        if (validatedData.parentId === params.id) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Account cannot be its own parent',
            },
            { status: 400 }
          );
        }
      }
    }

    // Check code uniqueness if code is being changed
    if (validatedData.code && validatedData.code !== account.code) {
      const existing = await prisma.account.findUnique({
        where: {
          companyId_code: {
            companyId: auth.companyId,
            code: validatedData.code,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Account code already exists for this company',
          },
          { status: 400 }
        );
      }
    }

    const before = { ...account };
    delete (before as any)._count;

    const updated = await prisma.account.update({
      where: { id: params.id },
      data: {
        ...(validatedData.code && { code: validatedData.code }),
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.type && { type: validatedData.type }),
        ...(validatedData.parentId !== undefined && { parentId: validatedData.parentId || null }),
        ...(validatedData.isActive !== undefined && { isActive: validatedData.isActive }),
      },
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
        children: {
          select: { id: true },
        },
      },
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'ACCOUNT',
      entityId: updated.id,
      action: 'UPDATE',
      before,
      after: updated,
      request,
    });

    return NextResponse.json({
      ok: true,
      data: updated,
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
  */
}

/**
 * DELETE /api/chart-of-accounts/[id]
 * DISABLED: Accounts are system-managed only. System accounts cannot be deleted.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    {
      ok: false,
      error: 'Account deletion is disabled. Accounts are system-managed only.',
    },
    { status: 403 }
  );
  /* DISABLED CODE - kept for reference
  try {
    const auth = await requirePermission(request, 'chartOfAccounts', 'WRITE');

    const account = await prisma.account.findUnique({
      where: { id: params.id },
      include: {
        children: true,
        _count: {
          select: {
            voucherLines: {
              where: {
                voucher: {
                  status: 'POSTED',
                },
              },
            },
          },
        },
      },
    });

    if (!account || account.companyId !== auth.companyId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Account not found',
        },
        { status: 404 }
      );
    }

    // Cannot delete if has children
    if (account.children.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Cannot delete account with child accounts',
        },
        { status: 400 }
      );
    }

    // Cannot delete if used in posted vouchers
    if (account._count.voucherLines > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Cannot delete account because it is used in posted vouchers',
        },
        { status: 400 }
      );
    }

    const before = { ...account };
    delete (before as any)._count;
    delete (before as any).children;

    // Soft delete by setting isActive=false
    const updated = await prisma.account.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    // Create audit log
    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'ACCOUNT',
      entityId: updated.id,
      action: 'DELETE',
      before,
      after: updated,
      request,
    });

    return NextResponse.json({
      ok: true,
      data: updated,
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
  */
}
