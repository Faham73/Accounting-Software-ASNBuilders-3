/**
 * Unit tests for weighted average stock valuation
 * 
 * Run with: npx tsx apps/web/lib/stock/projectStock.test.ts
 * Or integrate with your test framework
 */

import { StockMovementKind, StockMovementType } from '@prisma/client';
import { Prisma } from '@prisma/client';

// Import the function we want to test (we'll need to export it)
// For now, we'll copy the logic here for testing

type MovementCategory = 'OPENING' | 'IN' | 'OUT' | 'WASTAGE' | 'ADJUST';

interface StockMovementWithRelations {
  id: string;
  stockItemId: string;
  movementDate: Date;
  createdAt: Date;
  type: StockMovementType;
  movementKind: StockMovementKind | null;
  qty: Prisma.Decimal;
  unitCost: Prisma.Decimal | null;
  stockItem: {
    id: string;
    name: string;
    unit: string;
  };
}

interface ItemState {
  stockItem: { id: string; name: string; unit: string };
  onHandQty: number;
  avgCost: number;
  openingQty: number;
  openingValue: number;
  receivedQty: number;
  receivedValue: number;
  issuedQty: number;
  issuedValue: number;
  wastageQty: number;
  wastageValue: number;
}

function classifyMovement(movement: {
  movementKind: StockMovementKind | null;
  type: StockMovementType;
  qty: Prisma.Decimal;
}): MovementCategory {
  if (movement.movementKind === StockMovementKind.OPENING) {
    return 'OPENING';
  }
  if (
    movement.movementKind === StockMovementKind.RECEIVE ||
    movement.movementKind === StockMovementKind.TRANSFER_IN ||
    movement.movementKind === StockMovementKind.RETURN_IN
  ) {
    return 'IN';
  }
  if (
    movement.movementKind === StockMovementKind.ISSUE ||
    movement.movementKind === StockMovementKind.TRANSFER_OUT
  ) {
    return 'OUT';
  }
  if (movement.movementKind === StockMovementKind.WASTAGE) {
    return 'WASTAGE';
  }
  if (movement.movementKind === StockMovementKind.ADJUSTMENT) {
    return 'ADJUST';
  }

  if (movement.type === 'IN') {
    return 'IN';
  }
  if (movement.type === 'OUT') {
    return 'OUT';
  }
  if (movement.type === 'ADJUST') {
    const qtyNum = Number(movement.qty);
    return qtyNum > 0 ? 'IN' : 'OUT';
  }

  return 'IN';
}

function roundAvgCost(cost: number): number {
  return Math.round(cost * 10000) / 10000;
}

