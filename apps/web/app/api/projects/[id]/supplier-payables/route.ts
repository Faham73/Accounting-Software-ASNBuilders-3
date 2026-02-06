import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { getProjectSupplierPayables } from '@/lib/projects/projectSupplierPayables.server';

/**
 * GET /api/projects/[id]/supplier-payables
 * Returns supplier payables summary and per-supplier aging for the project.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(_request, 'projects', 'READ');

    const data = await getProjectSupplierPayables(params.id, auth.companyId);

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
