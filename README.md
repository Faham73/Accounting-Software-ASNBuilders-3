# Accounting Software

Construction accounting web application built with Next.js and PostgreSQL.

## First Run (Phase 0)

### Prerequisites

- **Node.js**: v18+ (or v20+ recommended)
- **PostgreSQL**: v14+ (or use Docker)
- **npm**: v9+ (comes with Node.js)

### Setup Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your PostgreSQL credentials.

3. **Start PostgreSQL (Docker):**
   ```bash
   npm run db:up
   ```

4. **Generate Prisma Client:**
   ```bash
   npm run db:generate
   ```

5. **Run database migration:**
   ```bash
   npm run db:migrate
   ```

6. **Seed the database (demo data for all tables):**
   ```bash
   npm run db:seed
   ```
   Or from `packages/db`: `npx prisma db seed` (uses `prisma.seed` in package.json).  
   Seed is idempotent; demo users use password `password123`.  
   **Stock**: By default, stock items/movements/balances are **not** seeded. To include them, run `SEED_STOCK=true npm run db:seed`.  
   **Do not run seed in production.** The script refuses to run when `NODE_ENV=production` unless you set `SEED_ALLOW_PRODUCTION=1` (use with caution).

7. **Start development server:**
   ```bash
   npm run dev
   ```

### Default Admin Login

- **Email**: `admin@example.com`
- **Password**: `123456`

### Smoke Test

1. Navigate to `http://localhost:3000/login`
2. Login with admin credentials above
3. Verify redirect to `/dashboard` showing user email, role, and company ID
4. Click "Logout" button
5. Verify redirect to `/login`
6. Try accessing `/dashboard` directly → should redirect to `/login`

---

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with comprehensive demo data (companies, users, projects, vouchers, etc.). **Do not run in production**; blocked when `NODE_ENV=production` unless `SEED_ALLOW_PRODUCTION=1`.
- `npm run db:up` - Start PostgreSQL with Docker
- `npm run db:down` - Stop PostgreSQL Docker container
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run reset:stock` - **Dev-only.** Delete all stock data (StockMovement, InventoryTxn, ProjectStockSetting, StockBalance, StockItem; clears `stockItemId` on purchase lines). Requires `NODE_ENV=development` or `ALLOW_RESET=YES`.

**Full DB reset (wipe everything):** From `packages/db`, run `npx prisma migrate reset --force`. Use with caution; not run by default.
