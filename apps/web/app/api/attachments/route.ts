import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { AttachmentCreateSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { can } from '@/lib/permissions';

/**
 * Helper to check if user can write to any master-data module
 * (ADMIN or ACCOUNTANT can write to projects/vendors/paymentMethods)
 */
function canWriteMasterData(role: string): boolean {
  return (
    can(role as any, 'projects', 'WRITE') ||
    can(role as any, 'vendors', 'WRITE') ||
    can(role as any, 'paymentMethods', 'WRITE')
  );
}

/**
 * GET /api/attachments
 * List attachments for user's company
 * Query params: limit, q (search by fileName)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit');
    const q = searchParams.get('q') || '';

    // Build where clause
    const where: any = {
      companyId: auth.companyId,
    };

    // Search by file name (case-insensitive)
    if (q) {
      where.fileName = {
        contains: q,
        mode: 'insensitive',
      };
    }

    const attachments = await prisma.attachment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : undefined,
      select: {
        id: true,
        url: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      data: attachments,
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

/**
 * POST /api/attachments
 * Create attachment metadata (requires WRITE permission on any master-data module)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    // Check if user can write to any master-data module
    if (!canWriteMasterData(auth.role)) {
      throw new ForbiddenError('You do not have permission to upload attachments');
    }

    const body = await request.json();

    // Validate input with Zod
    const validatedData = AttachmentCreateSchema.parse(body);

    // Create attachment (companyId and uploadedByUserId from auth context)
    const attachment = await prisma.attachment.create({
      data: {
        companyId: auth.companyId,
        uploadedByUserId: auth.userId,
        url: validatedData.url,
        fileName: validatedData.fileName,
        mimeType: validatedData.mimeType,
        sizeBytes: validatedData.sizeBytes,
      },
      select: {
        id: true,
        url: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        data: attachment,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.errors[0]?.message || 'Validation error',
        },
        { status: 400 }
      );
    }
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}
