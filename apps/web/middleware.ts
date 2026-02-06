import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'
);

/**
 * Verify JWT token without database lookup (for middleware)
 */
async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never touch Next.js internals or static assets (avoids 404s for main-app.js, layout.css, etc.)
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico' || pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return NextResponse.next();
  }

  // Allow /login, /setup (one-time bootstrap), /set-password (invite token), /forgot-password, and all API routes without auth
  if (pathname === '/login' || pathname === '/setup' || pathname === '/set-password' || pathname === '/forgot-password' || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Protect /dashboard and /dashboard/* routes
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('token')?.value;

    // If no token or token is invalid, redirect to login
    if (!token || !(await verifyToken(token))) {
      const loginUrl = new URL('/login', request.url);
      // Preserve the intended destination for redirect after login
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next();
  // Pass pathname to server layout for active nav styling
  response.headers.set('x-pathname', pathname);
  return response;
}

export const config = {
  matcher: [
    /*
     * Exclude all /_next/* (assets: main-app.js, layout.css, page.js, etc.) and
     * static files. Prevents middleware from touching asset requests that could
     * cause 404s if incorrectly handled.
     */
    '/((?!_next|favicon\\.ico|robots\\.txt|sitemap\\.xml|uploads/).*)',
  ],
};
