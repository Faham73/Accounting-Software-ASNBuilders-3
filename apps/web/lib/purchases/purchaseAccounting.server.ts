/**
 * Server-only functions for Purchase accounting integration
 * DO NOT import in client components
 */

import { prisma } from '@accounting/db';
import { Prisma } from '@prisma/client';
import { generateVoucherNumber, isLeafAccount } from '@/lib/voucher';
import { NextRequest } from 'next/server';

export interface VoucherCreateData {
  companyId: string;
  projectId: string | null;
  date: Date;
  narration: string | null;
  expenseType: 'PROJECT_EXPENSE' | 'OFFICE_EXPENSE' | null;
  lines: Array<{
    accountId: string;
    description: string | null;
    debit: Prisma.Decimal;
    credit: Prisma.Decimal;
    projectId: string | null;
    vendorId: string | null;
  }>;
}

/**
 * Get default accounts for purchase accounting
 */
async function getDefaultAccounts(companyId: string) {
  // Get Accounts Payable (code 2010) - must be system account
  const apAccount = await prisma.account.findFirst({
    where: {
      companyId,
      code: '2010',
      isActive: true,
      isSystem: true,
    },
  });

  // Get default accounts by code - must be system accounts
  const [materialsAccount, laborAccount, overheadAccount, miscAccount] = await Promise.all([
    // 5010 - Direct Materials
    prisma.account.findFirst({
      where: { companyId, code: '5010', isActive: true, isSystem: true },
    }),
    // 5020 - Direct Labor
    prisma.account.findFirst({
      where: { companyId, code: '5020', isActive: true, isSystem: true },
    }),
    // 5030 - Site Overhead
    prisma.account.findFirst({
      where: { companyId, code: '5030', isActive: true, isSystem: true },
    }),
    // 5090 - Misc Expense
    prisma.account.findFirst({
      where: { companyId, code: '5090', isActive: true, isSystem: true },
    }),
  ]);

  return {
    apAccount,
    materialsAccount: materialsAccount || null,
    laborAccount: laborAccount || null,
    overheadAccount: overheadAccount || null,
    miscAccount: miscAccount || null,
  };
}

/**
 * Get material/inventory account for a purchase line
 */
async function getMaterialAccount(
  line: {
    lineType: string;
    stockItemId?: string | null;
  },
  defaultMaterialsAccount: { id: string } | null,
  companyId: string
): Promise<{ success: boolean; accountId?: string; error?: string }> {
  // Only MATERIAL lines use inventory/materials accounts
  if (line.lineType !== 'MATERIAL') {
    return { success: false, error: 'Not a MATERIAL line' };
  }

  // Use default materials account
  if (defaultMaterialsAccount) {
    const isLeaf = await isLeafAccount(defaultMaterialsAccount.id);
    if (isLeaf) {
      return { success: true, accountId: defaultMaterialsAccount.id };
    }
  }

  return {
    success: false,
    error: 'Inventory/Materials account not configured. Please set up account code 5010 (Direct Materials).',
  };
}

/**
 * Get expense account for SERVICE or OTHER purchase lines
 */
async function getExpenseAccount(
  line: {
    lineType: string;
  },
  defaultLaborAccount: { id: string } | null,
  defaultOverheadAccount: { id: string } | null,
  defaultMiscAccount: { id: string } | null,
  companyId: string
): Promise<{ success: boolean; accountId?: string; error?: string }> {
  if (line.lineType === 'MATERIAL') {
    return { success: false, error: 'Not an expense line' };
  }

  // For now, use defaults based on line type

  let defaultAccount: { id: string } | null = null;
  let accountType = '';

  if (line.lineType === 'SERVICE') {
    defaultAccount = defaultLaborAccount;
    accountType = 'Labor';
  } else if (line.lineType === 'OTHER') {
    // Prefer overhead, fallback to misc
    defaultAccount = defaultOverheadAccount || defaultMiscAccount;
    accountType = 'Overhead/Misc';
  }

  if (!defaultAccount) {
    const code = line.lineType === 'SERVICE' ? '5020' : '5030 or 5090';
    return {
      success: false,
      error: `Expense account not configured for ${line.lineType}. Please set up account code ${code} (${accountType}).`,
    };
  }

  const isLeaf = await isLeafAccount(defaultAccount.id);
  if (!isLeaf) {
    return {
      success: false,
      error: `Default ${accountType} account is not a leaf account. Please configure a leaf account.`,
    };
  }

  return { success: true, accountId: defaultAccount.id };
}

