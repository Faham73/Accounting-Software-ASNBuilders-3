# Master Data API - Manual Test Checklist

## Overview
This checklist covers testing CRUD APIs for Projects, Vendors, Cost Heads, and Payment Methods with RBAC and company scoping.

**Test Users:**
- Admin: `admin@example.com` / `123456` (READ + WRITE)
- Accountant: `accountant@example.com` / `123456` (READ + WRITE)
- Viewer: `viewer@example.com` / `123456` (READ only)

---

## General Tests (Apply to All Resources)

### Authentication & Authorization

#### ✅ READ Permission (All Roles)
- [ ] **Admin:** Can GET list and single item
- [ ] **Accountant:** Can GET list and single item
- [ ] **Viewer:** Can GET list and single item
- [ ] **Data Entry:** Can GET list and single item
- [ ] **Engineer:** Can GET list and single item

#### ❌ WRITE Permission (Admin/Accountant Only)
- [ ] **Admin:** Can POST, PATCH, DELETE
- [ ] **Accountant:** Can POST, PATCH, DELETE
- [ ] **Viewer:** Cannot POST (403)
- [ ] **Viewer:** Cannot PATCH (403)
- [ ] **Viewer:** Cannot DELETE (403)

#### ❌ Unauthenticated Access
- [ ] **No token:** All endpoints return 401

### Company Scoping

- [ ] **Verify:** User only sees data from their own company
- [ ] **Verify:** Cannot access other company's data by ID (404)
- [ ] **Verify:** Created items automatically assigned to user's company

---

## Projects API Tests

### GET /api/projects

#### ✅ List All Active (Default)
- [ ] **Request:** `GET /api/projects`
- [ ] **Expected:** Status 200, returns only active projects from user's company
- [ ] **Verify:** Projects ordered by createdAt desc

#### ✅ Search by Name
- [ ] **Request:** `GET /api/projects?q=test`
- [ ] **Expected:** Returns projects with "test" in name (case-insensitive)
- [ ] **Verify:** Only returns projects from user's company

#### ✅ Filter by Status
- [ ] **Request:** `GET /api/projects?status=RUNNING`
- [ ] **Expected:** Returns only RUNNING projects
- [ ] **Test:** DRAFT, RUNNING, COMPLETED, CLOSED statuses

#### ✅ Include Inactive
- [ ] **Request:** `GET /api/projects?active=false`
- [ ] **Expected:** Returns inactive projects
- [ ] **Request:** `GET /api/projects?active=true`
- [ ] **Expected:** Returns active projects only

#### ✅ Combined Filters
- [ ] **Request:** `GET /api/projects?q=project&status=DRAFT&active=true`
- [ ] **Expected:** Returns matching projects with all filters applied

### GET /api/projects/[id]

#### ✅ Valid ID
- [ ] **Request:** `GET /api/projects/{valid_id}`
- [ ] **Expected:** Status 200, returns project details
- [ ] **Verify:** All fields present (id, name, status, dates, etc.)

#### ❌ Invalid ID
- [ ] **Request:** `GET /api/projects/invalid-id`
- [ ] **Expected:** Status 404, `{ ok: false, error: "Project not found" }`

#### ❌ Other Company's ID
- [ ] **Prerequisite:** Get project ID from different company
- [ ] **Request:** `GET /api/projects/{other_company_id}`
- [ ] **Expected:** Status 404 (company scoping)

### POST /api/projects

#### ✅ Minimal Project (Admin/Accountant)
- [ ] **Request:** `POST /api/projects` with `{ "name": "Test Project" }`
- [ ] **Expected:** Status 201, returns created project
- [ ] **Verify:** Defaults: status=DRAFT, isActive=true
- [ ] **Verify:** companyId matches auth user's company

#### ✅ Full Project
- [ ] **Request:** `POST /api/projects` with all fields
- [ ] **Expected:** Status 201, all fields saved correctly
- [ ] **Verify:** Dates parsed correctly
- [ ] **Verify:** contractValue accepts decimals

