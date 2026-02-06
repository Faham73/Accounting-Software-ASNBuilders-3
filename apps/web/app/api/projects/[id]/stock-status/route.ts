import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { getProjectStockStatus } from '@/lib/projects/projectStockStatus.server';

/**
 * GET /api/projects/[id]/stock-status
 * Returns stock metrics for dashboard: receivedTotal, usedTotal, currentBalance, lowStockItems (top 5).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'READ');

    const status = await getProjectStockStatus(auth.companyId, params.id);

    return NextResponse.json({
      ok: true,
      data: status,
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
