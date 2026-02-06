import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { getProjectWorkerLedger } from '@/lib/projects/projectWorkerPayables.server';

/**
 * GET /api/projects/[id]/worker-payables/[workerKey]
 * Returns ledger for a single worker (workerKey is encoded e.g. "DAY%7CJohn").
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; workerKey: string } }
) {
  try {
    const auth = await requirePermission(_request, 'projects', 'READ');

    const data = await getProjectWorkerLedger(
      params.id,
      params.workerKey,
      auth.companyId
    );

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Worker not found or has no labor entries in this project',
        },
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
