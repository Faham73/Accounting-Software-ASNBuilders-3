import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { getProjectFinancialSnapshot } from '@/lib/projects/projectFinancialSnapshot.server';

/**
 * GET /api/projects/[id]/financial-snapshot
 * Returns budget KPI and expense breakdown for the project.
 * Query: dateFrom (ISO date), dateTo (ISO date) — optional; when omitted, all-time.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'READ');

    const { searchParams } = new URL(request.url);
    const dateFromStr = searchParams.get('dateFrom');
    const dateToStr = searchParams.get('dateTo');

    const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined;
    const dateTo = dateToStr ? new Date(dateToStr) : undefined;

    const snapshot = await getProjectFinancialSnapshot(params.id, auth.companyId, {
      dateFrom: dateFrom && !Number.isNaN(dateFrom.getTime()) ? dateFrom : undefined,
      dateTo: dateTo && !Number.isNaN(dateTo.getTime()) ? dateTo : undefined,
    });

    return NextResponse.json({
      ok: true,
      data: snapshot,
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
