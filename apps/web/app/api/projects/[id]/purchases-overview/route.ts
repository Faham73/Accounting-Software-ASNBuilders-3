import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { getProjectPurchasesOverview } from '@/lib/projects/projectPurchasesOverview.server';

/**
 * GET /api/projects/[id]/purchases-overview
 * Returns pending bills, advance paid, and last 5 purchases for the project.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(_request, 'projects', 'READ');

    const overview = await getProjectPurchasesOverview(params.id, auth.companyId);

    return NextResponse.json({
      ok: true,
      data: overview,
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
