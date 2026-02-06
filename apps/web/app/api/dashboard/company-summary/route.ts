import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { getCompanySummary } from '@/lib/dashboard/companySummary.server';

/**
 * GET /api/dashboard/company-summary
 * Returns company-wide totals, KPIs, health metrics, and project overview.
 * Query: dateFrom (YYYY-MM-DD), dateTo (YYYY-MM-DD) — optional; default last 30 days when omitted.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'projects', 'READ');

    const { searchParams } = new URL(request.url);
    const dateFromStr = searchParams.get('dateFrom');
    const dateToStr = searchParams.get('dateTo');

    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;

    if (dateFromStr && dateToStr) {
      const df = new Date(dateFromStr);
      const dt = new Date(dateToStr);
      if (!Number.isNaN(df.getTime()) && !Number.isNaN(dt.getTime())) {
        dateFrom = df;
        dateTo = dt;
      }
    }
    // Default: last 30 days
    if (!dateFrom || !dateTo) {
      const now = new Date();
      dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const d = new Date(dateTo);
      d.setDate(d.getDate() - 30);
      dateFrom = d;
    }

    const summary = await getCompanySummary(auth.companyId, {
      dateFrom,
      dateTo,
    });

    return NextResponse.json({
      ok: true,
      data: summary,
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
