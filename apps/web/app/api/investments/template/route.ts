import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import * as XLSX from 'xlsx';

/**
 * GET /api/investments/template
 * Generate and download Excel template for investment import
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'projects', 'READ');

    const workbook = XLSX.utils.book_new();

    const headers = [
      'Project Name',
      'Date',
      'Amount',
      'Investor Name',
      'Received By',
      'Payment Method (CASH/BANK)',
      'Note',
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers]);

    worksheet['!cols'] = [
      { wch: 20 }, // Project Name
      { wch: 12 }, // Date
      { wch: 12 }, // Amount
      { wch: 18 }, // Investor Name
      { wch: 18 }, // Received By
      { wch: 22 }, // Payment Method (CASH/BANK)
      { wch: 20 }, // Note
    ];

    const exampleRow = [
      'Example Project',
      '2026-01-29',
      '1000000',
      'Owner',
      'Site Manager',
      'CASH',
      'Initial funding',
    ];
    XLSX.utils.sheet_add_aoa(worksheet, [exampleRow], { origin: -1 });

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Investments');

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="investment_import_template.xlsx"',
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
