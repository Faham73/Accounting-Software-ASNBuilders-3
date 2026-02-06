import { prisma } from '@accounting/db';
import { Prisma, StockMovementKind, StockMovementType } from '@prisma/client';

export interface ProjectStockSummary {
  totalQtyOnHand: number;
  totalStockValue: number;
  usedStockValue: number;
  remainingStockValue: number;
  wastageValue: number;
  usedPercentage: number;
  remainingPercentage: number;
}

export interface ProjectStockItemBreakdown {
  stockItemId: string;
  stockItemName: string;
  stockItemUnit: string;
  openingQty: number;
  openingValue: number;
  receivedQty: number;
  receivedValue: number;
  issuedQty: number;
  issuedValue: number;
  wastageQty: number;
  wastageValue: number;
  remainingQty: number;
  avgRate: number;
  totalValue: number;
  minQty: number | null;
  reorderLevel: number | null;
  isLowStock: boolean;
}

export interface ProjectStockOverview {
  summary: ProjectStockSummary;
  items: ProjectStockItemBreakdown[];
}

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
    reorderLevel: Prisma.Decimal | null;
  };
}

interface ItemState {
  stockItem: { id: string; name: string; unit: string; reorderLevel: Prisma.Decimal | null };
  onHandQty: number;
  avgCost: number;
  // Reporting fields
  openingQty: number;
  openingValue: number;
  receivedQty: number;
  receivedValue: number;
  issuedQty: number;
  issuedValue: number;
  wastageQty: number;
  wastageValue: number;
}

/**
 * Classify a movement into a category
 * 
 * @param movement - Stock movement to classify
 * @returns Movement category (OPENING, IN, OUT, WASTAGE, or ADJUST)
 */
export function classifyMovement(movement: {
  movementKind: StockMovementKind | null;
  type: StockMovementType;
  qty: Prisma.Decimal;
}): MovementCategory {
  // If movementKind exists, use it
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

  // Fallback to type field
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

  // Default fallback
  return 'IN';
}

/**
 * Round to 4 decimal places for avgCost
 */
function roundAvgCost(cost: number): number {
  return Math.round(cost * 10000) / 10000;
}

/**
 * Compute weighted average for project movements
 * Processes movements chronologically and maintains running state
 * 
 * @param movements - Array of stock movements sorted chronologically
 * @returns Map of stockItemId to ItemState with computed values
 */
