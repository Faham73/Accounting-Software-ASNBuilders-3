# Companies Module - Manual Test Checklist

## Overview
This checklist covers testing the Companies module (admin-only) including API routes and UI.

**Test Users:**
- Admin: `admin@example.com` / `123456`
- Accountant: `accountant@example.com` / `123456` (non-admin)

---

## API Routes Testing

### 1. GET /api/companies (List Companies)

#### ✅ As Admin:
- [ ] **Request:** `GET /api/companies` with admin auth token
- [ ] **Expected:** Status 200, `{ ok: true, data: [...] }`
- [ ] **Verify:** Returns array of companies with fields: `id`, `name`, `isActive`, `createdAt`, `updatedAt`
- [ ] **Verify:** Companies are ordered by `createdAt` descending (newest first)

#### ❌ As Non-Admin (Accountant):
- [ ] **Request:** `GET /api/companies` with accountant auth token
- [ ] **Expected:** Status 403, `{ ok: false, error: "Admin access required" }`

#### ❌ Without Auth:
- [ ] **Request:** `GET /api/companies` without token
- [ ] **Expected:** Status 401, `{ ok: false, error: "Authentication required" }`

---

### 2. POST /api/companies (Create Company)

#### ✅ As Admin - Valid Input:
- [ ] **Request:** `POST /api/companies` with body `{ "name": "Test Company" }`
- [ ] **Expected:** Status 201, `{ ok: true, data: { id, name: "Test Company", isActive: true, ... } }`
- [ ] **Verify:** Company appears in GET /api/companies list
- [ ] **Verify:** `isActive` defaults to `true` if not provided

#### ✅ As Admin - With isActive:
- [ ] **Request:** `POST /api/companies` with body `{ "name": "Inactive Co", "isActive": false }`
- [ ] **Expected:** Status 201, `{ ok: true, data: { ..., isActive: false } }`

#### ❌ As Admin - Duplicate Name:
- [ ] **Prerequisite:** Create company "Duplicate Test"
- [ ] **Request:** `POST /api/companies` with body `{ "name": "Duplicate Test" }`
- [ ] **Expected:** Status 409, `{ ok: false, error: "A company with this name already exists" }`
- [ ] **Verify:** Case-insensitive duplicate check (try "duplicate test" or "DUPLICATE TEST")

#### ❌ As Admin - Empty Name:
- [ ] **Request:** `POST /api/companies` with body `{ "name": "" }`
- [ ] **Expected:** Status 400, `{ ok: false, error: "Company name is required" }`

#### ❌ As Admin - Missing Name:
- [ ] **Request:** `POST /api/companies` with body `{}`
- [ ] **Expected:** Status 400, validation error

#### ❌ As Non-Admin:
- [ ] **Request:** `POST /api/companies` with accountant token
- [ ] **Expected:** Status 403, `{ ok: false, error: "Admin access required" }`

---

### 3. PATCH /api/companies/[id] (Update Company)

#### ✅ As Admin - Update Name:
- [ ] **Prerequisite:** Create company "Update Test"
- [ ] **Request:** `PATCH /api/companies/{id}` with body `{ "name": "Updated Name" }`
- [ ] **Expected:** Status 200, `{ ok: true, data: { ..., name: "Updated Name" } }`
- [ ] **Verify:** Company name updated in GET /api/companies

#### ✅ As Admin - Update isActive:
- [ ] **Prerequisite:** Company with `isActive: true`
- [ ] **Request:** `PATCH /api/companies/{id}` with body `{ "isActive": false }`
- [ ] **Expected:** Status 200, `{ ok: true, data: { ..., isActive: false } }`

#### ✅ As Admin - Update Both Fields:
- [ ] **Request:** `PATCH /api/companies/{id}` with body `{ "name": "New Name", "isActive": true }`
- [ ] **Expected:** Status 200, both fields updated

#### ❌ As Admin - Duplicate Name:
- [ ] **Prerequisite:** Two companies "Company A" and "Company B"
- [ ] **Request:** `PATCH /api/companies/{companyB_id}` with body `{ "name": "Company A" }`
- [ ] **Expected:** Status 409, `{ ok: false, error: "A company with this name already exists" }`

