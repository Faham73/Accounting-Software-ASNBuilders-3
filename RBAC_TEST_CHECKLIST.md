# RBAC Test Checklist

## Setup Test Users

Before testing, create users with different roles. You can use Prisma Studio or direct SQL:

```sql
-- Assuming you have a company ID (get it from the default company)
-- Replace COMPANY_ID with actual company ID from your database

-- Create ACCOUNTANT user
INSERT INTO users (id, email, name, password_hash, role, company_id, is_active, created_at)
VALUES ('accountant_001', 'accountant@example.com', 'Accountant User', '$2b$10$...', 'ACCOUNTANT', 'COMPANY_ID', true, NOW());
-- Password: 123456 (hash with bcrypt)

-- Create DATA_ENTRY user
INSERT INTO users (id, email, name, password_hash, role, company_id, is_active, created_at)
VALUES ('data_entry_001', 'dataentry@example.com', 'Data Entry User', '$2b$10$...', 'DATA_ENTRY', 'COMPANY_ID', true, NOW());

-- Create VIEWER user
INSERT INTO users (id, email, name, password_hash, role, company_id, is_active, created_at)
VALUES ('viewer_001', 'viewer@example.com', 'Viewer User', '$2b$10$...', 'VIEWER', 'COMPANY_ID', true, NOW());

-- Create ENGINEER user
INSERT INTO users (id, email, name, password_hash, role, company_id, is_active, created_at)
VALUES ('engineer_001', 'engineer@example.com', 'Engineer User', '$2b$10$...', 'ENGINEER', 'COMPANY_ID', true, true, NOW());
```

**All test users password: `123456`** (same as admin)

---

## Test Checklist by Role

### ✅ ADMIN Role (admin@example.com / 123456)

#### API Routes:
- [ ] **POST /api/auth/login** → Should succeed (200, get token)
- [ ] **GET /api/auth/me** → Should succeed (200, returns user data)
- [ ] **POST /api/auth/logout** → Should succeed (200)
- [ ] **POST /api/auth/logout** (after logout, no token) → Should fail (401)

#### Dashboard Pages:
- [ ] **GET /dashboard** → Should show dashboard with ALL navigation links
- [ ] **GET /dashboard/companies** → Should access (Admin only)
- [ ] **GET /dashboard/projects** → Should access
- [ ] **GET /dashboard/vendors** → Should access
- [ ] **GET /dashboard/cost-heads** → Should access
- [ ] **GET /dashboard/payment-methods** → Should access

#### Navigation:
- [ ] Dashboard shows: Companies, Projects, Vendors, Cost Heads, Payment Methods
- [ ] All links show "(Can Edit)" or appropriate indicators

---

### ✅ ACCOUNTANT Role (accountant@example.com / 123456)

#### API Routes:
- [ ] **POST /api/auth/login** → Should succeed (200, get token)
- [ ] **GET /api/auth/me** → Should succeed (200, returns user data)
- [ ] **POST /api/auth/logout** → Should succeed (200)

#### Dashboard Pages:
- [ ] **GET /dashboard** → Should show dashboard WITHOUT Companies link
- [ ] **GET /dashboard/companies** → Should redirect to /forbidden (403)
- [ ] **GET /dashboard/projects** → Should access
- [ ] **GET /dashboard/vendors** → Should access
- [ ] **GET /dashboard/cost-heads** → Should access
- [ ] **GET /dashboard/payment-methods** → Should access

#### Navigation:
- [ ] Dashboard shows: Projects, Vendors, Cost Heads, Payment Methods (NO Companies)
- [ ] All visible links show "(Can Edit)" indicator

---

### ✅ DATA_ENTRY Role (dataentry@example.com / 123456)

#### API Routes:
- [ ] **POST /api/auth/login** → Should succeed (200, get token)
- [ ] **GET /api/auth/me** → Should succeed (200, returns user data)
- [ ] **POST /api/auth/logout** → Should succeed (200)

#### Dashboard Pages:
- [ ] **GET /dashboard** → Should show dashboard WITHOUT Companies link
- [ ] **GET /dashboard/companies** → Should redirect to /forbidden (403)
- [ ] **GET /dashboard/projects** → Should access (read-only)
- [ ] **GET /dashboard/vendors** → Should access (read-only)
- [ ] **GET /dashboard/cost-heads** → Should access (read-only)
- [ ] **GET /dashboard/payment-methods** → Should access (read-only)

#### Navigation:
- [ ] Dashboard shows: Projects, Vendors, Cost Heads, Payment Methods (NO Companies)
- [ ] No links show "(Can Edit)" indicator (read-only user)

---

### ✅ VIEWER Role (viewer@example.com / 123456)

