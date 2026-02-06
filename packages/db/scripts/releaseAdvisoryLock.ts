/**
 * Release Prisma advisory locks
 * Run this if migrations are timing out due to advisory lock issues
 * 
 * Usage: npm run release:lock (from root) or tsx scripts/releaseAdvisoryLock.ts (from packages/db)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for advisory locks...');

  try {
    // Get all advisory locks
    const locks = await prisma.$queryRaw<Array<{
      locktype: string;
      objid: bigint;
      pid: number;
      mode: string;
      granted: boolean;
    }>>`
      SELECT 
        locktype, 
        objid, 
        pid, 
        mode, 
        granted 
      FROM pg_locks 
      WHERE locktype = 'advisory'
    `;

    console.log(`Found ${locks.length} advisory lock(s):`);
    locks.forEach((lock, index) => {
      console.log(`  ${index + 1}. PID: ${lock.pid}, Object ID: ${lock.objid}, Mode: ${lock.mode}, Granted: ${lock.granted}`);
    });

    if (locks.length > 0) {
      console.log('\nAttempting to release all advisory locks...');
      
      // Release all advisory locks
      await prisma.$executeRaw`SELECT pg_advisory_unlock_all()`;
      
      console.log('✅ All advisory locks released successfully!');
    } else {
      console.log('✅ No advisory locks found.');
    }

    console.log('\nYou can now run migrations.');
  } catch (error) {
    console.error('Error releasing locks:', error);
    console.log('\nAlternative: Try restarting the database container:');
    console.log('  docker restart accounting-postgres');
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