function computeWeightedAverageForProjectMovements(
  movements: StockMovementWithRelations[]
): Map<string, ItemState> {
  const sortedMovements = [...movements].sort((a, b) => {
    const dateDiff = a.movementDate.getTime() - b.movementDate.getTime();
    if (dateDiff !== 0) return dateDiff;
    const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdDiff !== 0) return createdDiff;
    return a.id.localeCompare(b.id);
  });

  const itemMap = new Map<string, ItemState>();

  for (const movement of sortedMovements) {
    const itemId = movement.stockItemId;
    const qty = Number(movement.qty);
    const unitCost = movement.unitCost ? Number(movement.unitCost) : null;

    if (!itemMap.has(itemId)) {
      itemMap.set(itemId, {
        stockItem: movement.stockItem,
        onHandQty: 0,
        avgCost: 0,
        openingQty: 0,
        openingValue: 0,
        receivedQty: 0,
        receivedValue: 0,
        issuedQty: 0,
        issuedValue: 0,
        wastageQty: 0,
        wastageValue: 0,
      });
    }

    const item = itemMap.get(itemId)!;
    const category = classifyMovement(movement);

    if (category === 'OPENING') {
      const inQty = qty;
      const inCost = unitCost ?? item.avgCost ?? 0;

      item.openingQty += inQty;
      item.openingValue += inQty * inCost;

      const newQty = item.onHandQty + inQty;
      if (newQty > 0) {
        const totalValue = item.onHandQty * item.avgCost + inQty * inCost;
        item.avgCost = roundAvgCost(totalValue / newQty);
      } else {
        item.avgCost = inCost > 0 ? roundAvgCost(inCost) : 0;
      }
      item.onHandQty = newQty;
    } else if (category === 'IN') {
      const inQty = qty;
      const inCost = unitCost ?? item.avgCost ?? 0;

      item.receivedQty += inQty;
      item.receivedValue += inQty * inCost;

      const newQty = item.onHandQty + inQty;
      if (newQty > 0) {
        const totalValue = item.onHandQty * item.avgCost + inQty * inCost;
        item.avgCost = roundAvgCost(totalValue / newQty);
      } else {
        item.avgCost = inCost > 0 ? roundAvgCost(inCost) : 0;
      }
      item.onHandQty = newQty;
    } else if (category === 'OUT') {
      const outQty = Math.abs(qty);
      const outValue = outQty * item.avgCost;

      item.issuedQty += outQty;
      item.issuedValue += outValue;

      const newQty = Math.max(0, item.onHandQty - outQty);
      item.onHandQty = newQty;

      if (item.onHandQty === 0) {
        item.avgCost = 0;
      }
    } else if (category === 'WASTAGE') {
      const wastageQty = qty;
      const wastageValue = wastageQty * item.avgCost;

      item.wastageQty += wastageQty;
      item.wastageValue += wastageValue;

      const newQty = Math.max(0, item.onHandQty - wastageQty);
      item.onHandQty = newQty;

      if (item.onHandQty === 0) {
        item.avgCost = 0;
      }
    } else if (category === 'ADJUST') {
      if (qty > 0) {
        const inQty = qty;
        const inCost = unitCost ?? item.avgCost ?? 0;

        item.receivedQty += inQty;
        item.receivedValue += inQty * inCost;

        const newQty = item.onHandQty + inQty;
        if (newQty > 0) {
          const totalValue = item.onHandQty * item.avgCost + inQty * inCost;
          item.avgCost = roundAvgCost(totalValue / newQty);
        } else {
          item.avgCost = inCost > 0 ? roundAvgCost(inCost) : 0;
        }
        item.onHandQty = newQty;
      } else {
        const outQty = Math.abs(qty);
        const outValue = outQty * item.avgCost;

        item.issuedQty += outQty;
        item.issuedValue += outValue;

        const newQty = Math.max(0, item.onHandQty - outQty);
        item.onHandQty = newQty;

        if (item.onHandQty === 0) {
          item.avgCost = 0;
        }
      }
    }
  }

  return itemMap;
}

// Test cases
function createMovement(
  id: string,
  qty: number,
  unitCost: number | null,
  movementKind: StockMovementKind | null,
  type: StockMovementType = 'IN',
  date: Date = new Date('2024-01-01')
): StockMovementWithRelations {
  return {
    id,
    stockItemId: 'item1',
    movementDate: date,
    createdAt: date,
    type,
    movementKind,
    qty: new Prisma.Decimal(qty),
    unitCost: unitCost !== null ? new Prisma.Decimal(unitCost) : null,
    stockItem: {
      id: 'item1',
      name: 'Test Item',
      unit: 'kg',
    },
  };
}