/**
 * Build voucher data from purchase
 */
export async function buildVoucherFromPurchase(
  purchaseId: string,
  companyId: string,
  userId: string
): Promise<{ success: boolean; data?: VoucherCreateData; error?: string }> {
  const purchase = await prisma.purchase.findUnique({
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
      project: true,
      supplierVendor: true,
    },
  });

  if (!purchase) {
    return { success: false, error: 'Purchase not found' };
  }

  if (purchase.voucherId) {
    return { success: false, error: 'Purchase already has a voucher' };
  }

  // Get default accounts
  const { apAccount, materialsAccount, laborAccount, overheadAccount, miscAccount } =
    await getDefaultAccounts(companyId);

  if (!apAccount) {
    return { success: false, error: 'Accounts Payable account (2010) not found' };
  }

  // Validate AP account is leaf
  const isApLeaf = await isLeafAccount(apAccount.id);
  if (!isApLeaf) {
    return { success: false, error: 'Accounts Payable account must be a leaf account' };
  }

  // Build voucher lines
  const lines: VoucherCreateData['lines'] = [];

  // Debit lines: accounts for each purchase line based on lineType
  for (let i = 0; i < purchase.lines.length; i++) {
    const purchaseLine = purchase.lines[i];
    const lineType = (purchaseLine.lineType || 'OTHER') as 'MATERIAL' | 'SERVICE' | 'OTHER';

    let debitAccountId: string;
    let description: string;

    // Determine account and description based on line type
    if (lineType === 'MATERIAL') {
      // Get material account
      const materialAccountResult = await getMaterialAccount(
        {
          lineType,
          stockItemId: purchaseLine.stockItemId,
        },
        materialsAccount,
        companyId
      );

      if (!materialAccountResult.success) {
        return {
          success: false,
          error: `Line ${i + 1} (MATERIAL): ${materialAccountResult.error}`,
        };
      }
      debitAccountId = materialAccountResult.accountId!;

      // Build description
      const itemName =
        purchaseLine.stockItem?.name ??
        'Unknown material';
      const unit =
        purchaseLine.stockItem?.unit ??
        purchaseLine.unit ??
        '';
      const qty = Number(purchaseLine.quantity ?? 0);
      description = qty > 0 ? `${itemName} - ${qty.toFixed(3)} ${unit}` : itemName;
    } else {
      // SERVICE or OTHER - use expense account
      const expenseAccountResult = await getExpenseAccount(
        {
          lineType,
        },
        laborAccount,
        overheadAccount,
        miscAccount,
        companyId
      );

      if (!expenseAccountResult.success) {
        return {
          success: false,
          error: `Line ${i + 1} (${lineType}): ${expenseAccountResult.error}`,
        };
      }
      debitAccountId = expenseAccountResult.accountId!;

      // Build description
      const desc = purchaseLine.description || (lineType === 'SERVICE' ? 'Service' : 'Other expense');
      description = desc;
    }

    // Calculate line amount after discount (proportional)
    const lineSubtotal = Number(purchaseLine.lineTotal ?? 0);
    if (lineSubtotal <= 0) {
      return {
        success: false,
        error: `Line ${i + 1}: Amount must be greater than 0`,
      };
    }

    const discountPercent = purchase.discountPercent ? Number(purchase.discountPercent) : 0;
    const lineDiscount = (lineSubtotal * discountPercent) / 100;
    const lineTotalAfterDiscount = lineSubtotal - lineDiscount;

    lines.push({
      accountId: debitAccountId,
      description,
      debit: new Prisma.Decimal(lineTotalAfterDiscount),
      credit: new Prisma.Decimal(0),
      projectId: purchase.projectId,
      vendorId: purchase.supplierVendorId,
    });
  }

  // Credit lines: payment account (if paid) and AP account (if due)
  if (Number(purchase.paidAmount) > 0) {
    if (!purchase.paymentAccountId) {
      return {
        success: false,
        error: 'Payment account is required when paid amount > 0',
      };
    }

    const paymentAccount = await prisma.account.findUnique({
      where: { id: purchase.paymentAccountId },
    });

    if (!paymentAccount || !paymentAccount.isActive) {
      return { success: false, error: 'Payment account not found or inactive' };
    }

    const isLeaf = await isLeafAccount(paymentAccount.id);
    if (!isLeaf) {
      return { success: false, error: 'Payment account must be a leaf account' };
    }

    lines.push({
      accountId: purchase.paymentAccountId,
      description: `Payment for purchase ${purchase.challanNo || purchase.id}`,
      debit: new Prisma.Decimal(0),
      credit: purchase.paidAmount,
      projectId: null,
      vendorId: null,
    });
  }

  if (Number(purchase.dueAmount) > 0) {
    lines.push({
      accountId: apAccount.id,
      description: `Accounts Payable - ${purchase.supplierVendor.name} - ${purchase.challanNo || purchase.id}`,
      debit: new Prisma.Decimal(0),
      credit: purchase.dueAmount,
      projectId: null,
      vendorId: purchase.supplierVendorId,
    });
  }

  // Verify balance
  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return {
      success: false,
      error: `Voucher is not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`,
    };
  }

  // Determine voucher type
  let voucherType: 'JOURNAL' | 'PAYMENT' | null = null;
  if (Number(purchase.paidAmount) > 0 && Number(purchase.dueAmount) === 0) {
    voucherType = 'PAYMENT';
  } else {
    voucherType = 'JOURNAL'; // Default for mixed or AP-only
  }

  const narration = `Purchase: ${purchase.challanNo || 'N/A'} - ${purchase.supplierVendor.name}${purchase.reference ? ` (${purchase.reference})` : ''}`;

  return {
    success: true,
    data: {
      companyId,
      projectId: purchase.projectId,
      date: purchase.date,
      narration,
      expenseType: 'PROJECT_EXPENSE',
      lines,
    },
  };
}

