import { NextRequest } from 'next/server';
import { prisma } from '@accounting/db';

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_ATTEMPTS = 10;

export type RateLimitEndpoint = 'login' | 'create-user' | 'reset-password';

/** True if DB rate limiting is available (RateLimitAttempt model in Prisma client). */
function hasRateLimitModel(): boolean {
  return typeof (prisma as { rateLimitAttempt?: unknown }).rateLimitAttempt !== 'undefined';
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

/**
 * Check if identifier (IP or email) is rate limited for the given endpoint.
 * Uses sliding window: count attempts in last WINDOW_MS, if >= MAX_ATTEMPTS return true.
 * If RateLimitAttempt model is not available (e.g. client not regenerated), returns false (not limited).
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: RateLimitEndpoint
): Promise<boolean> {
  if (!hasRateLimitModel()) return false;
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const count = await prisma.rateLimitAttempt.count({
    where: {
      identifier,
      endpoint,
      attemptAt: { gte: windowStart },
    },
  });
  return count >= RATE_LIMIT_MAX_ATTEMPTS;
}

/**
 * Record a rate limit attempt (call before checking rate limit).
 * No-op if RateLimitAttempt model is not available (e.g. Prisma client not regenerated).
 */
export async function recordRateLimitAttempt(
  identifier: string,
  endpoint: RateLimitEndpoint
): Promise<void> {
  if (!hasRateLimitModel()) return;
  await prisma.rateLimitAttempt.create({
    data: {
      identifier,
      endpoint,
    },
  });
  // Cleanup old attempts (older than 1 hour) to prevent DB bloat
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.rateLimitAttempt.deleteMany({
    where: {
      attemptAt: { lt: oneHourAgo },
    },
  });
}
