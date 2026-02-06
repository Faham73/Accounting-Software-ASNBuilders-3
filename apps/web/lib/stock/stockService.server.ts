/**
 * Server-only stock service functions
 * Transaction-safe stock adjustment with audit trail
 */

import { prisma } from '@accounting/db';
import { Prisma, StockMovementType } from '@prisma/client';

export interface AdjustStockParams {
  companyId: string;
  stockItemId: string;
  type: StockMovementType;
  qty: number | string | Prisma.Decimal;
  unitCost?: number | string | Prisma.Decimal;
  referenceType?: string;
  referenceId?: string;
  projectId?: string | null;
  vendorId?: string | null;
  notes?: string | null;
  userId: string;
  movementDate?: Date;
}

export interface AdjustStockResult {
  success: boolean;
  movementId?: string;
  balance?: {
    onHandQty: Prisma.Decimal;
    avgCost: Prisma.Decimal;
  };
  error?: string;
}

/**
 * Adjust stock with transaction safety and idempotency
 * Creates StockMovement and updates StockBalance atomically
 */
export async function adjustStock(
  params: AdjustStockParams
): Promise<AdjustStockResult> {
  const {
    companyId,
    stockItemId,
    type,
    qty,
    unitCost,
    referenceType,
    referenceId,
    projectId,
    vendorId,
    notes,
    userId,
    movementDate = new Date(),
  } = params;

  // Convert qty to Decimal
  const qtyDecimal = new Prisma.Decimal(qty);
  if (qtyDecimal.lte(0)) {
    return { success: false, error: 'Quantity must be positive' };
  }

  return await prisma.$transaction(async (tx) => {
    // Check idempotency: if referenceType+referenceId+stockItemId+type exists, return existing
    if (referenceType && referenceId) {
      const existing = await tx.stockMovement.findFirst({
        where: {
          companyId,
          stockItemId,
          type,
          referenceType,
          referenceId,
        },
      });

      if (existing) {
        // Return existing movement and current balance
        const balance = await tx.stockBalance.findUnique({
          where: {
            companyId_stockItemId: {
              companyId,
              stockItemId,
            },
          },
        });

        return {
          success: true,
          movementId: existing.id,
          balance: balance
            ? {
                onHandQty: balance.onHandQty,
                avgCost: balance.avgCost,
              }
            : undefined,
        };
      }
    }

    // Get or create stock balance
    let balance = await tx.stockBalance.findUnique({
      where: {
        companyId_stockItemId: {
          companyId,
          stockItemId,
        },
      },
    });

    if (!balance) {
      balance = await tx.stockBalance.create({
        data: {
          companyId,
          stockItemId,
          onHandQty: new Prisma.Decimal(0),
          avgCost: new Prisma.Decimal(0),
        },
      });
    }

    let newOnHandQty: Prisma.Decimal;
    let newAvgCost: Prisma.Decimal = balance.avgCost;

    // Handle different movement types
    if (type === 'IN') {
      newOnHandQty = balance.onHandQty.plus(qtyDecimal);

      // Update average cost if unitCost provided
      if (unitCost !== undefined) {
        const unitCostDecimal = new Prisma.Decimal(unitCost);
        const oldQty = balance.onHandQty;
        const oldAvg = balance.avgCost;

        if (oldQty.plus(qtyDecimal).gt(0)) {
          const totalOldCost = oldQty.mul(oldAvg);
          const newCost = qtyDecimal.mul(unitCostDecimal);
          const totalNewCost = totalOldCost.plus(newCost);
          newAvgCost = totalNewCost.div(oldQty.plus(qtyDecimal));
        } else {
          newAvgCost = unitCostDecimal;
        }
      }
    } else if (type === 'OUT') {
      // Prevent negative stock
      if (balance.onHandQty.lt(qtyDecimal)) {
        return {
          success: false,
          error: `Insufficient stock. Available: ${balance.onHandQty.toString()}, Requested: ${qtyDecimal.toString()}`,
        };
      }

      newOnHandQty = balance.onHandQty.minus(qtyDecimal);
      // avgCost remains the same for OUT
      newAvgCost = balance.avgCost;
    } else if (type === 'ADJUST') {
      // ADJUST allows setting quantity directly (qty is the new onHandQty)
      // But to keep it consistent, we'll treat qty as delta
      // For simplicity, we'll allow setting absolute value via notes or use qty as delta
      // Let's use qty as the target onHandQty for ADJUST
      newOnHandQty = qtyDecimal;
      // avgCost can be updated if unitCost provided
      if (unitCost !== undefined) {
        newAvgCost = new Prisma.Decimal(unitCost);
      } else {
        newAvgCost = balance.avgCost;
      }
    } else {
      return { success: false, error: `Invalid movement type: ${type}` };
    }

    // Prevent negative stock (double-check for ADJUST)
    if (newOnHandQty.lt(0)) {
      return {
        success: false,
        error: 'Stock adjustment would result in negative quantity',
      };
    }

    // Create movement
    const movement = await tx.stockMovement.create({
      data: {
        companyId,
        stockItemId,
        movementDate,
        type,
        qty: qtyDecimal,
        unitCost: unitCost !== undefined ? new Prisma.Decimal(unitCost) : null,
        referenceType: referenceType || null,
        referenceId: referenceId || null,
        notes: notes || null,
        projectId: projectId || null,
        vendorId: vendorId || null,
        createdById: userId,
      },
    });

    // Update balance
    const updatedBalance = await tx.stockBalance.upsert({
      where: {
        companyId_stockItemId: {
          companyId,
          stockItemId,
        },
      },
      create: {
        companyId,
        stockItemId,
        onHandQty: newOnHandQty,
        avgCost: newAvgCost,
      },
      update: {
        onHandQty: newOnHandQty,
        avgCost: newAvgCost,
      },
    });

    return {
      success: true,
      movementId: movement.id,
      balance: {
        onHandQty: updatedBalance.onHandQty,
        avgCost: updatedBalance.avgCost,
      },
    };
  });
}