/**
 * Ensure purchase has a voucher (create if missing)
 */
export async function ensurePurchaseVoucher(
  purchaseId: string,
  companyId: string,
  userId: string
): Promise<{ success: boolean; voucherId?: string; error?: string }> {
  return await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      where: {
        id: purchaseId,
        companyId,
      },
    });

    if (!purchase) {
      return { success: false, error: 'Purchase not found' };
    }

    if (purchase.voucherId) {
      return { success: true, voucherId: purchase.voucherId };
    }

    // Build voucher data
    const voucherData = await buildVoucherFromPurchase(purchaseId, companyId, userId);
    if (!voucherData.success || !voucherData.data) {
      return { success: false, error: voucherData.error };
    }

    // Generate voucher number
    const voucherNo = await generateVoucherNumber(companyId, voucherData.data.date);

    // Create voucher
    const voucher = await tx.voucher.create({
      data: {
        companyId: voucherData.data.companyId,
        projectId: voucherData.data.projectId,
        voucherNo,
        date: voucherData.data.date,
        narration: voucherData.data.narration,
        expenseType: voucherData.data.expenseType,
        type: 'JOURNAL', // Default, can be overridden
        status: 'DRAFT',
        createdByUserId: userId,
        lines: {
          create: voucherData.data.lines.map((line) => ({
            companyId: voucherData.data!.companyId,
            accountId: line.accountId,
            description: line.description,
            debit: line.debit,
            credit: line.credit,
            projectId: line.projectId,
            vendorId: line.vendorId,
          })),
        },
      },
    });

    // Link purchase to voucher
    await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        voucherId: voucher.id,
        status: 'DRAFT', // Sync status
      },
    });

    return { success: true, voucherId: voucher.id };
  });
}

/**
 * Sync purchase status with voucher status
 */
export async function syncPurchaseStatusWithVoucher(
  voucherId: string,
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  const voucher = await prisma.voucher.findUnique({
    where: {
      id: voucherId,
      companyId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!voucher) {
    return { success: false, error: 'Voucher not found' };
  }

  // Find purchase linked to this voucher
  const purchase = await prisma.purchase.findFirst({
    where: {
      voucherId,
      companyId,
    },
  });

  if (!purchase) {
    // No purchase linked, nothing to sync
    return { success: true };
  }

  // Map voucher status to purchase status
  const purchaseStatusMap: Record<string, 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'REVERSED'> = {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    APPROVED: 'APPROVED',
    POSTED: 'POSTED',
    REVERSED: 'REVERSED',
  };

  const newPurchaseStatus = purchaseStatusMap[voucher.status];
  if (!newPurchaseStatus) {
    return { success: false, error: `Unknown voucher status: ${voucher.status}` };
  }

  // Update purchase status if different
  if (purchase.status !== newPurchaseStatus) {
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { status: newPurchaseStatus },
    });
  }

  return { success: true };
}

