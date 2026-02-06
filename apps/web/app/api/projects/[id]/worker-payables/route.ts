import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { getProjectWorkerPayables } from '@/lib/projects/projectWorkerPayables.server';

/**
 * GET /api/projects/[id]/worker-payables
 * Returns worker payables summary and per-worker aging (DAY labor only).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(_request, 'projects', 'READ');

    const data = await getProjectWorkerPayables(params.id, auth.companyId);

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
