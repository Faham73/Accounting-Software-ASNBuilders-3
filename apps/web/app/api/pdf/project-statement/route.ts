import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { generatePdfFromUrl } from '@/lib/pdf/generate';
import { generatePdfToken } from '@/lib/pdf/token';
import { createErrorResponse, UnauthorizedError, ForbiddenError } from '@/lib/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/pdf/project-statement?id=...&from=...&to=...
 * Generate PDF for a project statement
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'projects', 'READ');

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!projectId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Project ID is required',
        },
        { status: 400 }
      );
    }

    // Generate PDF access token
    const pdfToken = await generatePdfToken({
      userId: auth.userId,
      companyId: auth.companyId,
      entityType: 'project',
      entityId: projectId,
    });

    // Get base URL from environment or request
    const baseUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host') || 'localhost:3000'}`;

    // Construct print URL with query params and token
    const printUrl = new URL(`${baseUrl}/print/projects/${projectId}/statement`);
    if (from) printUrl.searchParams.set('from', from);
    if (to) printUrl.searchParams.set('to', to);
    printUrl.searchParams.set('pdfToken', pdfToken);

    console.log(`[PDF API] Generating project statement PDF for project ${projectId}`);
    console.log(`[PDF API] Print URL: ${printUrl.toString()}`);

    // Generate PDF
    const pdfBuffer = await generatePdfFromUrl(printUrl.toString());

    // Return PDF (convert Buffer to Uint8Array for web API compatibility)
    const bytes = new Uint8Array(pdfBuffer);
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="project-statement-${projectId}-${from || 'all'}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('[PDF API] project-statement error:', err?.stack || err);
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