#### ✅ As Admin - Same Name (No Change):
- [ ] **Prerequisite:** Company "Same Name"
- [ ] **Request:** `PATCH /api/companies/{id}` with body `{ "name": "Same Name" }`
- [ ] **Expected:** Status 200, update succeeds (no duplicate error)

#### ❌ As Admin - Company Not Found:
- [ ] **Request:** `PATCH /api/companies/invalid-id` with body `{ "name": "Test" }`
- [ ] **Expected:** Status 404, `{ ok: false, error: "Company not found" }`

#### ❌ As Admin - Empty Name:
- [ ] **Request:** `PATCH /api/companies/{id}` with body `{ "name": "" }`
- [ ] **Expected:** Status 400, validation error

#### ❌ As Non-Admin:
- [ ] **Request:** `PATCH /api/companies/{id}` with accountant token
- [ ] **Expected:** Status 403, `{ ok: false, error: "Admin access required" }`

---

## UI Testing

### 4. Dashboard Navigation

#### ✅ As Admin:
- [ ] **Verify:** Dashboard shows "Companies (Admin Only)" link
- [ ] **Verify:** Clicking link navigates to `/dashboard/companies`

#### ❌ As Non-Admin (Accountant):
- [ ] **Verify:** Dashboard does NOT show "Companies" link
- [ ] **Verify:** Direct URL `/dashboard/companies` redirects to `/forbidden`

---

### 5. Companies Page - List View

#### ✅ As Admin:
- [ ] **Verify:** Page loads without errors
- [ ] **Verify:** Shows table with columns: Name, Status, Created, Actions
- [ ] **Verify:** All companies are displayed
- [ ] **Verify:** Companies ordered newest first
- [ ] **Verify:** Status shows "Active" (green) or "Inactive" (gray) badge
- [ ] **Verify:** Created date formatted correctly

#### ✅ Empty State:
- [ ] **Prerequisite:** Delete all companies (or use fresh database)
- [ ] **Verify:** Shows "No companies found. Create one to get started."

---

### 6. Companies Page - Create Form

#### ✅ Valid Creation:
- [ ] **Action:** Enter "New Company Name" in form
- [ ] **Action:** Click "Create Company"
- [ ] **Verify:** Form submits successfully
- [ ] **Verify:** New company appears in list immediately
- [ ] **Verify:** Form resets (input cleared)
- [ ] **Verify:** No error messages shown

#### ❌ Empty Name:
- [ ] **Action:** Leave name field empty
- [ ] **Action:** Click "Create Company"
- [ ] **Verify:** Button disabled or form shows validation error
- [ ] **Verify:** Error message: "Company name is required"

#### ❌ Duplicate Name:
- [ ] **Prerequisite:** Company "Duplicate UI Test" exists
- [ ] **Action:** Enter "Duplicate UI Test" in form
- [ ] **Action:** Click "Create Company"
- [ ] **Verify:** Error message shown: "A company with this name already exists"
- [ ] **Verify:** Company not added to list

#### ✅ Loading State:
- [ ] **Action:** Submit form
- [ ] **Verify:** Button shows "Creating..." and is disabled during request

---

### 7. Companies Page - Inline Edit

#### ✅ Edit Name:
- [ ] **Action:** Click "Edit" button on a company row
- [ ] **Verify:** Name field becomes editable input
- [ ] **Verify:** "Edit" button replaced with "Save" and "Cancel"
- [ ] **Action:** Change name to "Updated Name"
- [ ] **Action:** Click "Save"
- [ ] **Verify:** Name updates in table
- [ ] **Verify:** Edit mode exits
- [ ] **Verify:** Changes persist after page refresh

#### ✅ Cancel Edit:
- [ ] **Action:** Click "Edit" button
- [ ] **Action:** Change name
- [ ] **Action:** Click "Cancel"
- [ ] **Verify:** Original name restored
- [ ] **Verify:** Edit mode exits

#### ✅ Keyboard Shortcuts:
- [ ] **Action:** Click "Edit", change name
- [ ] **Action:** Press Enter key
- [ ] **Verify:** Changes saved
- [ ] **Action:** Click "Edit", change name
- [ ] **Action:** Press Escape key
- [ ] **Verify:** Edit cancelled