#### ❌ Empty Name
- [ ] **Request:** `POST /api/projects` with `{ "name": "" }`
- [ ] **Expected:** Status 400, validation error

#### ❌ Invalid Status
- [ ] **Request:** `POST /api/projects` with `{ "name": "Test", "status": "INVALID" }`
- [ ] **Expected:** Status 400, validation error

#### ❌ Negative Contract Value
- [ ] **Request:** `POST /api/projects` with `{ "name": "Test", "contractValue": -100 }`
- [ ] **Expected:** Status 400, validation error

#### ❌ Read-Only User (Viewer)
- [ ] **Request:** `POST /api/projects` as VIEWER
- [ ] **Expected:** Status 403, `{ ok: false, error: "You do not have permission to WRITE projects" }`

### PATCH /api/projects/[id]

#### ✅ Update Name (Admin/Accountant)
- [ ] **Request:** `PATCH /api/projects/{id}` with `{ "name": "Updated Name" }`
- [ ] **Expected:** Status 200, name updated
- [ ] **Verify:** Other fields unchanged

#### ✅ Update Status
- [ ] **Request:** `PATCH /api/projects/{id}` with `{ "status": "COMPLETED" }`
- [ ] **Expected:** Status 200, status updated

#### ✅ Update Multiple Fields
- [ ] **Request:** `PATCH /api/projects/{id}` with multiple fields
- [ ] **Expected:** Status 200, all specified fields updated

#### ❌ Project Not Found
- [ ] **Request:** `PATCH /api/projects/invalid-id`
- [ ] **Expected:** Status 404

#### ❌ Read-Only User
- [ ] **Request:** `PATCH /api/projects/{id}` as VIEWER
- [ ] **Expected:** Status 403

### DELETE /api/projects/[id]

#### ✅ Soft Delete (Admin/Accountant)
- [ ] **Request:** `DELETE /api/projects/{id}`
- [ ] **Expected:** Status 200, `{ ok: true, data: { id, name, isActive: false } }`
- [ ] **Verify:** Project still exists in DB but isActive=false
- [ ] **Verify:** Project doesn't appear in default GET list (active=true)

#### ❌ Project Not Found
- [ ] **Request:** `DELETE /api/projects/invalid-id`
- [ ] **Expected:** Status 404

#### ❌ Read-Only User
- [ ] **Request:** `DELETE /api/projects/{id}` as VIEWER
- [ ] **Expected:** Status 403

---

## Vendors API Tests

### GET /api/vendors

#### ✅ List All Active
- [ ] **Request:** `GET /api/vendors`
- [ ] **Expected:** Status 200, active vendors from user's company

#### ✅ Search
- [ ] **Request:** `GET /api/vendors?q=supplier`
- [ ] **Expected:** Returns vendors matching search

#### ✅ Include Inactive
- [ ] **Request:** `GET /api/vendors?active=false`
- [ ] **Expected:** Returns inactive vendors

### GET /api/vendors/[id]

#### ✅ Valid ID
- [ ] **Request:** `GET /api/vendors/{id}`
- [ ] **Expected:** Status 200, vendor details

#### ❌ Invalid ID
- [ ] **Request:** `GET /api/vendors/invalid-id`
- [ ] **Expected:** Status 404

### POST /api/vendors

#### ✅ Create Vendor (Admin/Accountant)
- [ ] **Request:** `POST /api/vendors` with `{ "name": "Vendor ABC" }`
- [ ] **Expected:** Status 201, vendor created
- [ ] **Verify:** Optional fields (phone, address, notes) can be null

#### ✅ Full Vendor
- [ ] **Request:** `POST /api/vendors` with all fields
- [ ] **Expected:** Status 201, all fields saved

#### ❌ Empty Name
- [ ] **Request:** `POST /api/vendors` with `{ "name": "" }`
- [ ] **Expected:** Status 400

#### ❌ Read-Only User
- [ ] **Request:** `POST /api/vendors` as VIEWER
- [ ] **Expected:** Status 403