/**
 * Create inventory transactions for a posted purchase
 */
export async function createInventoryTxnsForPostedPurchase(
  purchaseId: string,
  companyId: string
): Promise<{ success: boolean; error?: string }> {
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
    return { success: false, error: 'Purchase not found' };
  }

  if (purchase.status !== 'POSTED') {
    return { success: false, error: 'Purchase must be POSTED to create stock movements' };
  }

  // Create stock movements for MATERIAL lines
  for (const line of purchase.lines) {
    // Only create movements for MATERIAL lines with stockItemId
    if (line.lineType !== 'MATERIAL' || !line.stockItemId) {
      continue;
    }

    // Create StockMovement
    await tx.stockMovement.create({
      data: {
        companyId,
        stockItemId: line.stockItemId,
        movementDate: purchase.date,
        type: 'IN',
        qty: line.quantity || new Prisma.Decimal(0),
        unitCost: line.unitRate || new Prisma.Decimal(0),
        referenceType: 'PURCHASE',
        referenceId: purchase.id,
        projectId: purchase.projectId,
        vendorId: purchase.supplierVendorId,
        createdById: '', // Will be set by adjustStock or workflow
        notes: `Purchase ${purchase.challanNo || purchase.id}`,
      },
    });

    // Update or create StockBalance
    const balance = await tx.stockBalance.findUnique({
      where: {
        companyId_stockItemId: {
          companyId,
          stockItemId: line.stockItemId,
        },
      },
    });

    if (balance) {
      // Update existing balance
      const newQty = balance.onHandQty.plus(line.quantity || 0);
      const newTotalCost = balance.avgCost.mul(balance.onHandQty).plus(
        Number(line.unitRate || 0) * Number(line.quantity || 0)
      );
      const newAvgCost = newQty.gt(0) ? newTotalCost.div(newQty) : new Prisma.Decimal(0);

      await tx.stockBalance.update({
        where: { id: balance.id },
        data: {
          onHandQty: newQty,
          avgCost: newAvgCost,
        },
      });
    } else {
      // Create new balance
      await tx.stockBalance.create({
        data: {
          companyId,
          stockItemId: line.stockItemId,
          onHandQty: line.quantity || new Prisma.Decimal(0),
          avgCost: line.unitRate || new Prisma.Decimal(0),
        },
      });
    }
  }

    return { success: true };
  });
}

/**
 * Create inventory reversal transactions for a reversed purchase
 */
export async function createInventoryReversalForPurchase(
  purchaseId: string,
  companyId: string
): Promise<{ success: boolean; error?: string }> {
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
    return { success: false, error: 'Purchase not found' };
  }

  if (purchase.status !== 'REVERSED') {
    return {
      success: false,
      error: 'Purchase must be REVERSED to create stock reversal movements',
    };
  }

  // Find original stock movements
  const originalMovements = await tx.stockMovement.findMany({
    where: {
      referenceType: 'PURCHASE',
      referenceId: purchase.id,
      companyId,
        type: 'IN',
    },
  });

  // Create reversal movements and update balances
  for (const originalMovement of originalMovements) {
    // Create reversal movement
    await tx.stockMovement.create({
      data: {
        companyId,
        stockItemId: originalMovement.stockItemId,
        movementDate: new Date(),
        type: 'ADJUST', // Or create a REVERSAL type if needed
        qty: originalMovement.qty.neg(), // Negative quantity
        unitCost: originalMovement.unitCost,
        referenceType: 'PURCHASE',
        referenceId: purchase.id,
        projectId: originalMovement.projectId,
        vendorId: originalMovement.vendorId,
        createdById: originalMovement.createdById,
        notes: `Reversal of purchase ${purchase.challanNo || purchase.id}`,
      },
    });

    // Update StockBalance
    const balance = await tx.stockBalance.findUnique({
      where: {
        companyId_stockItemId: {
          companyId,
          stockItemId: originalMovement.stockItemId,
        },
      },
    });

    if (balance) {
      const newQty = balance.onHandQty.minus(originalMovement.qty);
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: {
          onHandQty: newQty.gte(0) ? newQty : new Prisma.Decimal(0),
        },
      });
    }
  }

    return { success: true };
  });
}
