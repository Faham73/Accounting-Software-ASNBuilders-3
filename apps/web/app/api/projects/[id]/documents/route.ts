import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * GET /api/projects/[id]/documents
 * List project documents.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'READ');

    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId: auth.companyId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
    }

    const documents = await prisma.projectDocument.findMany({
      where: { projectId: params.id, companyId: auth.companyId },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        title: true,
        fileUrl: true,
        uploadedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: documents.map((d) => ({
        id: d.id,
        title: d.title,
        fileUrl: d.fileUrl,
        uploadedAt: d.uploadedAt.toISOString(),
      })),
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

/** Allowed MIME types for project documents (same storage as voucher/fileRef usage) */
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/projects/[id]/documents
 * Upload a file and create a project document. FormData: file (required), title (optional, defaults to filename).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'WRITE');

    const project = await prisma.project.findFirst({
      where: { id: params.id, companyId: auth.companyId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ ok: false, error: 'Project not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const titleInput = formData.get('title') as string | null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { ok: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const typeAllowed =
      file.type.startsWith('image/') || ALLOWED_TYPES.includes(file.type);
    if (!typeAllowed) {
      return NextResponse.json(
        { ok: false, error: 'File type not allowed. Use PDF, images, or Word documents.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // File uploads to local filesystem are not supported in production (Vercel serverless)
    // TODO: Implement cloud storage (S3, Vercel Blob, etc.) for production
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      return NextResponse.json(
        {
          ok: false,
          error: 'File uploads are not available in production. Please configure cloud storage.',
        },
        { status: 503 }
      );
    }

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${timestamp}-${randomStr}.${ext}`;

    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const filePath = join(uploadsDir, fileName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const fileUrl = `/uploads/${fileName}`;
    const title = (titleInput && titleInput.trim()) || file.name;

    const doc = await prisma.projectDocument.create({
      data: {
        companyId: auth.companyId,
        projectId: params.id,
        title,
        fileUrl,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: doc.id,
        title: doc.title,
        fileUrl: doc.fileUrl,
        uploadedAt: doc.uploadedAt.toISOString(),
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