### PATCH /api/vendors/[id]

#### ✅ Update Vendor
- [ ] **Request:** `PATCH /api/vendors/{id}` with updates
- [ ] **Expected:** Status 200, fields updated

#### ❌ Not Found
- [ ] **Request:** `PATCH /api/vendors/invalid-id`
- [ ] **Expected:** Status 404

### DELETE /api/vendors/[id]

#### ✅ Soft Delete
- [ ] **Request:** `DELETE /api/vendors/{id}`
- [ ] **Expected:** Status 200, isActive=false

---

## Cost Heads API Tests

### GET /api/cost-heads

#### ✅ List All Active
- [ ] **Request:** `GET /api/cost-heads`
- [ ] **Expected:** Status 200, active cost heads

#### ✅ Search
- [ ] **Request:** `GET /api/cost-heads?q=materials`
- [ ] **Expected:** Returns matching cost heads

### GET /api/cost-heads/[id]

#### ✅ Valid ID
- [ ] **Request:** `GET /api/cost-heads/{id}`
- [ ] **Expected:** Status 200

### POST /api/cost-heads

#### ✅ Create Cost Head (Admin/Accountant)
- [ ] **Request:** `POST /api/cost-heads` with `{ "name": "New Cost Head" }`
- [ ] **Expected:** Status 201, created

#### ✅ With Code
- [ ] **Request:** `POST /api/cost-heads` with `{ "name": "Materials", "code": "MAT" }`
- [ ] **Expected:** Status 201

#### ❌ Duplicate Name (Same Company)
- [ ] **Prerequisite:** Create cost head "Duplicate Test"
- [ ] **Request:** `POST /api/cost-heads` with `{ "name": "Duplicate Test" }`
- [ ] **Expected:** Status 409, `{ ok: false, error: "A cost head with this name already exists" }`

#### ✅ Same Name (Different Company)
- [ ] **Prerequisite:** Cost head "Shared Name" in Company A
- [ ] **Action:** Login as user from Company B
- [ ] **Request:** `POST /api/cost-heads` with `{ "name": "Shared Name" }`
- [ ] **Expected:** Status 201 (unique per company)

#### ❌ Read-Only User
- [ ] **Request:** `POST /api/cost-heads` as VIEWER
- [ ] **Expected:** Status 403

### PATCH /api/cost-heads/[id]

#### ✅ Update Cost Head
- [ ] **Request:** `PATCH /api/cost-heads/{id}` with updates
- [ ] **Expected:** Status 200

#### ❌ Duplicate Name on Update
- [ ] **Prerequisite:** Two cost heads "Cost A" and "Cost B"
- [ ] **Request:** `PATCH /api/cost-heads/{costB_id}` with `{ "name": "Cost A" }`
- [ ] **Expected:** Status 409

### DELETE /api/cost-heads/[id]

#### ✅ Soft Delete
- [ ] **Request:** `DELETE /api/cost-heads/{id}`
- [ ] **Expected:** Status 200, isActive=false

---

## Payment Methods API Tests

### GET /api/payment-methods

#### ✅ List All Active
- [ ] **Request:** `GET /api/payment-methods`
- [ ] **Expected:** Status 200, active payment methods

#### ✅ Search
- [ ] **Request:** `GET /api/payment-methods?q=cash`
- [ ] **Expected:** Returns matching methods

### GET /api/payment-methods/[id]

#### ✅ Valid ID
- [ ] **Request:** `GET /api/payment-methods/{id}`
- [ ] **Expected:** Status 200

### POST /api/payment-methods

#### ✅ Create Payment Method (Admin/Accountant)
- [ ] **Request:** `POST /api/payment-methods` with `{ "name": "Credit Card", "type": "BANK" }`
- [ ] **Expected:** Status 201, created
- [ ] **Verify:** Type is required

#### ✅ Valid Types
- [ ] **Test:** CASH, BANK, CHEQUE, MOBILE
- [ ] **Expected:** All create successfully