#### API Routes:
- [ ] **POST /api/auth/login** → Should succeed (200, get token)
- [ ] **GET /api/auth/me** → Should succeed (200, returns user data)
- [ ] **POST /api/auth/logout** → Should succeed (200)

#### Dashboard Pages:
- [ ] **GET /dashboard** → Should show dashboard WITHOUT Companies link
- [ ] **GET /dashboard/companies** → Should redirect to /forbidden (403)
- [ ] **GET /dashboard/projects** → Should access (read-only)
- [ ] **GET /dashboard/vendors** → Should access (read-only)
- [ ] **GET /dashboard/cost-heads** → Should access (read-only)
- [ ] **GET /dashboard/payment-methods** → Should access (read-only)

#### Navigation:
- [ ] Dashboard shows: Projects, Vendors, Cost Heads, Payment Methods (NO Companies)
- [ ] No links show "(Can Edit)" indicator (read-only user)

---

### ✅ ENGINEER Role (engineer@example.com / 123456)

#### API Routes:
- [ ] **POST /api/auth/login** → Should succeed (200, get token)
- [ ] **GET /api/auth/me** → Should succeed (200, returns user data)
- [ ] **POST /api/auth/logout** → Should succeed (200)

#### Dashboard Pages:
- [ ] **GET /dashboard** → Should show dashboard WITHOUT Companies link
- [ ] **GET /dashboard/companies** → Should redirect to /forbidden (403)
- [ ] **GET /dashboard/projects** → Should access (read-only)
- [ ] **GET /dashboard/vendors** → Should access (read-only)
- [ ] **GET /dashboard/cost-heads** → Should access (read-only)
- [ ] **GET /dashboard/payment-methods** → Should access (read-only)

#### Navigation:
- [ ] Dashboard shows: Projects, Vendors, Cost Heads, Payment Methods (NO Companies)
- [ ] No links show "(Can Edit)" indicator (read-only user)

---

## Common Tests (All Roles)

### Unauthorized Access:
- [ ] **GET /api/auth/me** (no token) → Should fail (401 Unauthorized)
- [ ] **POST /api/auth/logout** (no token) → Should fail (401 Unauthorized)
- [ ] **GET /dashboard** (no token) → Should redirect to /login

### Forbidden Page:
- [ ] **GET /forbidden** → Should show "Access Forbidden" page
- [ ] **GET /forbidden** → Should have "Back to Dashboard" link

---

## Quick Test Script

### Test as ADMIN:
1. Login: `admin@example.com` / `123456`
2. Verify dashboard shows all links (including Companies)
3. Click each link - all should work
4. Try direct URL: `/dashboard/companies` - should work

### Test as ACCOUNTANT:
1. Login: `accountant@example.com` / `123456`
2. Verify dashboard does NOT show Companies link
3. Try direct URL: `/dashboard/companies` - should redirect to /forbidden
4. Verify all other links work
5. All master data links should show "(Can Edit)"

### Test as DATA_ENTRY:
1. Login: `dataentry@example.com` / `123456`
2. Verify dashboard does NOT show Companies link
3. Verify master data links do NOT show "(Can Edit)"
4. Try direct URL: `/dashboard/companies` - should redirect to /forbidden

### Test as VIEWER:
1. Login: `viewer@example.com` / `123456`
2. Verify dashboard does NOT show Companies link
3. Verify master data links do NOT show "(Can Edit)"
4. Try direct URL: `/dashboard/companies` - should redirect to /forbidden

### Test as ENGINEER:
1. Login: `engineer@example.com` / `123456`
2. Verify dashboard does NOT show Companies link
3. Verify master data links do NOT show "(Can Edit)"
4. Try direct URL: `/dashboard/companies` - should redirect to /forbidden

---

## Permission Matrix Summary

| Resource | Action | ADMIN | ACCOUNTANT | ENGINEER | DATA_ENTRY | VIEWER |
|----------|--------|-------|------------|----------|------------|--------|
| **companies** | READ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **companies** | WRITE | ✅ | ❌ | ❌ | ❌ | ❌ |
| **projects** | READ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **projects** | WRITE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **vendors** | READ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **vendors** | WRITE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **costHeads** | READ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **costHeads** | WRITE | ✅ | ✅ | ❌ | ❌ | ❌ |
| **paymentMethods** | READ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **paymentMethods** | WRITE | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Expected Behaviors

✅ **What works:**
- All authenticated users can access `/dashboard`
- Navigation items are filtered based on permissions
- Server-side protection prevents direct URL access to restricted pages
- API routes return proper HTTP status codes (401, 403)
- Response format is consistent: `{ ok: boolean, data?: any, error?: string }`

❌ **What should fail:**
- Non-admin users accessing `/dashboard/companies` → Redirect to /forbidden
- Unauthenticated users accessing protected routes → Redirect to /login or 401
- Read-only users attempting write operations → 403 (when API routes are added)
