import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { generatePdfFromUrl } from '@/lib/pdf/generate';
import { generatePdfToken } from '@/lib/pdf/token';
import { createErrorResponse, UnauthorizedError, ForbiddenError } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/pdf/voucher?id=...
 * Generate PDF for a voucher
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'READ');

    const { searchParams } = new URL(request.url);
    const voucherId = searchParams.get('id');

    if (!voucherId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Voucher ID is required',
        },
        { status: 400 }
      );
    }

    // Generate PDF access token
    const pdfToken = await generatePdfToken({
      userId: auth.userId,
      companyId: auth.companyId,
      entityType: 'voucher',
      entityId: voucherId,
    });

    // Get base URL from environment or request
    const baseUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host') || 'localhost:3000'}`;

    // Construct print URL with token
    const printUrl = `${baseUrl}/print/vouchers/${voucherId}?pdfToken=${encodeURIComponent(pdfToken)}`;

    console.log(`[PDF API] Generating voucher PDF for voucher ${voucherId}`);
    console.log(`[PDF API] Print URL: ${printUrl}`);

    // Generate PDF
    const pdfBuffer = await generatePdfFromUrl(printUrl);

    // Return PDF (convert Buffer to Uint8Array for web API compatibility)
    const bytes = new Uint8Array(pdfBuffer);
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="voucher-${voucherId}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('[PDF API] voucher error:', err?.stack || err);
    if (err instanceof UnauthorizedError) {
      return createErrorResponse(err, 401);
    }
    if (err instanceof ForbiddenError) {
      return createErrorResponse(err, 403);
    }
    return new Response(
      `PDF generation failed: ${err?.message || String(err)}`,
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    );
  }
}
