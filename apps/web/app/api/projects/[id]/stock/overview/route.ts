import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { getProjectStockOverview } from '@/lib/stock/projectStock.server';

/**
 * GET /api/projects/[id]/stock/overview
 * Get project stock overview with summary and material-wise breakdown
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'stock', 'READ');

    const overview = await getProjectStockOverview(auth.companyId, params.id);

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
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to get stock overview',
      },
      { status: 500 }
    );
  }
}
