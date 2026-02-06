/**
 * Server-only functions for Purchase-Stock integration
 * Creates StockMovement IN when purchase voucher is POSTED
 */

import { prisma } from '@accounting/db';
import { Prisma } from '@prisma/client';
import { adjustStock } from '@/lib/stock/stockService.server';

/**
 * Create stock movements for a posted purchase
 * For each purchase line with stockItemId, create StockMovement IN
 */
export async function createStockMovementsForPostedPurchase(
  purchaseId: string,
  companyId: string,
  userId: string
): Promise<{ success: boolean; error?: string; movementsCreated: number }> {
  return await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      where: {
        id: purchaseId,
        companyId,
      },
      include: {
        lines: {
          include: {
            stockItem: true,
          },
        },
        supplierVendor: true,
      },
    });

    if (!purchase) {
      return { success: false, error: 'Purchase not found', movementsCreated: 0 };
    }

    if (purchase.status !== 'POSTED') {
      return {
        success: false,
        error: 'Purchase must be POSTED to create stock movements',
        movementsCreated: 0,
      };
    }

    let movementsCreated = 0;

    // Create stock movements only for MATERIAL lines with stockItemId
    for (const line of purchase.lines) {
      // Only process MATERIAL lines with stockItemId
      if (line.lineType !== 'MATERIAL' || !line.stockItemId) {
        continue; // Skip non-MATERIAL lines or lines without stock item
      }

      // Check idempotency: if movement already exists for this purchase line, skip
      const existing = await tx.stockMovement.findFirst({
        where: {
          companyId,
          stockItemId: line.stockItemId,
          type: 'IN',
          referenceType: 'PURCHASE_VOUCHER',
          referenceId: purchaseId,
        },
      });

      if (existing) {
        continue; // Already processed
      }

      // Validate quantity exists
      if (!line.quantity || line.quantity.lte(0)) {
        console.error(
          `Skipping stock movement for purchase line ${line.id}: invalid quantity`
        );
        continue;
      }

      // Use unitRate if available, otherwise compute from lineTotal/quantity
      const unitCost = line.unitRate 
        ? line.unitRate 
        : (line.lineTotal && line.quantity ? line.lineTotal.div(line.quantity) : new Prisma.Decimal(0));
      
      // Convert to number for adjustStock (it expects number)
      const unitCostNum = unitCost.toNumber();

      // Create stock movement
      const result = await adjustStock({
        companyId,
        stockItemId: line.stockItemId,
        type: 'IN',
        qty: line.quantity.toNumber(),
        unitCost: unitCostNum,
        referenceType: 'PURCHASE_VOUCHER',
        referenceId: purchaseId,
        projectId: purchase.projectId,
        vendorId: purchase.supplierVendorId,
        notes: `Purchase: ${purchase.challanNo || purchase.id}`,
        userId,
        movementDate: purchase.date,
      });

      if (result.success) {
        movementsCreated++;
      } else {
        // Log error but continue with other lines
        console.error(
          `Failed to create stock movement for purchase line ${line.id}:`,
          result.error
        );
      }
    }

    return { success: true, movementsCreated };
  });
}

/**
 * Reverse stock movements for a reversed purchase
 * Creates StockMovement OUT to reverse the IN movements
 */
export async function reverseStockMovementsForPurchase(
  purchaseId: string,
  companyId: string,
  userId: string
): Promise<{ success: boolean; error?: string; movementsReversed: number }> {
  return await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      where: {
        id: purchaseId,
        companyId,
      },
      include: {
        lines: {
          include: {
            stockItem: true,
          },
        },
      },
    });

    if (!purchase) {
      return { success: false, error: 'Purchase not found', movementsReversed: 0 };
    }

    if (purchase.status !== 'REVERSED') {
      return {
        success: false,
        error: 'Purchase must be REVERSED to reverse stock movements',
        movementsReversed: 0,
      };
    }

      // Find original IN movements for this purchase
      const originalMovements = await tx.stockMovement.findMany({
        where: {
          companyId,
          type: 'IN',
          referenceType: 'PURCHASE_VOUCHER',
          referenceId: purchaseId,
        },
      });

    let movementsReversed = 0;

    // Create reversal OUT movements
    for (const original of originalMovements) {
      // Check if reversal already exists
      const existingReversal = await tx.stockMovement.findFirst({
        where: {
          companyId,
          stockItemId: original.stockItemId,
          type: 'OUT',
          referenceType: 'PURCHASE_REVERSAL',
          referenceId: purchaseId,
        },
      });

      if (existingReversal) {
        continue; // Already reversed
      }

      // Create reversal movement
      const result = await adjustStock({
        companyId,
        stockItemId: original.stockItemId,
        type: 'OUT',
        qty: original.qty,
        referenceType: 'PURCHASE_REVERSAL',
        referenceId: purchaseId,
        projectId: original.projectId,
        notes: `Reversal of purchase: ${purchase.challanNo || purchase.id}`,
        userId,
        movementDate: new Date(),
      });

      if (result.success) {
        movementsReversed++;
      }
    }

    return { success: true, movementsReversed };
  });
}
