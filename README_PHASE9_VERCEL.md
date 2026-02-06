# Phase 9: Vercel Deployment - Puppeteer Migration

## Changes Made

### 1. Replaced Playwright with Puppeteer + Sparticuz Chromium

**Removed:**
- `playwright` package
- `lib/pdf/generate.ts` (Playwright implementation)

**Added:**
- `puppeteer-core` package
- `@sparticuz/chromium` package (Vercel-compatible Chromium)
- New `lib/pdf/generate.ts` using Puppeteer

### 2. PDF Token Authentication

Created secure token-based authentication for print routes:

- **`lib/pdf/token.ts`**: Generates and verifies short-lived (5min) PDF access tokens
- **`lib/print/auth.ts`**: Authenticates print routes using either:
  1. PDF token (for server-side PDF generation)
  2. Normal session cookie (for browser access)

### 3. Updated PDF API Routes

All PDF API routes now:
- Use `export const runtime = "nodejs"` (required for Puppeteer)
- Use `export const dynamic = "force-dynamic"` (prevents caching)
- Generate PDF tokens and append to print URLs
- Use `generatePdfFromUrl` instead of `generatePDF`

**Updated routes:**
- `/api/pdf/voucher`
- `/api/pdf/project-statement`
- `/api/pdf/vendor-statement`

### 4. Updated Print Routes

All print routes now accept `pdfToken` query parameter:
- `/print/vouchers/[id]`
- `/print/projects/[id]/statement`
- `/print/vendors/[id]/statement`

Routes authenticate using `authenticateAndVerifyEntity()` which:
- Accepts PDF tokens for server-side access
- Falls back to normal auth for browser access
- Verifies entity belongs to user's company

## Installation

```bash
cd apps/web
npm install puppeteer-core @sparticuz/chromium
```

## Environment Variables

Ensure these are set in Vercel:

```env
JWT_SECRET=your-secret-key-here
APP_URL=https://your-app.vercel.app  # Optional, auto-detected on Vercel
```

Vercel automatically sets `VERCEL_URL` which is used as fallback.

## How It Works

1. **User clicks "Download PDF"** in dashboard
2. **PDF API route**:
   - Authenticates user (normal session)
   - Generates short-lived PDF token (5 minutes)
   - Constructs print URL with token: `/print/vouchers/123?pdfToken=...`
   - Launches Puppeteer with Sparticuz Chromium
   - Navigates to print URL
   - Generates PDF
   - Returns PDF to user

3. **Print route**:
   - Receives request with `pdfToken` query param
   - Validates token (or falls back to session cookie)
   - Renders print view
   - Puppeteer captures HTML and converts to PDF

## Security

- PDF tokens are short-lived (5 minutes)
- Tokens are signed with JWT_SECRET
- Tokens include entity type and ID for validation
- Print routes verify entity belongs to user's company
- Falls back to normal auth if token invalid/expired

## Testing

1. **Local testing:**
   ```bash
   npm run dev
   # Test PDF generation at http://localhost:3000/api/pdf/voucher?id=...
   ```

2. **Vercel deployment:**
   - Build should complete without Playwright errors
   - PDF endpoints should work in production
   - No browser installation needed (Sparticuz Chromium is bundled)

## Troubleshooting

### Build fails on Vercel
- Ensure `puppeteer-core` and `@sparticuz/chromium` are in `dependencies` (not devDependencies)
- Check that `runtime = "nodejs"` is set in all PDF routes

### PDF generation fails
- Check `APP_URL` or `VERCEL_URL` is set correctly
- Verify PDF token is being generated and appended to URL
- Check browser console for errors in print route

### Authentication errors
- Ensure `JWT_SECRET` is set in Vercel environment variables
- Verify PDF token expiration (5 minutes) is sufficient
- Check that print routes are accepting `pdfToken` parameter

## Migration Checklist

- ✅ Removed Playwright from package.json
- ✅ Added puppeteer-core and @sparticuz/chromium
- ✅ Updated lib/pdf/generate.ts
- ✅ Added runtime configs to all PDF routes
- ✅ Implemented PDF token authentication
- ✅ Updated all print routes to accept tokens
- ✅ Updated all PDF API routes to use new system
