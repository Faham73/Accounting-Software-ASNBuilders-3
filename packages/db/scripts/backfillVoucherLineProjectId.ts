/**
 * Backfill voucherLine.projectId from voucher.projectId for existing data.
 * Updates voucherLines where projectId is null but voucher.projectId is not null.
 * 
 * This makes filtering faster and consistent (no need for OR queries).
 * 
 * Usage: npm run backfill:voucher-line-project-id (add script) or tsx packages/db/scripts/backfillVoucherLineProjectId.ts
 * Env: DATABASE_URL via dotenv. Safety: NODE_ENV=development or ALLOW_RESET=YES.
 */

import { prisma } from '../src/client';

function guard() {
  const dev = process.env.NODE_ENV === 'development';
  const allow = process.env.ALLOW_RESET === 'YES';
  const allowBackfill = process.env.ALLOW_BACKFILL === 'YES';
  if (!dev && !allow && !allowBackfill) {
    throw new Error(
      "Refusing to backfill outside development. Set NODE_ENV=development, ALLOW_RESET=YES, or ALLOW_BACKFILL=YES to override."
    );
  }
}

async function main() {
  // Auto-allow when run via npm script
  if (process.env.npm_lifecycle_event === 'backfill:voucher-line-project-id') {
    process.env.ALLOW_BACKFILL = 'YES';
  }
  guard();

  console.log('🔄 Backfilling voucherLine.projectId from voucher.projectId...\n');

  // Find voucherLines where projectId is null but voucher.projectId is not null
  const voucherLinesToUpdate = await prisma.voucherLine.findMany({
    where: {
      projectId: null,
      voucher: {
        projectId: { not: null },
      },
    },
    select: {
      id: true,
      voucherId: true,
      voucher: {
        select: {
          projectId: true,
        },
      },
    },
  });

  console.log(`Found ${voucherLinesToUpdate.length} voucherLines to update.\n`);

  if (voucherLinesToUpdate.length === 0) {
    console.log('✅ No voucherLines need updating. All done!');
    return;
  }

  // Group by voucher.projectId for batch updates
  const updatesByProjectId = new Map<string, string[]>();
  for (const line of voucherLinesToUpdate) {
    const projectId = line.voucher.projectId!;
    if (!updatesByProjectId.has(projectId)) {
      updatesByProjectId.set(projectId, []);
    }
    updatesByProjectId.get(projectId)!.push(line.id);
  }

  console.log(`Updating ${updatesByProjectId.size} unique projects...\n`);

  // Update in batches (one per projectId)
  let totalUpdated = 0;
  for (const [projectId, lineIds] of updatesByProjectId.entries()) {
    const result = await prisma.voucherLine.updateMany({
      where: {
        id: { in: lineIds },
        projectId: null, // Double-check: only update if still null
      },
      data: {
        projectId,
      },
    });
    totalUpdated += result.count;
    console.log(`  Updated ${result.count} lines for project ${projectId}`);
  }

  console.log(`\n✅ Backfill complete. Updated ${totalUpdated} voucherLines.`);

  // Verify: check if any mismatches remain
  const remainingMismatches = await prisma.voucherLine.count({
    where: {
      projectId: null,
      voucher: {
        projectId: { not: null },
      },
    },
  });

  if (remainingMismatches > 0) {
    console.log(`\n⚠️  Warning: ${remainingMismatches} voucherLines still have null projectId but voucher.projectId is set.`);
    console.log('   This may indicate concurrent updates. Re-run the script to fix.');
  } else {
    console.log('\n✅ Verification passed: No mismatches remaining.');
  }
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
