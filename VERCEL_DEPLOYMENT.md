# Vercel Deployment Guide

## ✅ Pre-Deployment Checklist Completed

### 1. Production Seed Protection ✅
- `packages/db/prisma/seed.ts` blocks execution when `NODE_ENV=production` unless `SEED_ALLOW_PRODUCTION=1`
- No build scripts or postinstall hooks run `prisma db seed`
- Seed is safe for production

### 2. Vercel Build Script ✅
- Added `vercel-build` script to `apps/web/package.json`
- Script runs: `prisma generate` → `prisma migrate deploy` → `next build`
- Uses correct schema path: `../../packages/db/prisma/schema.prisma`

### 3. Prisma Client Generation ✅
- Prisma Client is generated from `packages/db/prisma/schema.prisma`
- App imports from `@accounting/db` package (monorepo setup)
- Client generation happens during build via `vercel-build` script

### 4. Environment Variables ✅
- Created `.env.example` (root) and `apps/web/.env.example`
- `.env` and `.env.local` are in `.gitignore`
- Required variables documented below

### 5. Database Migrations ✅
- Migrations directory exists: `packages/db/prisma/migrations/`
- `.gitignore` updated to allow migrations (removed incorrect ignore rule)
- Production uses `prisma migrate deploy` (not `migrate dev`)

### 6. Serverless Compatibility ✅
- File upload routes (`/api/uploads`, `/api/projects/[id]/documents`) block in production
- Returns 503 error with message about cloud storage requirement
- No filesystem writes at runtime (serverless-safe)

### 7. Build Verification ✅
- Production build completes successfully
- TypeScript compilation passes
- All routes build correctly
- Authentication errors during build are expected (API routes require auth)

## Vercel Configuration

### Root Directory
Set **Root Directory** in Vercel project settings to: `apps/web`

### Build Command
Vercel will automatically use the `vercel-build` script from `apps/web/package.json`:
```
npx prisma generate --schema=../../packages/db/prisma/schema.prisma && npx prisma migrate deploy --schema=../../packages/db/prisma/schema.prisma && next build
```

### Install Command
Vercel will run `npm install` from the repository root (monorepo setup).

### Output Directory
Leave empty (default: `.next`)

## Required Environment Variables

Set these in **Vercel Dashboard → Project Settings → Environment Variables**:

### Required
- `DATABASE_URL` - PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - Use Vercel Postgres or external provider (e.g., Neon, Supabase)

- `JWT_SECRET` - Secret key for JWT token signing
  - Generate with: `openssl rand -base64 32`
  - **Must be a strong random string in production**

### Optional (Auto-detected)
- `APP_URL` - Application URL (auto-detected from `VERCEL_URL` if not set)
- `NEXT_PUBLIC_APP_URL` - Public app URL (for client-side)
- `VERCEL_URL` - Automatically set by Vercel

### Optional (Advanced)
- `DIRECT_URL` - Direct database URL (if using connection pooling)
- `NEXT_PUBLIC_BASE_PATH` - Base path if deploying under subpath
- `CHROME_EXECUTABLE_PATH` - Not needed on Vercel (uses Sparticuz Chromium)

## Database Setup

### 1. Create Database
- Use Vercel Postgres, Neon, Supabase, or any PostgreSQL provider
- Note the connection string

### 2. Run Migrations
Migrations will run automatically during build via `vercel-build` script.

**Manual migration (if needed):**
```bash
cd packages/db
npx prisma migrate deploy --schema=prisma/schema.prisma
```

### 3. Bootstrap Admin User (Optional)
After first deployment, you can bootstrap an admin user:
```bash
npm run bootstrap:admin --workspace=packages/db
```

## Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Connect Repository in Vercel**
   - Go to Vercel Dashboard
   - Import your GitHub repository
   - Set Root Directory: `apps/web`
   - Vercel will auto-detect Next.js

3. **Configure Environment Variables**
   - Add all required variables (see above)
   - Set `JWT_SECRET` to a strong random value
   - Set `DATABASE_URL` to your production database

4. **Deploy**
   - Click "Deploy"
   - Vercel will run `npm install` → `vercel-build` → deploy

5. **Verify Deployment**
   - Check build logs for successful Prisma client generation
   - Check build logs for successful migration deployment
   - Test the deployed app

## Post-Deployment

### File Uploads
File upload routes (`/api/uploads`, `/api/projects/[id]/documents`) are disabled in production. To enable:

1. **Option A: Use Vercel Blob Storage**
   ```bash
   npm install @vercel/blob
   ```
   Update upload routes to use Vercel Blob API

2. **Option B: Use AWS S3 / Cloud Storage**
   - Install AWS SDK or cloud storage client
   - Update upload routes to upload to cloud storage
   - Update file URLs to point to cloud storage

### Monitoring
- Check Vercel function logs for errors
- Monitor database connection pool usage
- Set up error tracking (e.g., Sentry)

## Troubleshooting

### Build Fails: "Prisma Client not found"
- Ensure `vercel-build` script runs `prisma generate` before `next build`
- Check that schema path is correct: `../../packages/db/prisma/schema.prisma`

### Build Fails: "Migration failed"
- Check `DATABASE_URL` is set correctly
- Ensure database is accessible from Vercel
- Check migration files exist in `packages/db/prisma/migrations/`

### Runtime Error: "Authentication required"
- This is expected for API routes during build
- Routes are correctly marked as dynamic (`ƒ`)

### File Uploads Return 503
- Expected behavior: file uploads are disabled in production
- Implement cloud storage (see Post-Deployment section)

## Files Changed for Deployment

1. `.gitignore` - Removed incorrect migrations ignore, added Prisma client ignore
2. `apps/web/package.json` - Added `vercel-build` script
3. `.env.example` - Created with all required variables
4. `apps/web/.env.example` - Created app-specific variables
5. `apps/web/app/api/uploads/route.ts` - Added production check
6. `apps/web/app/api/projects/[id]/documents/route.ts` - Added production check

## Pre-Push Commands

Before pushing to GitHub, run:

```bash
# Type check
npm run lint --workspace=apps/web

# Build test
npm run build --workspace=apps/web
```

If both pass, you're ready to push and deploy!