export function computeWeightedAverageForProjectMovements(
  movements: StockMovementWithRelations[]
): Map<string, ItemState> {
  // Sort movements chronologically: movementDate ASC, createdAt ASC, id ASC
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

    // Initialize item state if not exists
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

    // Process based on category
    if (category === 'OPENING') {
      // Opening stock: always increases qty and updates avgCost
      const inQty = qty;
      const inCost = unitCost ?? item.avgCost ?? 0; // Use current avgCost if unitCost missing

      item.openingQty += inQty;
      item.openingValue += inQty * inCost;

      // Update weighted average
      const newQty = item.onHandQty + inQty;
      if (newQty > 0) {
        const totalValue = item.onHandQty * item.avgCost + inQty * inCost;
        item.avgCost = roundAvgCost(totalValue / newQty);
      } else {
        item.avgCost = inCost > 0 ? roundAvgCost(inCost) : 0;
      }
      item.onHandQty = newQty;
    } else if (category === 'IN') {
      // IN movements: RECEIVE, TRANSFER_IN, RETURN_IN, or positive ADJUSTMENT
      const inQty = qty;
      // For IN movements: if unitCost is missing, use current avgCost (carry forward)
      const inCost = unitCost ?? item.avgCost ?? 0;

      item.receivedQty += inQty;
      item.receivedValue += inQty * inCost;

      // Update weighted average
      const newQty = item.onHandQty + inQty;
      if (newQty > 0) {
        const totalValue = item.onHandQty * item.avgCost + inQty * inCost;
        item.avgCost = roundAvgCost(totalValue / newQty);
      } else {
        item.avgCost = inCost > 0 ? roundAvgCost(inCost) : 0;
      }
      item.onHandQty = newQty;
    } else if (category === 'OUT') {
      // OUT movements: ISSUE, TRANSFER_OUT, or negative ADJUSTMENT
      const outQty = Math.abs(qty); // Ensure positive
      const outValue = outQty * item.avgCost; // Use current avgCost

      item.issuedQty += outQty;
      item.issuedValue += outValue;

      // Prevent negative onHandQty (clamp to 0)
      const newQty = Math.max(0, item.onHandQty - outQty);
      item.onHandQty = newQty;

      // Reset avgCost to 0 when qty becomes 0
      if (item.onHandQty === 0) {
        item.avgCost = 0;
      }
      // avgCost remains unchanged when issuing (unless qty becomes 0)
    } else if (category === 'WASTAGE') {
      // Wastage: decreases stock, uses current avgCost
      const wastageQty = qty;
      const wastageValue = wastageQty * item.avgCost;

      item.wastageQty += wastageQty;
      item.wastageValue += wastageValue;

      // Prevent negative onHandQty
      const newQty = Math.max(0, item.onHandQty - wastageQty);
      item.onHandQty = newQty;

      // Reset avgCost to 0 when qty becomes 0
      if (item.onHandQty === 0) {
        item.avgCost = 0;
      }
    } else if (category === 'ADJUST') {
      // ADJUSTMENT: can be positive (IN) or negative (OUT)
      if (qty > 0) {
        // Positive adjustment (stock increase)
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
        // Negative adjustment (stock decrease)
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

/**
 * Calculate project stock overview with weighted average valuation
 * Processes all movements chronologically to compute running balances
 */
export async function getProjectStockOverview(
  companyId: string,
  projectId: string
): Promise<ProjectStockOverview> {
  // Verify project belongs to company
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId,
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    throw new Error('Project not found or does not belong to company');
  }

  // Fetch all stock movements for this project, ordered chronologically
  const movements = await prisma.stockMovement.findMany({
    where: {
      companyId,
      OR: [
        { projectId },
        { destinationProjectId: projectId }, // Include transfers received
      ],
    },
    include: {
      stockItem: {
        select: {
          id: true,
          name: true,
          unit: true,
          reorderLevel: true,
        },
      },
    },
    orderBy: [
      { movementDate: 'asc' },
      { createdAt: 'asc' },
      { id: 'asc' }, // Add id for deterministic sorting
    ],
  });

  // Fetch low stock settings for this project
  const stockSettings = await prisma.projectStockSetting.findMany({
    where: {
      companyId,
      projectId,
    },
  });

  const settingsMap = new Map(
    stockSettings.map((s) => [s.stockItemId, Number(s.minQty)])
  );

  // Compute weighted average for all movements
  const itemMap = computeWeightedAverageForProjectMovements(movements);

  // Build breakdown array
  const items: ProjectStockItemBreakdown[] = Array.from(itemMap.values()).map((item) => {
    const remainingQty = item.onHandQty;
    const totalValue = remainingQty * item.avgCost;
    const minQty = settingsMap.get(item.stockItem.id) ?? null;
    const reorderLevel = item.stockItem.reorderLevel != null ? Number(item.stockItem.reorderLevel) : null;
    const threshold = minQty ?? reorderLevel ?? 0;
    const isLowStock = remainingQty < threshold;

    return {
      stockItemId: item.stockItem.id,
      stockItemName: item.stockItem.name,
      stockItemUnit: item.stockItem.unit,
      openingQty: item.openingQty,
      openingValue: item.openingValue,
      receivedQty: item.receivedQty,
      receivedValue: item.receivedValue,
      issuedQty: item.issuedQty,
      issuedValue: item.issuedValue,
      wastageQty: item.wastageQty,
      wastageValue: item.wastageValue,
      remainingQty,
      avgRate: item.avgCost,
      totalValue,
      minQty,
      reorderLevel,
      isLowStock,
    };
  });

  // Calculate summary totals
  const summary: ProjectStockSummary = {
    totalQtyOnHand: items.reduce((sum, item) => sum + item.remainingQty, 0),
    totalStockValue: items.reduce((sum, item) => sum + item.totalValue, 0),
    usedStockValue: items.reduce((sum, item) => sum + item.issuedValue, 0),
    remainingStockValue: items.reduce((sum, item) => sum + item.totalValue, 0),
    wastageValue: items.reduce((sum, item) => sum + item.wastageValue, 0),
    usedPercentage: 0,
    remainingPercentage: 0,
  };

  const totalValueIncludingUsed = summary.remainingStockValue + summary.usedStockValue;
  if (totalValueIncludingUsed > 0) {
    summary.usedPercentage = (summary.usedStockValue / totalValueIncludingUsed) * 100;
    summary.remainingPercentage = (summary.remainingStockValue / totalValueIncludingUsed) * 100;
  }

  return {
    summary,
    items,
  };
}
