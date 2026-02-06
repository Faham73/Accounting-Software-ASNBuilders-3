# Deploy to Vercel - Step by Step Guide

## ✅ Pre-Deployment Checklist

Before deploying, ensure:
- [x] All code changes are committed
- [x] Build passes locally (`npm run build --workspace=apps/web`)
- [x] Database is set up and accessible
- [x] Environment variables are ready

## Step 1: Commit and Push to GitHub

```bash
# Check what files changed
git status

# Add all changes
git add .

# Commit with a descriptive message
git commit -m "Prepare for Vercel deployment: add vercel-build script and update Prisma scripts"

# Push to GitHub (replace 'main' with your branch name if different)
git push origin main
```

## Step 2: Create Vercel Account & Project

1. **Go to Vercel**: https://vercel.com
2. **Sign up/Login**: Use GitHub account (recommended for easy integration)
3. **Click "Add New Project"** or **"Import Project"**
4. **Select your GitHub repository**: Choose `Accounting-Software-ASNBuilders-2-main` (or your repo name)

## Step 3: Configure Vercel Project Settings

### Root Directory
- **Leave empty** (Vercel will detect monorepo automatically)
- OR set to: `apps/web` if you want to be explicit

### Framework Preset
- **Auto-detected**: Next.js (should be detected automatically)

### Build & Development Settings

| Setting | Value |
|---------|-------|
| **Build Command** | `npm run vercel-build` |
| **Output Directory** | (leave empty - Next.js default) |
| **Install Command** | `npm install` (default) |
| **Development Command** | `npm run dev` (optional, for preview) |

### Environment Variables

Click **"Environment Variables"** and add:

#### Required Variables:

1. **DATABASE_URL**
   - **Value**: Your PostgreSQL connection string
   - **Format**: `postgresql://user:password@host:port/database`
   - **Example**: `postgresql://user:pass@db.xxxxx.vercel-storage.com:5432/dbname`
   - **Environments**: Production, Preview, Development (check all)

2. **JWT_SECRET**
   - **Value**: Generate a secure random string
   - **How to generate**:
     ```bash
     # On Mac/Linux:
     openssl rand -base64 32
     
     # On Windows PowerShell:
     [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
     ```
   - **Example**: `aBc123XyZ789...` (64+ characters)
   - **Environments**: Production, Preview, Development (check all)

#### Optional Variables (Auto-detected):

- **APP_URL** - Will auto-detect from `VERCEL_URL` if not set
- **VERCEL_URL** - Automatically set by Vercel (don't set manually)

## Step 4: Deploy

1. **Click "Deploy"** button
2. **Wait for build to complete** (usually 2-5 minutes)
3. **Watch the build logs** for:
   - ✅ `npm install` completes
   - ✅ `prisma generate` completes
   - ✅ `prisma migrate deploy` completes
   - ✅ `next build` completes

## Step 5: Verify Deployment

### Check Build Logs

Look for these success messages:
```
✓ Prisma schema loaded
✓ Generated Prisma Client
✓ Applied migration: xxxxxx
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
```

### Test Your Deployment

1. **Visit your app URL**: `https://your-project.vercel.app`
2. **Test login**: Try logging in (you'll need to bootstrap an admin user first)
3. **Check API routes**: Visit `/api/auth/me` (should return 401, which is correct)

## Step 6: Bootstrap Admin User (First Time Only)

After first deployment, you need to create an admin user:

### Option A: Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link to your project
vercel link

# Run bootstrap script (connects to production database)
vercel env pull .env.local
npm run bootstrap:admin --workspace=packages/db
```

### Option B: Using Database Directly

Connect to your production database and run:

```sql
-- Create admin user manually
-- (You'll need to hash the password first using bcrypt)
```

### Option C: Use API Bootstrap Endpoint

If you have `/api/auth/bootstrap` endpoint:
```bash
curl -X POST https://your-app.vercel.app/api/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password","name":"Admin"}'
```

## Troubleshooting

### Build Fails: "Prisma Client not found"

**Solution**: Check that `vercel-build` script runs `db:generate` before `build`

### Build Fails: "Migration failed"

**Solutions**:
- Verify `DATABASE_URL` is correct
- Check database is accessible from Vercel (not behind firewall)
- Ensure migrations exist in `packages/db/prisma/migrations/`

### Build Fails: "Cannot find module"

**Solution**: Ensure `npm install` runs from repo root (monorepo setup)

### Runtime Error: "Authentication required"

**This is normal** - API routes require authentication. Test with proper login.

### Database Connection Error

**Solutions**:
- Verify `DATABASE_URL` format is correct
- Check database allows connections from Vercel IPs
- For Vercel Postgres: Connection string is auto-provided
- For external DB: Ensure SSL is enabled if required

## Post-Deployment

### Set Up Custom Domain (Optional)

1. Go to **Project Settings → Domains**
2. Add your custom domain
3. Follow DNS configuration instructions

### Monitor Your Deployment

- **Logs**: View in Vercel Dashboard → Deployments → Click deployment → Logs
- **Analytics**: Enable in Project Settings → Analytics
- **Error Tracking**: Consider adding Sentry or similar

### Update Environment Variables

To update env vars:
1. Go to **Project Settings → Environment Variables**
2. Edit or add variables
3. **Redeploy** for changes to take effect

## Quick Reference

### Vercel Dashboard URLs

- **Projects**: https://vercel.com/dashboard
- **Your Project**: https://vercel.com/[your-username]/[project-name]
- **Deployments**: https://vercel.com/[your-username]/[project-name]/deployments

### Important Commands

```bash
# Local build test
npm run build --workspace=apps/web

# Local Prisma generate
npm run db:generate

# Local migration (dev only)
npm run db:migrate

# Production migration (runs automatically in Vercel)
npm run db:deploy
```

## Next Steps After Deployment

1. ✅ **Test the application** - Login, create data, verify features
2. ✅ **Set up monitoring** - Error tracking, analytics
3. ✅ **Configure backups** - Database backups
4. ✅ **Set up CI/CD** - Automatic deployments on push
5. ✅ **Implement file storage** - Replace local file uploads with cloud storage

---

**You're ready to deploy!** 🚀

Follow steps 1-4 above, and your app will be live on Vercel.
