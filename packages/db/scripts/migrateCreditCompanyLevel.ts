/**
 * Migration script to set isCompanyLevel for existing voucher lines
 * 
 * This script:
 * 1. Sets isCompanyLevel = false for all existing voucher lines (default behavior)
 * 2. If you have any credits that should be company-level (projectId = null and credit > 0),
 *    you can manually update them after running this script
 * 
 * Run: npm run db:migrate (from root) to apply the schema migration first
 * Then run: dotenv -e ../../.env -- tsx packages/db/scripts/migrateCreditCompanyLevel.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration: Setting isCompanyLevel for existing voucher lines...');

  // Update all existing voucher lines to have isCompanyLevel = false
  // (This is the default, but we're being explicit)
  const result = await prisma.voucherLine.updateMany({
    where: {
      // Update all rows that don't have isCompanyLevel set (shouldn't happen with default, but safe)
      // Actually, since default is false, we just ensure all rows are explicitly set
    },
    data: {
      isCompanyLevel: false,
    },
  });

  console.log(`Updated ${result.count} voucher lines with isCompanyLevel = false`);

  // Optional: If you have any credits that should be company-level (projectId = null and credit > 0),
  // you can uncomment and modify this section:
  /*
  const companyLevelCredits = await prisma.voucherLine.updateMany({
    where: {
      projectId: null,
      credit: { gt: 0 },
      // Add any additional conditions here to identify company-level credits
    },
    data: {
      isCompanyLevel: true,
    },
  });

  console.log(`Updated ${companyLevelCredits.count} voucher lines to company-level credits`);
  */

  console.log('Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
