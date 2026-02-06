import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';

interface ExcelRow {
  date?: string | number | Date;
  projectName?: string;
  purpose?: string;
  paidBy?: string;
  receivedBy?: string;
  paymentMethod?: string;
  amount?: string | number;
  note?: string;
  [key: string]: any; // For other columns
}

interface ImportError {
  row: number;
  message: string;
}

interface ImportResult {
  inserted: number;
  failed: number;
  errors: ImportError[];
}

/**
 * Normalize header names to match expected field names
 */
function normalizeHeader(header: string): string {
  const normalized = header.trim().toLowerCase();
  
  // Map various header formats to internal field names
  const headerMap: Record<string, string> = {
    'date': 'date',
    'project name': 'projectName',
    'project': 'projectName',
    'purpose (details)': 'purpose',
    'purpose': 'purpose',
    'details': 'purpose',
    'paid by': 'paidBy',
    'paidby': 'paidBy',
    'received by': 'receivedBy',
    'receivedby': 'receivedBy',
    'cash/check (method)': 'paymentMethod',
    'cash/check': 'paymentMethod',
    'payment method': 'paymentMethod',
    'method': 'paymentMethod',
    'amount': 'amount',
    'note (done)': 'note',
    'note': 'note',
    'done': 'note',
  };

  return headerMap[normalized] || normalized;
}

/**
 * Parse date from Excel (handles serial numbers and text)
 */
