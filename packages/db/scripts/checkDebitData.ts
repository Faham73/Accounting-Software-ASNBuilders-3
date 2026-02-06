/**
 * Check debit data shape to diagnose project filter issue
 * Run: npm run check:debit (add script) or tsx packages/db/scripts/checkDebitData.ts
 */

import { prisma } from '../src/client';

async function main() {
  console.log('🔍 Checking debit data shape...\n');

  // 1. Count voucherLines where debit > 0 AND projectId IS NULL
  const nullProjectIdCount = await prisma.voucherLine.count({
    where: {
      debit: { gt: 0 },
      projectId: null,
    },
  });
  console.log(`1. VoucherLines with debit > 0 AND projectId IS NULL: ${nullProjectIdCount}`);

  // 2. Count voucherLines where debit > 0 AND voucher.projectId IS NOT NULL
  const voucherHasProjectIdCount = await prisma.voucherLine.count({
    where: {
      debit: { gt: 0 },
      voucher: {
        projectId: { not: null },
      },
    },
  });
  console.log(`2. VoucherLines with debit > 0 AND voucher.projectId IS NOT NULL: ${voucherHasProjectIdCount}`);

  // 3. Count voucherLines where debit > 0 AND voucherLine.projectId IS NULL BUT voucher.projectId IS NOT NULL
  const mismatchCount = await prisma.voucherLine.count({
    where: {
      debit: { gt: 0 },
      projectId: null,
      voucher: {
        projectId: { not: null },
      },
    },
  });
  console.log(`3. MISMATCH: VoucherLines with debit > 0 AND projectId IS NULL BUT voucher.projectId IS NOT NULL: ${mismatchCount}`);

  // 4. Sample 5 debit voucherLines
  console.log('\n4. Sample of 5 debit voucherLines:');
  const samples = await prisma.voucherLine.findMany({
    where: {
      debit: { gt: 0 },
    },
    take: 5,
    select: {
      id: true,
      projectId: true,
      debit: true,
      voucher: {
        select: {
          id: true,
          projectId: true,
          status: true,
          date: true,
          voucherNo: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  samples.forEach((line, idx) => {
    console.log(`\n   Sample ${idx + 1}:`);
    console.log(`     voucherLine.id: ${line.id}`);
    console.log(`     voucherLine.projectId: ${line.projectId ?? 'NULL'}`);
    console.log(`     voucher.projectId: ${line.voucher.projectId ?? 'NULL'}`);
    console.log(`     voucher.status: ${line.voucher.status}`);
    console.log(`     voucher.date: ${line.voucher.date.toISOString().split('T')[0]}`);
    console.log(`     voucher.voucherNo: ${line.voucher.voucherNo}`);
    console.log(`     debit: ${line.debit.toString()}`);
    if (line.projectId === null && line.voucher.projectId !== null) {
      console.log(`     ⚠️  MISMATCH: voucherLine.projectId is NULL but voucher.projectId is set!`);
    }
  });

  // 5. Count by status
  console.log('\n5. Counts by voucher status:');
  const statuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED'];
  for (const status of statuses) {
    const count = await prisma.voucherLine.count({
      where: {
        debit: { gt: 0 },
        voucher: {
          status: status as any,
        },
      },
    });
    console.log(`   ${status}: ${count}`);
  }

  console.log('\n✅ Check complete.');
}

main()
  .catch((e) => {
    console.error('❌ Check failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
