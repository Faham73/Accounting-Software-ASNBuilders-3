import { NextRequest } from 'next/server';

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const LOCKOUT_AFTER_FAILURES = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// In-memory stores (per-instance). For multi-instance deploy consider Redis/Upstash.
const ipAttempts = new Map<string, { count: number; resetAt: number }>();
const emailFailures = new Map<string, { failedCount: number; lockedUntil: number }>();

function now() {
  return Date.now();
}

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

/**
 * Returns true if the request should be rate limited (too many attempts from this IP).
 */
export function isRateLimited(ip: string): boolean {
  const entry = ipAttempts.get(ip);
  const n = now();
  if (!entry) return false;
  if (n >= entry.resetAt) {
    ipAttempts.delete(ip);
    return false;
  }
  return entry.count >= RATE_LIMIT_MAX_ATTEMPTS;
}

/**
 * Record a login attempt from this IP (call on every login attempt).
 */
export function recordAttempt(ip: string): void {
  const n = now();
  const entry = ipAttempts.get(ip);
  if (!entry || n >= entry.resetAt) {
    ipAttempts.set(ip, { count: 1, resetAt: n + RATE_LIMIT_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

/**
 * Returns true if this email is currently locked out due to too many failures.
 */
export function isLockedOut(email: string): boolean {
  const entry = emailFailures.get(email.toLowerCase());
  if (!entry) return false;
  if (now() >= entry.lockedUntil) {
    emailFailures.delete(email.toLowerCase());
    return false;
  }
  return true;
}

/**
 * Record a failed login for this email. Call after verifying email exists but password wrong,
 * or when email doesn't exist (to avoid email enumeration we can still count it).
 */
export function recordFailure(email: string): void {
  const key = email.toLowerCase();
  const n = now();
  const entry = emailFailures.get(key);
  if (!entry || n >= entry.lockedUntil) {
    const lockedUntil = n + LOCKOUT_DURATION_MS;
    emailFailures.set(key, { failedCount: 1, lockedUntil });
    return;
  }
  entry.failedCount += 1;
  if (entry.failedCount >= LOCKOUT_AFTER_FAILURES) {
    entry.lockedUntil = n + LOCKOUT_DURATION_MS;
  }
}

/**
 * Clear failure count for this email (call on successful login).
 */
export function clearFailures(email: string): void {
  emailFailures.delete(email.toLowerCase());
}