function parseDate(value: any): Date | null {
  if (!value) return null;

  // If it's already a Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // If it's an Excel serial number (number between 1 and 100000)
  if (typeof value === 'number' && value > 1 && value < 100000) {
    // Excel epoch starts from 1900-01-01, but Excel incorrectly treats 1900 as a leap year
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  // If it's a string, try to parse it
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Try various date formats
    const formats = [
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/, // dd-mm-yyyy or dd/mm/yyyy
      /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/, // yyyy-mm-dd or yyyy/mm/dd
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})/, // dd-mm-yy or dd/mm/yy
    ];

    for (const format of formats) {
      const match = trimmed.match(format);
      if (match) {
        let day: number, month: number, year: number;
        
        if (match[0].includes('-') || match[0].includes('/')) {
          if (match[1].length === 4) {
            // yyyy-mm-dd format
            year = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            day = parseInt(match[3]);
          } else {
            // dd-mm-yyyy or dd-mm-yy format
            day = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            year = parseInt(match[3]);
            if (year < 100) {
              year += year < 50 ? 2000 : 1900;
            }
          }
          
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    }

    // Try standard Date parsing as fallback
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

/**
 * Parse amount from Excel
 */
function parseAmount(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    // Remove currency symbols, commas, spaces
    const cleaned = value.replace(/[৳$,\s]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return !isNaN(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

/**
 * Resolve project by name
 */
async function resolveProject(
  companyId: string,
  projectName: string
): Promise<{ id: string | null; name: string }> {
  const normalized = projectName.trim();
  
  // Check for company-level credits
  const companyLevelNames = [
    'all project',
    'all projects',
    'company (all projects)',
    'company',
    'all',
  ];
  
  if (companyLevelNames.includes(normalized.toLowerCase())) {
    return { id: null, name: 'Company (All Projects)' };
  }

  // Try exact match (case-insensitive)
  let project = await prisma.project.findFirst({
    where: {
      companyId,
      name: {
        equals: normalized,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (project) {
    return { id: project.id, name: project.name };
  }

  // Try with trimmed spaces (handle double spaces)
  const trimmed = normalized.replace(/\s+/g, ' ').trim();
  project = await prisma.project.findFirst({
    where: {
      companyId,
      name: {
        equals: trimmed,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (project) {
    return { id: project.id, name: project.name };
  }

  return { id: null, name: normalized };
}

/**
 * Validate payment method
 */
function validatePaymentMethod(method: string): string | null {
  const normalized = method.trim();
  const validMethods = ['Cash', 'Check', 'Bank Transfer', 'Bkash', 'Other'];
  
  // Case-insensitive match
  const matched = validMethods.find(
    (m) => m.toLowerCase() === normalized.toLowerCase()
  );
  
  return matched || null;
}

/**
 * POST /api/credit/import
 * Import credits from Excel file
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const stopOnError = formData.get('stopOnError') === 'true';

    if (!file) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No file provided',
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (
      !file.name.endsWith('.xlsx') &&
      !file.name.endsWith('.xls') &&
      file.type !==
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
      file.type !== 'application/vnd.ms-excel'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)',
        },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    if (!worksheet) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Excel file is empty or invalid',
        },
        { status: 400 }
      );
    }

    // Convert to JSON with header row
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
      defval: '',
      raw: false,
    }) as ExcelRow[];

    if (rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Excel file contains no data rows',
        },
        { status: 400 }
      );
    }

    // Process rows (XLSX.utils.sheet_to_json already uses first row as headers)
    const result: ImportResult = {
      inserted: 0,
      failed: 0,
      errors: [],
    };

    const creditsToInsert: Array<{
      companyId: string;
      projectId: string | null;
      projectSnapshotName: string;
      date: Date;
      purpose: string;
      paidBy: string;
      receivedBy: string;
      paymentMethod: string;
      paymentRef: string | null;
      amount: Prisma.Decimal;
      note: string;
    }> = [];

    // Process each row (skip header row if it's in the data)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because Excel is 1-indexed and we have header

      // Normalize row keys
      const normalizedRow: ExcelRow = {};
      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = normalizeHeader(key);
        normalizedRow[normalizedKey] = value;
      }

      // Validate required fields
      const errors: string[] = [];

      // Date
      const date = parseDate(normalizedRow.date);
      if (!date) {
        errors.push('Date is required and must be valid');
      }

      // Project Name
      const projectName = normalizedRow.projectName?.toString().trim() || '';
      if (!projectName) {
        errors.push('Project Name is required');
      }

      // Purpose
      const purpose = normalizedRow.purpose?.toString().trim() || '';
      if (!purpose) {
        errors.push('Purpose is required');
      }

      // Paid By
      const paidBy = normalizedRow.paidBy?.toString().trim() || '';
      if (!paidBy) {
        errors.push('Paid By is required');
      }

      // Received By
      const receivedBy = normalizedRow.receivedBy?.toString().trim() || '';
      if (!receivedBy) {
        errors.push('Received By is required');
      }

      // Payment Method
      const paymentMethodRaw = normalizedRow.paymentMethod?.toString().trim() || '';
      const paymentMethod = validatePaymentMethod(paymentMethodRaw);
      if (!paymentMethod) {
        errors.push(
          `Payment Method must be one of: ${['Cash', 'Check', 'Bank Transfer', 'Bkash', 'Other'].join(', ')}`
        );
      }

      // Amount
      const amount = parseAmount(normalizedRow.amount);
      if (!amount) {
        errors.push('Amount is required and must be a positive number');
      }

      // Note (optional, default to "Done")
      const note = normalizedRow.note?.toString().trim() || 'Done';

      // If there are validation errors, record them
      if (errors.length > 0) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          message: errors.join('; '),
        });

        if (stopOnError) {
          return NextResponse.json(
            {
              ok: false,
              error: `Import stopped due to error in row ${rowNumber}`,
              result,
            },
            { status: 400 }
          );
        }
        continue;
      }

      // Resolve project
      const project = await resolveProject(auth.companyId, projectName);
      if (!project.id && project.name !== 'Company (All Projects)') {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          message: `Project not found: ${projectName}`,
        });

        if (stopOnError) {
          return NextResponse.json(
            {
              ok: false,
              error: `Import stopped due to error in row ${rowNumber}`,
              result,
            },
            { status: 400 }
          );
        }
        continue;
      }

      // Add to insert list
      creditsToInsert.push({
        companyId: auth.companyId,
        projectId: project.id,
        projectSnapshotName: project.name,
        date: date!,
        purpose,
        paidBy,
        receivedBy,
        paymentMethod: paymentMethod!,
        paymentRef: null, // Payment ref not in Excel template
        amount: new Prisma.Decimal(amount!),
        note,
      });
    }

    // Insert credits in transaction
    if (creditsToInsert.length > 0) {
      try {
        await prisma.$transaction(async (tx) => {
          for (const creditData of creditsToInsert) {
            const credit = await tx.credit.create({
              data: creditData,
            });

            // Create audit log
            await createAuditLog({
              companyId: auth.companyId,
              actorUserId: auth.userId,
              entityType: 'Credit',
              entityId: credit.id,
              action: 'CREATE',
              after: credit,
              request,
            });
          }
        });

        result.inserted = creditsToInsert.length;
      } catch (error) {
        result.failed += creditsToInsert.length;
        result.errors.push({
          row: 0,
          message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });

        if (stopOnError) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Import failed due to database error',
              result,
            },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      data: result,
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
