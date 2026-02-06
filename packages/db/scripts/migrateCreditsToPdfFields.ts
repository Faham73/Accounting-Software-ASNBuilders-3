/**
 * Migration script to backfill Credit entries from existing VoucherLine credits.
 * 
 * Maps old VoucherLine credit entries to new Credit model with PDF-style fields:
 * - purpose = description (old) or voucher.narration
 * - paymentMethod = "Cash" (default) OR infer from account if possible
 * - paymentRef = account name (if old "Account" contains bank/check info)
 * - paidBy = "Unknown" (until manually fixed)
 * - receivedBy = "Unknown"
 * - projectSnapshotName = project.name (populate from relation at migration time)
 * - note = "Done" (default)
 * 
 * Usage: npm run migrate:credits (from root) or tsx scripts/migrateCreditsToPdfFields.ts (from packages/db)
 * Env: DATABASE_URL via dotenv
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Infer payment method from account name
 */
function inferPaymentMethod(accountName: string): string {
  const name = accountName.toLowerCase();
  if (name.includes('cash')) return 'Cash';
  if (name.includes('check') || name.includes('cheque')) return 'Check';
  if (name.includes('bank') || name.includes('dbbl') || name.includes('ific') || name.includes('brac')) {
    return 'Bank Transfer';
  }
  if (name.includes('bkash') || name.includes('nagad') || name.includes('rocket')) {
    return 'Bkash';
  }
  return 'Cash'; // Default
}

/**
 * Extract payment reference from account name
 */
function extractPaymentRef(accountName: string, accountCode: string): string | null {
  // If account name contains bank/check info, use it as paymentRef
  const name = accountName.toLowerCase();
  if (name.includes('bank') || name.includes('check') || name.includes('cheque') || 
      name.includes('dbbl') || name.includes('ific') || name.includes('brac')) {
    return `${accountCode} - ${accountName}`;
  }
  return null;
}

async function main() {
  console.log('Starting credit migration from VoucherLine to Credit model...');

  // Find all voucher lines with credit > 0
  const creditLines = await prisma.voucherLine.findMany({
    where: {
      credit: { gt: 0 },
    },
    include: {
      voucher: {
        select: {
          id: true,
          date: true,
          narration: true,
          voucherNo: true,
        },
      },
      account: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      company: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`Found ${creditLines.length} credit entries to migrate`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const line of creditLines) {
    try {
      // Check if already migrated (optional - you can add a flag field if needed)
      // For now, we'll migrate all entries

      const purpose = line.description || line.voucher.narration || 'Credit Entry';
      const paymentMethod = inferPaymentMethod(line.account.name);
      const paymentRef = extractPaymentRef(line.account.name, line.account.code);
      
      // Create Credit entry
      await prisma.credit.create({
        data: {
          companyId: line.companyId,
          projectId: line.projectId,
          projectSnapshotName: line.project?.name || 'Company (All Projects)',
          date: line.voucher.date,
          purpose,
          paidBy: 'Unknown', // To be manually corrected later
          receivedBy: 'Unknown', // To be manually corrected later
          paymentMethod,
          paymentRef,
          paymentAccountId: line.accountId, // Keep reference to account for accounting compatibility
          amount: line.credit,
          note: 'Done',
        },
      });

      migrated++;
      if (migrated % 100 === 0) {
        console.log(`  Migrated ${migrated} entries...`);
      }
    } catch (error) {
      console.error(`Error migrating credit line ${line.id}:`, error);
      errors++;
    }
  }

  console.log('\nMigration complete!');
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log('\nNote: Please manually update paidBy and receivedBy fields for migrated entries.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
