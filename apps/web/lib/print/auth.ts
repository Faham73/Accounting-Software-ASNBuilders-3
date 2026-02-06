import { verifyPdfToken } from '@/lib/pdf/token';
import { requirePermissionServer } from '@/lib/rbac';
import { prisma } from '@accounting/db';

/**
 * Authenticate print route request
 * Accepts either:
 * 1. PDF token (for server-side PDF generation)
 * 2. Normal session cookie (for browser access)
 */
export async function authenticatePrintRoute(
  searchParams: { pdfToken?: string },
  requiredPermission: { resource: 'vouchers' | 'projects'; action: 'READ' }
): Promise<{ userId: string; companyId: string }> {
  // Try PDF token first (for server-side PDF generation)
  if (searchParams.pdfToken) {
    try {
      const tokenPayload = await verifyPdfToken(searchParams.pdfToken);
      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: tokenPayload.userId, isActive: true },
        select: { id: true, companyId: true },
      });
      if (user && user.companyId === tokenPayload.companyId) {
        return {
          userId: tokenPayload.userId,
          companyId: tokenPayload.companyId,
        };
      }
    } catch (error) {
      // Token invalid or expired, fall through to normal auth
    }
  }

  // Fall back to normal authentication (for browser access)
  const auth = await requirePermissionServer(requiredPermission.resource, requiredPermission.action);
  return {
    userId: auth.userId,
    companyId: auth.companyId,
  };
}

/**
 * Authenticate print route and verify entity access
 */
export async function authenticateAndVerifyEntity(
  searchParams: { pdfToken?: string },
  requiredPermission: { resource: 'vouchers' | 'projects'; action: 'READ' },
  entityType: 'voucher' | 'project' | 'vendor',
  entityId: string
): Promise<{ userId: string; companyId: string }> {
  const auth = await authenticatePrintRoute(searchParams, requiredPermission);

  // Verify entity belongs to user's company
  if (entityType === 'voucher') {
    const voucher = await prisma.voucher.findUnique({
      where: { id: entityId },
      select: { companyId: true },
    });
    if (!voucher || voucher.companyId !== auth.companyId) {
      throw new Error('Voucher not found or access denied');
    }
  } else if (entityType === 'project') {
    const project = await prisma.project.findUnique({
      where: { id: entityId },
      select: { companyId: true },
    });
    if (!project || project.companyId !== auth.companyId) {
      throw new Error('Project not found or access denied');
    }
  } else if (entityType === 'vendor') {
    const vendor = await prisma.vendor.findUnique({
      where: { id: entityId },
      select: { companyId: true },
    });
    if (!vendor || vendor.companyId !== auth.companyId) {
      throw new Error('Vendor not found or access denied');
    }
  }

  return auth;
}
