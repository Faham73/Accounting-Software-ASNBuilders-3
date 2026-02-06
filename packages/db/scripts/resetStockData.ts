/**
 * Reset stock data (DEV-ONLY).
 * Deletes all StockMovement, InventoryTxn, ProjectStockSetting, StockBalance,
 * nulls PurchaseLine.stockItemId, then deletes StockItem.
 *
 * Usage: npm run reset:stock (from root) or npm run reset:stock (from packages/db)
 * Env: DATABASE_URL via dotenv. Safety: NODE_ENV=development or ALLOW_RESET=YES.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function guard() {
  const dev = process.env.NODE_ENV === 'development';
  const allow = process.env.ALLOW_RESET === 'YES';
  if (!dev && !allow) {
    throw new Error(
      "Refusing to reset stock data outside development. Set NODE_ENV=development or ALLOW_RESET=YES to override."
    );
  }
}

async function main() {
  guard();

  console.log("Resetting stock data...");

  const r1 = await prisma.stockMovement.deleteMany({});
  console.log(`  StockMovement: deleted ${r1.count}`);

  const r2 = await prisma.inventoryTxn.deleteMany({});
  console.log(`  InventoryTxn: deleted ${r2.count}`);

  const r3 = await prisma.projectStockSetting.deleteMany({});
  console.log(`  ProjectStockSetting: deleted ${r3.count}`);

  const r4 = await prisma.stockBalance.deleteMany({});
  console.log(`  StockBalance: deleted ${r4.count}`);

  const r5 = await prisma.purchaseLine.updateMany({
    where: { stockItemId: { not: null } },
    data: { stockItemId: null },
  });
  console.log(`  PurchaseLine: cleared stockItemId on ${r5.count} rows`);

  const r6 = await prisma.stockItem.deleteMany({});
  console.log(`  StockItem: deleted ${r6.count}`);

  console.log("Stock data reset complete.");
}

main()
  .catch((e) => {
    console.error("Reset failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
