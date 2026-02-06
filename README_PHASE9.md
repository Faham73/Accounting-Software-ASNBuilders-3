# Phase 9: Printing & Documenting - Implementation Guide

## Overview

Phase 9 implements printable voucher formats and PDF exports for vouchers, project statements, and vendor statements using Playwright for PDF generation.

## Installation

### 1. Install Playwright

```bash
cd apps/web
npm install playwright
npx playwright install chromium
```

The `playwright` package is already added to `package.json`. After installation, run:

```bash
npx playwright install chromium
```

This installs the Chromium browser needed for PDF generation.

## Features Implemented

### 1. Printable Voucher Format
- **Route**: `/print/vouchers/[id]`
- Clean A4 print view with company header
- Includes voucher details, lines, totals, and signatures
- Accessible from voucher detail page via "Print" button

### 2. Project Statement PDF Export
- **Print Route**: `/print/projects/[id]/statement?from=...&to=...`
- **PDF API**: `/api/pdf/project-statement?id=...&from=...&to=...`
- Includes project info, date range, income/expense totals, and detailed transaction listing
- Accessible from project ledger page

### 3. Vendor Statement PDF Export
- **Print Route**: `/print/vendors/[id]/statement?from=...&to=...`
- **PDF API**: `/api/pdf/vendor-statement?id=...&from=...&to=...`
- Includes vendor info, opening/closing balances, and transaction details
- Accessible from vendor ledger page

## File Structure

```
apps/web/
├── app/
│   ├── print/
│   │   ├── vouchers/[id]/page.tsx          # Printable voucher view
│   │   ├── projects/[id]/statement/page.tsx # Printable project statement
│   │   └── vendors/[id]/statement/page.tsx  # Printable vendor statement
│   └── api/
│       └── pdf/
│           ├── voucher/route.ts            # Voucher PDF API
│           ├── project-statement/route.ts   # Project statement PDF API
│           └── vendor-statement/route.ts    # Vendor statement PDF API
├── lib/
│   ├── print/
│   │   ├── format.ts                       # Formatting utilities
│   │   ├── range.ts                        # Date range utilities
│   │   ├── getStyles.ts                    # Print CSS styles
│   │   └── styles.css                      # Print stylesheet
│   └── pdf/
│       └── generate.ts                     # Playwright PDF generation
```

## Environment Variables

Add to your `.env` file:

```env
# Base URL for PDF generation (required for server-side PDF generation)
APP_URL=http://localhost:3000  # Development
# APP_URL=https://yourdomain.com  # Production
```

## Usage

### Voucher Printing/PDF

1. Navigate to voucher detail page: `/dashboard/vouchers/[id]`
2. Click "Print" to open print view in new tab
3. Click "Download PDF" to download PDF file

### Project Statement

1. Navigate to project ledger: `/dashboard/projects/[id]/ledger`
2. Set date filters (optional, defaults to current month)
3. Click "Print Statement" to open print view
4. Click "Download PDF" to download PDF

### Vendor Statement

1. Navigate to vendor ledger: `/dashboard/vendors/[id]/ledger`
2. Set date range (defaults to current month)
3. Click "Print Statement" to open print view
4. Click "Download PDF" to download PDF

## Important Notes

### Only POSTED Vouchers Count

All statements and exports only include vouchers with status `POSTED` or `REVERSED` (as per Phase 8 implementation). This ensures financial accuracy.

### PDF Generation

- PDFs are generated server-side using Playwright
- The browser instance is reused for performance (singleton pattern)
- PDFs match the print view exactly
- A4 format with 1.5cm margins

### Access Control

All print routes and PDF APIs require authentication and proper permissions:
- Vouchers: `vouchers:READ` permission
- Projects: `projects:READ` permission
- Vendors: `vouchers:READ` permission (vendor data is part of vouchers)

## Troubleshooting

### Playwright Installation Issues

If Playwright fails to install on your system:

1. **Linux**: May need additional dependencies:
   ```bash
   sudo apt-get install libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
   ```

2. **Docker**: Use a base image with browser dependencies:
   ```dockerfile
   FROM mcr.microsoft.com/playwright:v1.40.0-focal
   ```

### PDF Generation Fails

1. Check `APP_URL` environment variable is set correctly
2. Ensure Playwright Chromium is installed: `npx playwright install chromium`
3. Check server logs for errors
4. Verify the print route is accessible (test in browser first)

### Production Deployment

For production:
1. Set `APP_URL` to your production domain
2. Ensure Playwright is installed in production environment
3. Consider using a headless browser service if Playwright is not available
4. Alternative: Use `@react-pdf/renderer` as fallback (not implemented, but can be added)

## Testing

1. **Voucher Print**: Create a posted voucher and test print/PDF
2. **Project Statement**: Create project transactions and verify totals match on-screen
3. **Vendor Statement**: Create vendor transactions and verify balances are correct
4. **Date Ranges**: Test with different date ranges
5. **Permissions**: Verify unauthorized users cannot access print routes

## Future Enhancements

- Add email functionality to send PDFs
- Add batch PDF generation
- Add custom company logo/header
- Add more formatting options
- Add print preview before PDF generation