#### ❌ Empty Name on Save:
- [ ] **Action:** Click "Edit"
- [ ] **Action:** Clear name field
- [ ] **Action:** Click "Save"
- [ ] **Verify:** Error message shown
- [ ] **Verify:** Edit mode remains active

#### ❌ Duplicate Name on Update:
- [ ] **Prerequisite:** Two companies "Edit Test A" and "Edit Test B"
- [ ] **Action:** Edit "Edit Test B", change name to "Edit Test A"
- [ ] **Action:** Click "Save"
- [ ] **Verify:** Error message: "A company with this name already exists"
- [ ] **Verify:** Name not changed

#### ✅ Loading State:
- [ ] **Action:** Click "Save"
- [ ] **Verify:** Button shows "Saving..." and is disabled
- [ ] **Verify:** Input disabled during request

---

## Integration Testing

### 8. End-to-End Flow

#### ✅ Complete CRUD Flow:
- [ ] **Create:** Add company "E2E Test" via form
- [ ] **Read:** Verify it appears in list
- [ ] **Update:** Edit name to "E2E Test Updated"
- [ ] **Verify:** Change persists after refresh
- [ ] **Verify:** API returns updated data

### 9. Error Handling

#### ✅ Network Error:
- [ ] **Action:** Disconnect network
- [ ] **Action:** Try to create/update company
- [ ] **Verify:** Error message shown to user
- [ ] **Verify:** UI doesn't break

#### ✅ Server Error:
- [ ] **Action:** Cause server error (e.g., invalid DB connection)
- [ ] **Verify:** Appropriate error message shown
- [ ] **Verify:** UI remains functional

---

## Security Testing

### 10. Authorization

#### ✅ Admin Access:
- [ ] **Verify:** Admin can access all endpoints
- [ ] **Verify:** Admin can see Companies link in dashboard
- [ ] **Verify:** Admin can access `/dashboard/companies` directly

#### ❌ Non-Admin Access:
- [ ] **Verify:** Non-admin cannot access `/api/companies` endpoints (403)
- [ ] **Verify:** Non-admin cannot see Companies link
- [ ] **Verify:** Direct URL access redirects to `/forbidden`

#### ❌ Unauthenticated Access:
- [ ] **Verify:** Unauthenticated requests return 401
- [ ] **Verify:** Direct URL access redirects to `/login`

---

## Data Validation

### 11. Input Validation

#### ✅ Valid Inputs:
- [ ] Company name: "Valid Company Name"
- [ ] Company name: "Company 123"
- [ ] Company name: "A" (single character, minimum)
- [ ] Company name: Very long name (100+ characters)

#### ❌ Invalid Inputs:
- [ ] Empty string: ""
- [ ] Only whitespace: "   "
- [ ] Missing name field
- [ ] Invalid isActive value (non-boolean)

---

## Browser Compatibility

### 12. Cross-Browser Testing

- [ ] **Chrome:** All features work
- [ ] **Firefox:** All features work
- [ ] **Safari:** All features work
- [ ] **Edge:** All features work

---

## Performance Testing

### 13. Large Dataset

- [ ] **Prerequisite:** Create 50+ companies
- [ ] **Verify:** List loads in reasonable time (<2 seconds)
- [ ] **Verify:** Table renders correctly
- [ ] **Verify:** Edit functionality works on all rows

---

## Test Summary

**Total Test Cases:** ~50+

**Critical Tests (Must Pass):**
- ✅ Admin-only access enforcement
- ✅ Create company with validation
- ✅ Update company name
- ✅ Duplicate name prevention
- ✅ Non-admin blocked from access

**Nice-to-Have Tests:**
- Keyboard shortcuts
- Loading states
- Error handling
- Large dataset performance

---

## Notes

- All API responses follow format: `{ ok: boolean, data?: any, error?: string }`
- All routes require admin authentication
- Company names are case-insensitive for duplicate checking
- UI uses inline editing (no modal) for simplicity
- Form validation happens both client-side and server-side
