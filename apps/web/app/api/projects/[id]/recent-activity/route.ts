import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { getProjectRecentActivity } from '@/lib/projects/projectRecentActivity.server';

/**
 * GET /api/projects/[id]/recent-activity
 * Returns last 15 combined activities (purchases, stock, labor, debit, credit).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'READ');

    const activity = await getProjectRecentActivity(params.id, auth.companyId);

    return NextResponse.json({
      ok: true,
      data: activity,
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