#### ❌ Invalid Type
- [ ] **Request:** `POST /api/payment-methods` with `{ "name": "Test", "type": "INVALID" }`
- [ ] **Expected:** Status 400, validation error

#### ❌ Missing Type
- [ ] **Request:** `POST /api/payment-methods` with `{ "name": "Test" }`
- [ ] **Expected:** Status 400, validation error

#### ❌ Duplicate Name (Same Company)
- [ ] **Prerequisite:** Payment method "Cash" exists
- [ ] **Request:** `POST /api/payment-methods` with `{ "name": "Cash", "type": "CASH" }`
- [ ] **Expected:** Status 409

#### ❌ Read-Only User
- [ ] **Request:** `POST /api/payment-methods` as VIEWER
- [ ] **Expected:** Status 403

### PATCH /api/payment-methods/[id]

#### ✅ Update Payment Method
- [ ] **Request:** `PATCH /api/payment-methods/{id}` with updates
- [ ] **Expected:** Status 200

#### ❌ Duplicate Name on Update
- [ ] **Prerequisite:** Two payment methods "Method A" and "Method B"
- [ ] **Request:** `PATCH /api/payment-methods/{methodB_id}` with `{ "name": "Method A" }`
- [ ] **Expected:** Status 409

### DELETE /api/payment-methods/[id]

#### ✅ Soft Delete
- [ ] **Request:** `DELETE /api/payment-methods/{id}`
- [ ] **Expected:** Status 200, isActive=false

---

## Cross-Resource Tests

### Company Isolation

- [ ] **Prerequisite:** Create project in Company A
- [ ] **Action:** Login as user from Company B
- [ ] **Verify:** Cannot see Company A's project in list
- [ ] **Verify:** Cannot access Company A's project by ID (404)

### RBAC Matrix

| Role | Projects | Vendors | Cost Heads | Payment Methods |
|------|----------|---------|------------|-----------------|
| ADMIN | READ+WRITE | READ+WRITE | READ+WRITE | READ+WRITE |
| ACCOUNTANT | READ+WRITE | READ+WRITE | READ+WRITE | READ+WRITE |
| DATA_ENTRY | READ | READ | READ | READ |
| ENGINEER | READ | READ | READ | READ |
| VIEWER | READ | READ | READ | READ |

- [ ] **Verify:** Each role has correct permissions for all resources

---

## Edge Cases

### Search Functionality

- [ ] **Empty search:** `GET /api/projects?q=` returns all (no filter)
- [ ] **Special characters:** Search with special chars works
- [ ] **Case insensitive:** Search "TEST" finds "test"

### Filter Combinations

- [ ] **Multiple filters:** All filters work together correctly
- [ ] **Invalid filter values:** Gracefully handled

### Soft Delete Behavior

- [ ] **Deleted item:** Doesn't appear in default list (active=true)
- [ ] **Deleted item:** Appears when active=false
- [ ] **Deleted item:** Can be restored by PATCH with isActive=true

---

## Test Summary

**Total Test Cases:** ~100+

**Critical Tests (Must Pass):**
- ✅ Company scoping (users only see their company's data)
- ✅ RBAC enforcement (READ vs WRITE permissions)
- ✅ Soft delete functionality
- ✅ Search and filter functionality
- ✅ Duplicate name prevention (Cost Heads, Payment Methods)
- ✅ Validation errors (empty names, invalid enums, etc.)

**Resources Tested:**
- ✅ Projects (with status filtering)
- ✅ Vendors
- ✅ Cost Heads (with unique name constraint)
- ✅ Payment Methods (with type enum and unique name constraint)

---

## Notes

- All endpoints return `{ ok: boolean, data?: any, error?: string }`
- Company scoping is automatic (never trust client-provided companyId)
- Soft delete sets `isActive=false` (records remain in database)
- Search is case-insensitive
- `active` filter defaults to `true` if not specified
- Unique constraints: CostHead and PaymentMethod names are unique per company