function runTests() {
  console.log('Running weighted average tests...\n');

  // Test 1: Opening + Receive + Issue + Wastage
  console.log('Test 1: Opening 10 @ 100, Receive 10 @ 200, Issue 5, Wastage 5');
  const movements1 = [
    createMovement('1', 10, 100, StockMovementKind.OPENING, 'IN', new Date('2024-01-01')),
    createMovement('2', 10, 200, StockMovementKind.RECEIVE, 'IN', new Date('2024-01-02')),
    createMovement('3', 5, null, StockMovementKind.ISSUE, 'OUT', new Date('2024-01-03')),
    createMovement('4', 5, null, StockMovementKind.WASTAGE, 'OUT', new Date('2024-01-04')),
  ];

  const result1 = computeWeightedAverageForProjectMovements(movements1);
  const item1 = result1.get('item1')!;

  console.log(`  Opening: ${item1.openingQty} @ ${item1.openingValue / item1.openingQty} = ${item1.openingValue}`);
  console.log(`  Received: ${item1.receivedQty} @ ${item1.receivedValue / item1.receivedQty} = ${item1.receivedValue}`);
  console.log(`  Issued: ${item1.issuedQty}, Value: ${item1.issuedValue}`);
  console.log(`  Wastage: ${item1.wastageQty}, Value: ${item1.wastageValue}`);
  console.log(`  Remaining: ${item1.onHandQty} @ avg ${item1.avgCost} = ${item1.onHandQty * item1.avgCost}`);

  // Expected: Opening 10@100, Receive 10@200 => avg 150, Issue 5 => 750, Wastage 5 => 750, Remaining 10@150
  const expectedAvg = 150;
  const expectedIssuedValue = 5 * 150; // 750
  const expectedWastageValue = 5 * 150; // 750
  const expectedRemaining = 10;
  const expectedRemainingValue = 10 * 150; // 1500

  console.log(`\n  Expected avg: ${expectedAvg}, Got: ${item1.avgCost}`);
  console.log(`  Expected issued value: ${expectedIssuedValue}, Got: ${item1.issuedValue}`);
  console.log(`  Expected wastage value: ${expectedWastageValue}, Got: ${item1.wastageValue}`);
  console.log(`  Expected remaining qty: ${expectedRemaining}, Got: ${item1.onHandQty}`);
  console.log(`  Expected remaining value: ${expectedRemainingValue}, Got: ${item1.onHandQty * item1.avgCost}`);

  const test1Pass =
    Math.abs(item1.avgCost - expectedAvg) < 0.01 &&
    Math.abs(item1.issuedValue - expectedIssuedValue) < 0.01 &&
    Math.abs(item1.wastageValue - expectedWastageValue) < 0.01 &&
    item1.onHandQty === expectedRemaining;

  console.log(`  Test 1: ${test1Pass ? 'PASS' : 'FAIL'}\n`);

  // Test 2: Receive without unitCost uses avgCost
  console.log('Test 2: Opening 10 @ 100, Receive 10 @ 200, Receive 5 (no unitCost)');
  const movements2 = [
    createMovement('1', 10, 100, StockMovementKind.OPENING, 'IN', new Date('2024-01-01')),
    createMovement('2', 10, 200, StockMovementKind.RECEIVE, 'IN', new Date('2024-01-02')),
    createMovement('3', 5, null, StockMovementKind.RECEIVE, 'IN', new Date('2024-01-03')), // No unitCost
  ];

  const result2 = computeWeightedAverageForProjectMovements(movements2);
  const item2 = result2.get('item1')!;

  console.log(`  After first receive: avg = ${(10 * 100 + 10 * 200) / 20} (should be 150)`);
  console.log(`  After second receive (no unitCost): avg = ${item2.avgCost}`);
  console.log(`  Remaining qty: ${item2.onHandQty}`);

  // Expected: After first receive avg = 150, second receive uses 150, new avg = (20*150 + 5*150)/25 = 150
  const expectedAvg2 = 150;
  const test2Pass = Math.abs(item2.avgCost - expectedAvg2) < 0.01 && item2.onHandQty === 25;

  console.log(`  Test 2: ${test2Pass ? 'PASS' : 'FAIL'}\n`);

  // Test 3: Issue when qty becomes 0, avgCost resets
  console.log('Test 3: Opening 10 @ 100, Issue 10 (should reset avgCost to 0)');
  const movements3 = [
    createMovement('1', 10, 100, StockMovementKind.OPENING, 'IN', new Date('2024-01-01')),
    createMovement('2', 10, null, StockMovementKind.ISSUE, 'OUT', new Date('2024-01-02')),
  ];

  const result3 = computeWeightedAverageForProjectMovements(movements3);
  const item3 = result3.get('item1')!;

  console.log(`  Remaining qty: ${item3.onHandQty}`);
  console.log(`  Avg cost: ${item3.avgCost}`);
  console.log(`  Issued value: ${item3.issuedValue}`);

  const test3Pass = item3.onHandQty === 0 && item3.avgCost === 0 && item3.issuedValue === 10 * 100;

  console.log(`  Test 3: ${test3Pass ? 'PASS' : 'FAIL'}\n`);

  // Summary
  const allPass = test1Pass && test2Pass && test3Pass;
  console.log(`\n${allPass ? 'All tests PASSED' : 'Some tests FAILED'}`);
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}

export { computeWeightedAverageForProjectMovements, classifyMovement };
