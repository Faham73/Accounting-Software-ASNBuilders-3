import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'
);

/**
 * Generate a short-lived PDF access token
 * Valid for 5 minutes
 */
export async function generatePdfToken(payload: {
  userId: string;
  companyId: string;
  entityType: 'voucher' | 'project' | 'vendor';
  entityId: string;
}): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m') // 5 minutes
    .sign(JWT_SECRET);
}

/**
 * Verify a PDF access token
 */
export async function verifyPdfToken(token: string): Promise<{
  userId: string;
  companyId: string;
  entityType: 'voucher' | 'project' | 'vendor';
  entityId: string;
}> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as {
    userId: string;
    companyId: string;
    entityType: 'voucher' | 'project' | 'vendor';
    entityId: string;
  };
}
