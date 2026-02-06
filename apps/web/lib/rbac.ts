import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthUser, AuthUserWithDetails, verifyToken } from '@/lib/auth';
import { prisma } from '@accounting/db';
import { can, Resource, Action, UserRole } from '@/lib/permissions';

/**
 * Authentication result from requireAuth
 */
export interface AuthResult {
  userId: string;
  companyId: string;
  role: UserRole;
  user: AuthUserWithDetails;
}

/**
 * Error class for authorization failures
 */
export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Require authentication and return user info
 * Throws UnauthorizedError if user is not authenticated
 * 
 * For use in API route handlers
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const user = await getAuthUser(request);

  if (!user) {
    throw new UnauthorizedError('Authentication required');
  }

  return {
    userId: user.id,
    companyId: user.companyId,
    role: user.role as UserRole,
    user,
  };
}

/**
 * Require authentication and return user info
 * Throws UnauthorizedError if user is not authenticated
 * 
 * For use in server components (reads cookies from Next.js cookies() API)
 */
export async function requireAuthServer(): Promise<AuthResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    throw new UnauthorizedError('Authentication required');
  }

  try {
    // Verify JWT token
    const authPayload = await verifyToken(token);

    // Load user from database
    const user = await prisma.user.findUnique({
      where: {
        id: authPayload.userId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found or inactive');
    }

    const userWithDetails: AuthUserWithDetails = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    };

    return {
      userId: user.id,
      companyId: user.companyId,
      role: user.role as UserRole,
      user: userWithDetails,
    };
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/**
 * Check if user can perform an action on a resource
 * Throws ForbiddenError if permission is denied
 * 
 * For use in API route handlers
 */
export async function requirePermission(
  request: NextRequest,
  resource: Resource,
  action: Action
): Promise<AuthResult> {
  const authResult = await requireAuth(request);

  if (!can(authResult.role, resource, action)) {
    throw new ForbiddenError(`You do not have permission to ${action} ${resource}`);
  }

  return authResult;
}

/**
 * Check if user can perform an action on a resource
 * Throws ForbiddenError if permission is denied
 * 
 * For use in server components
 */
export async function requirePermissionServer(
  resource: Resource,
  action: Action
): Promise<AuthResult> {
  const authResult = await requireAuthServer();

  if (!can(authResult.role, resource, action)) {
    throw new ForbiddenError(`You do not have permission to ${action} ${resource}`);
  }

  return authResult;
}

/**
 * Require admin role
 * Throws ForbiddenError if user is not admin
 * 
 * For use in API route handlers
 */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(request);

  if (authResult.role !== 'ADMIN') {
    throw new ForbiddenError('Admin access required');
  }

  return authResult;
}

/**
 * Require admin role
 * Throws ForbiddenError if user is not admin
 * 
 * For use in server components
 */
export async function requireAdminServer(): Promise<AuthResult> {
  const authResult = await requireAuthServer();

  if (authResult.role !== 'ADMIN') {
    throw new ForbiddenError('Admin access required');
  }

  return authResult;
}

/**
 * Helper to create error response for API routes
 */
export function createErrorResponse(error: Error, statusCode: number = 500) {
  return NextResponse.json(
    {
      ok: false,
      error: error.message,
    },
    { status: statusCode }
  );
}
