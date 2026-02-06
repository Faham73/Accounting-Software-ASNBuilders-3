import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import * as XLSX from 'xlsx';

/**
 * GET /api/credit/template
 * Generate and download Excel template for credit import
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'READ');

    // Create workbook with header row
    const workbook = XLSX.utils.book_new();
    
    // Define headers
    const headers = [
      'Date',
      'Project Name',
      'Purpose (Details)',
      'Paid By',
      'Received By',
      'Cash/Check (Method)',
      'Amount',
      'Note (Done)',
    ];

    // Create worksheet with headers
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // Date
      { wch: 20 }, // Project Name
      { wch: 30 }, // Purpose
      { wch: 15 }, // Paid By
      { wch: 15 }, // Received By
      { wch: 18 }, // Payment Method
      { wch: 12 }, // Amount
      { wch: 15 }, // Note
    ];

    // Add example row (optional - can be removed)
    const exampleRow = [
      '2025-01-29',
      'Example Project',
      'Sample credit entry',
      'John Doe',
      'Jane Smith',
      'Cash',
      '10000',
      'Done',
    ];
    XLSX.utils.sheet_add_aoa(worksheet, [exampleRow], { origin: -1 });

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Credits');

    // Generate buffer
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="credit_import_template.xlsx"',
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(
      error instanceof Error ? error : new Error('Unknown error'),
      500
    );
  }
}
