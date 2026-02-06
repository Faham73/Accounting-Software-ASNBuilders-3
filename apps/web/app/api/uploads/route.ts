import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuth,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { can } from '@/lib/permissions';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * POST /api/uploads
 * Upload an image file (for purchases, etc.)
 * Requires WRITE permission on purchases
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    // Check if user can write to purchases
    if (!can(auth.role, 'purchases', 'WRITE')) {
      throw new ForbiddenError('You do not have permission to upload files');
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No file provided',
        },
        { status: 400 }
      );
    }

    // Validate file type (images only)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Only image files are allowed',
        },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          ok: false,
          error: 'File size must be less than 5MB',
        },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `${timestamp}-${randomStr}.${extension}`;

    // Ensure uploads directory exists
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save file
    const filePath = join(uploadsDir, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Return public URL
    const fileUrl = `/uploads/${fileName}`;

    return NextResponse.json({
      ok: true,
      data: {
        url: fileUrl,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      },
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
