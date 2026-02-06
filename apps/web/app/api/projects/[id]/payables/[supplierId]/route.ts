import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { getProjectSupplierLedger } from '@/lib/projects/projectSupplierPayables.server';

/**
 * GET /api/projects/[id]/payables/[supplierId]
 * Returns ledger for a single supplier in the project (invoices list + summary).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; supplierId: string } }
) {
  try {
    const auth = await requirePermission(_request, 'projects', 'READ');

    const data = await getProjectSupplierLedger(
      params.id,
      params.supplierId,
      auth.companyId
    );

    if (!data) {
      return NextResponse.json(
        { ok: false, error: 'Supplier not found or has no purchases in this project' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(
      error instanceof Error ? error : new Error('Unknown error'),
      500
    );
  }
}
