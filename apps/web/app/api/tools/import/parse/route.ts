import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import * as XLSX from 'xlsx';
import { parseFileData, parseAndValidateVouchers, ImportOptions } from '@/lib/importTools';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/tools/import/parse
 * Parse uploaded CSV/XLSX file and return preview with validation
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mappingJson = formData.get('mapping') as string | null;
    const optionsJson = formData.get('options') as string | null;

    if (!file) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No file provided',
        },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          ok: false,
          error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 }
      );
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isXLSX = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isCSV && !isXLSX) {
      return NextResponse.json(
        {
          ok: false,
          error: 'File must be CSV or XLSX format',
        },
        { status: 400 }
      );
    }

    // Parse mapping and options (optional for initial parse)
    let mapping: Record<string, string | null> = {};
    let options: ImportOptions | null = null;

    try {
      if (mappingJson) {
        mapping = JSON.parse(mappingJson);
      }
      if (optionsJson) {
        options = JSON.parse(optionsJson);
      }
    } catch (e) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid mapping or options JSON',
        },
        { status: 400 }
      );
    }

    // Read file
    const buffer = Buffer.from(await file.arrayBuffer());
    let rows: any[][] = [];
    let headers: string[] = [];

    if (isCSV) {
      // Parse CSV - handle quoted fields properly
      const csvText = buffer.toString('utf-8');
      const lines: string[] = [];
      let currentLine = '';
      let inQuotes = false;

      for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            currentLine += '"';
            i++; // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
            currentLine += char;
          }
        } else if (char === '\n' && !inQuotes) {
          // End of line
          lines.push(currentLine);
          currentLine = '';
        } else {
          currentLine += char;
        }
      }

      // Add last line if exists
      if (currentLine.trim()) {
        lines.push(currentLine);
      }

      if (lines.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'CSV file is empty',
          },
          { status: 400 }
        );
      }

      // Parse header
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      headers = parseCSVLine(lines[0]).map((h) => h.replace(/^"|"$/g, ''));

      // Parse rows
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]).map((v) => v.replace(/^"|"$/g, ''));
        if (values.some((v) => v)) {
          // Only add non-empty rows
          rows.push(values);
        }
      }
    } else {
      // Parse XLSX
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

      if (data.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Excel file is empty',
          },
          { status: 400 }
        );
      }

      // First row is headers
      headers = data[0].map((h) => String(h || '').trim());
      
      // Rest are data rows
      rows = data.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== ''));
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No data rows found in file',
        },
        { status: 400 }
      );
    }

    // If no options provided, just return headers (initial parse)
    if (!options) {
      return NextResponse.json({
        ok: true,
        data: {
          headers,
          totalRows: rows.length,
        },
      });
    }

    // Validate required options
    if (!options.dateColumn || !options.accountColumn || !options.debitColumn || !options.creditColumn) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing required mapping: date, account, debit, and credit columns are required',
        },
        { status: 400 }
      );
    }

    // Parse rows into structured format
    const parsedRows = parseFileData(rows, headers);

    // Validate and group vouchers
    const validation = await parseAndValidateVouchers(parsedRows, options, auth.companyId);

    // Return preview (first 50 rows worth of vouchers)
    const previewVouchers = validation.vouchers.slice(0, 50);

    return NextResponse.json({
      ok: true,
      data: {
        headers,
        totalRows: validation.totalRows,
        totalVouchers: validation.totalVouchers,
        vouchers: previewVouchers,
        errors: validation.errors,
        warnings: validation.warnings,
        unresolvedAccounts: validation.unresolvedAccounts,
        hasMore: validation.vouchers.length > 50,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}
