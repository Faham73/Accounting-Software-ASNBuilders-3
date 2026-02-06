import crypto from 'crypto';
import { prisma, InviteTokenPurpose } from '@accounting/db';

const TOKEN_BYTES = 32;
const DEFAULT_EXPIRY_HOURS = 72; // 3 days for invite/reset links

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

/**
 * Generate a secure random token (raw string) and store its SHA-256 hash in DB.
 * Returns the raw token (to be shown once to the user); caller builds the set-password URL.
 */
export async function createInviteToken(params: {
  userId: string;
  companyId: string;
  purpose: InviteTokenPurpose;
  expiresInHours?: number;
}): Promise<string> {
  const raw = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + (params.expiresInHours ?? DEFAULT_EXPIRY_HOURS) * 60 * 60 * 1000);

  await prisma.inviteToken.create({
    data: {
      tokenHash,
      userId: params.userId,
      companyId: params.companyId,
      purpose: params.purpose,
      expiresAt,
    },
  });

  return raw;
}

/**
 * Verify raw token: find InviteToken by hash where usedAt is null, expiresAt > now, purpose in INVITE | RESET_PASSWORD.
 * Returns the token record with user, or null if invalid.
 */
export async function verifyInviteToken(raw: string): Promise<{
  id: string;
  userId: string;
  companyId: string;
  purpose: InviteTokenPurpose;
  user: { id: string; email: string; name: string };
} | null> {
  const tokenHash = hashToken(raw);
  const now = new Date();

  const token = await prisma.inviteToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (
    !token ||
    token.usedAt !== null ||
    token.expiresAt <= now ||
    (token.purpose !== 'INVITE' && token.purpose !== 'RESET_PASSWORD')
  ) {
    return null;
  }

  return {
    id: token.id,
    userId: token.userId,
    companyId: token.companyId,
    purpose: token.purpose,
    user: token.user,
  };
}

/**
 * Mark token as used (set usedAt).
 */
export async function markTokenUsed(tokenId: string): Promise<void> {
  await prisma.inviteToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}
