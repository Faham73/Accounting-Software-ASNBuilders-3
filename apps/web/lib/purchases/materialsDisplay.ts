/**
 * Shared display logic for purchase material names in list tables.
 * Used by both company-wide Purchases list and project-level Purchases list.
 */

export interface PurchaseLineForMaterials {
  materialName?: string | null;
  description?: string | null;
  stockItem?: { name: string } | null;
}

/**
 * Build display string for material names from purchase lines:
 * - Prefer line.materialName, fallback to line.stockItem?.name, then line.description
 * - Dedupe and trim
 * - Show up to 2 names inline (comma-separated), then "+N" if more
 * - Empty => "—"
 */
export function getPurchaseMaterialsLabel(lines: PurchaseLineForMaterials[]): string {
  const names = new Set<string>();
  for (const line of lines) {
    const name =
      (line.materialName && line.materialName.trim()) ||
      (line.stockItem?.name && line.stockItem.name.trim()) ||
      (line.description && line.description.trim());
    if (name) names.add(name);
  }
  const arr = [...names];
  if (arr.length === 0) return '—';
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]}, ${arr[1]}`;
  return `${arr[0]}, ${arr[1]} +${arr.length - 2}`;
}
