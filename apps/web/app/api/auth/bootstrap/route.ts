import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma, UserRole } from '@accounting/db';

const bootstrapSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * GET: Check if bootstrap is allowed (no companies exist yet).
 * Used by /setup page to show form or redirect to login.
 */
export async function GET() {
  const count = await prisma.company.count();
  return NextResponse.json({
    ok: true,
    data: { allowed: count === 0 },
  });
}

/**
 * POST: One-time bootstrap — create first Company and first ADMIN user.
 * Only succeeds when no companies exist.
 */
export async function POST(request: NextRequest) {
  try {
    const count = await prisma.company.count();
    if (count > 0) {
      return NextResponse.json(
        { ok: false, error: 'Bootstrap already completed' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = bootstrapSchema.parse(body);

    const passwordHash = await bcrypt.hash(validated.password, 10);

    const [company, user] = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: validated.companyName,
          isActive: true,
        },
      });

      const user = await tx.user.create({
        data: {
          email: validated.email,
          name: validated.name,
          passwordHash,
          role: UserRole.ADMIN,
          companyId: company.id,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: company.id,
          entityType: 'User',
          entityId: user.id,
          action: 'BOOTSTRAP_CREATE',
          actorUserId: user.id,
          after: { email: user.email, role: user.role },
          metaJson: { source: 'bootstrap' },
        },
      });

      return [company, user] as const;
    });

    return NextResponse.json({
      ok: true,
      data: {
        companyId: company.id,
        userId: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Bootstrap error:', error);
    return NextResponse.json(
      { ok: false, error: 'Bootstrap failed' },
      { status: 500 }
    );
  }
}
