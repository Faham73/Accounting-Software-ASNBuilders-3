import { PrismaClient, UserRole, VoucherType, VoucherStatus, AccountType, ProjectStatus, InviteTokenPurpose } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Export enums for use across the application
export { UserRole, VoucherType, VoucherStatus, AccountType, ProjectStatus, InviteTokenPurpose };
