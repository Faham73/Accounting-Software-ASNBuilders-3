import { getProjectStockOverview } from '@/lib/stock/projectStock.server';

export interface LowStockItem {
  stockItemId: string;
  stockItemName: string;
  stockItemUnit: string;
  currentQty: number;
  threshold: number;
}

export interface ProjectStockStatus {
  receivedTotal: number;
  usedTotal: number;
  currentBalance: number;
  lowStockItems: LowStockItem[];
}

/**
 * Returns stock metrics for the project dashboard: received/used/current totals
 * and top 5 low-stock items (current qty below project minQty or item reorderLevel or 0).
 */
export async function getProjectStockStatus(
  companyId: string,
  projectId: string
): Promise<ProjectStockStatus> {
  const overview = await getProjectStockOverview(companyId, projectId);

  const receivedTotal =
    overview.items.reduce((sum, i) => sum + i.openingQty + i.receivedQty, 0);
  const usedTotal = overview.items.reduce((sum, i) => sum + i.issuedQty, 0);
  const currentBalance = overview.summary.totalQtyOnHand;

  const lowStockItems: LowStockItem[] = overview.items
    .filter((i) => i.isLowStock)
    .sort((a, b) => a.remainingQty - b.remainingQty)
    .slice(0, 5)
    .map((i) => ({
      stockItemId: i.stockItemId,
      stockItemName: i.stockItemName,
      stockItemUnit: i.stockItemUnit,
      currentQty: i.remainingQty,
      threshold: i.minQty ?? i.reorderLevel ?? 0,
    }));

  return {
    receivedTotal,
    usedTotal,
    currentBalance,
    lowStockItems,
  };
}
