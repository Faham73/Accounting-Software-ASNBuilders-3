import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { getVendorOpenItems } from '@/lib/payables';

/**
 * GET /api/vendors/[id]/open-items
 * Get open items (outstanding payables) for a vendor
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'READ');

    const openItems = await getVendorOpenItems(params.id, auth.companyId);

    return NextResponse.json({
      ok: true,
      data: openItems,
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
