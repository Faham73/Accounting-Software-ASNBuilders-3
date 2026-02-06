# Attachments Foundation - Manual Test Checklist

## Overview
This checklist covers testing the minimal attachment foundation implementation for storing attachment metadata.

**Test Users:**
- Admin: `admin@example.com` / `123456` (can upload)
- Accountant: `accountant@example.com` / `123456` (can upload)
- Data Entry: `dataentry@example.com` / `123456` (read-only, cannot upload)

---

## API Tests

### POST /api/attachments (Create Attachment Metadata)

#### ✅ As Admin/Accountant (Can Upload):

#### Valid Creation:
- [ ] **Request:** `POST /api/attachments` with body:
  ```json
  {
    "url": "https://example.com/document.pdf",
    "fileName": "project-plan.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 102400
  }
  ```
- [ ] **Expected:** Status 201, `{ ok: true, data: { id, url, fileName, ... } }`
- [ ] **Verify:** Attachment created with correct companyId (from auth)
- [ ] **Verify:** Attachment created with correct uploadedByUserId (from auth)
- [ ] **Verify:** All fields saved correctly

#### Different MIME Types:
- [ ] **Test:** PDF (`application/pdf`)
- [ ] **Test:** Image (`image/png`, `image/jpeg`)
- [ ] **Test:** Document (`application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
- [ ] **Test:** Spreadsheet (`application/vnd.ms-excel`)
- [ ] **Expected:** All create successfully

#### Validation Errors:
- [ ] **Test:** Empty URL
- [ ] **Expected:** Status 400, validation error
- [ ] **Test:** Invalid URL format
- [ ] **Expected:** Status 400, "URL must be a valid URL"
- [ ] **Test:** Empty fileName
- [ ] **Expected:** Status 400, "File name is required"
- [ ] **Test:** Empty mimeType
- [ ] **Expected:** Status 400, "MIME type is required"
- [ ] **Test:** Zero or negative sizeBytes
- [ ] **Expected:** Status 400, validation error
- [ ] **Test:** Non-integer sizeBytes
- [ ] **Expected:** Status 400, validation error

#### ❌ As Data Entry (Read-Only):
- [ ] **Request:** `POST /api/attachments` as DATA_ENTRY user
- [ ] **Expected:** Status 403, `{ ok: false, error: "You do not have permission to upload attachments" }`

#### ❌ Unauthenticated:
- [ ] **Request:** `POST /api/attachments` without auth token
- [ ] **Expected:** Status 401, `{ ok: false, error: "Authentication required" }`

---

### GET /api/attachments (List Attachments)

#### ✅ As Any Authenticated User:

#### List All:
- [ ] **Request:** `GET /api/attachments`
- [ ] **Expected:** Status 200, `{ ok: true, data: [...] }`
- [ ] **Verify:** Returns attachments from user's company only
- [ ] **Verify:** Includes uploadedBy user info (id, name, email)
- [ ] **Verify:** Ordered by createdAt desc (newest first)

#### With Limit:
- [ ] **Request:** `GET /api/attachments?limit=5`
- [ ] **Expected:** Returns maximum 5 attachments
- [ ] **Verify:** Limit works correctly

#### Search by File Name:
- [ ] **Request:** `GET /api/attachments?q=pdf`
- [ ] **Expected:** Returns attachments with "pdf" in fileName (case-insensitive)
- [ ] **Test:** Search "DOCUMENT"
- [ ] **Expected:** Finds "document.pdf" (case-insensitive)

#### Company Scoping:
- [ ] **Prerequisite:** Create attachment in Company A
- [ ] **Action:** Login as user from Company B
- [ ] **Request:** `GET /api/attachments`
- [ ] **Expected:** Cannot see Company A's attachments
- [ ] **Verify:** Only Company B's attachments returned

#### ❌ Unauthenticated:
- [ ] **Request:** `GET /api/attachments` without auth token
- [ ] **Expected:** Status 401

---

## UI Tests

### Project Edit Page - Attachment Uploader

#### ✅ As Admin/Accountant (Can Upload):

#### Component Visibility:
- [ ] **Action:** Navigate to `/dashboard/projects/{id}` (edit page)
- [ ] **Verify:** "Attachments" section visible at bottom of form
- [ ] **Verify:** "+ Add Attachment" button visible

#### Open Attachment Form:
- [ ] **Action:** Click "+ Add Attachment" button
- [ ] **Verify:** Form expands with fields:
  - File URL (required)
  - File Name (required)
  - MIME Type (required)
  - Size (bytes) (required)
- [ ] **Verify:** "Dev Placeholder" label visible
- [ ] **Verify:** Note about development placeholder shown

#### Create Attachment:
- [ ] **Action:** Fill form:
  - URL: `https://example.com/test.pdf`
  - File Name: `test-document.pdf`
  - MIME Type: `application/pdf`
  - Size: `1024`
- [ ] **Action:** Click "Create Attachment"
- [ ] **Verify:** Form closes after successful creation
- [ ] **Verify:** Success message or no error shown
- [ ] **Verify:** Attachment appears in list (if list view exists)

#### File Size Display:
- [ ] **Action:** Enter size: `1024`
- [ ] **Verify:** Shows "1 KB" below input
- [ ] **Test:** Enter size: `1048576`
- [ ] **Verify:** Shows "1 MB"
- [ ] **Test:** Enter size: `1073741824`
- [ ] **Verify:** Shows "1 GB"

#### Validation:
- [ ] **Test:** Submit with empty URL
- [ ] **Expected:** Browser validation prevents submit
- [ ] **Test:** Submit with invalid URL format
- [ ] **Expected:** Browser validation prevents submit
- [ ] **Test:** Submit with empty fileName
- [ ] **Expected:** Browser validation prevents submit
- [ ] **Test:** Submit with zero sizeBytes
- [ ] **Expected:** Browser validation prevents submit

#### Cancel:
- [ ] **Action:** Open form, fill some fields
- [ ] **Action:** Click "Cancel" or "×" button
- [ ] **Verify:** Form closes
- [ ] **Verify:** Fields reset

#### Error Handling:
- [ ] **Action:** Submit with invalid data (e.g., invalid URL)
- [ ] **Verify:** Error message displayed
- [ ] **Verify:** Form remains open
- [ ] **Verify:** Can correct and resubmit

#### ❌ As Data Entry (Read-Only):
- [ ] **Note:** Attachment uploader should not be visible for read-only users
- [ ] **Action:** Try to access `/dashboard/projects/{id}` as DATA_ENTRY
- [ ] **Expected:** Redirects to `/forbidden` (no WRITE permission for projects)

---

## Integration Tests

### End-to-End Flow:

#### Create Attachment from Project Edit:
- [ ] **Action:** Edit a project
- [ ] **Action:** Add attachment via form
- [ ] **Verify:** Attachment created successfully
- [ ] **Action:** Refresh page
- [ ] **Verify:** Attachment still exists (persisted)

#### Multiple Attachments:
- [ ] **Action:** Create multiple attachments for same project
- [ ] **Verify:** All attachments created successfully
- [ ] **Verify:** Each has unique ID
- [ ] **Verify:** All linked to same companyId

#### Company Isolation:
- [ ] **Prerequisite:** Create attachment in Company A
- [ ] **Action:** Login as user from Company B
- [ ] **Action:** List attachments
- [ ] **Verify:** Cannot see Company A's attachments

---

## Data Validation Tests

### URL Validation:
- [ ] **Valid URLs:**
  - `https://example.com/file.pdf` ✅
  - `http://example.com/file.pdf` ✅
  - `https://example.com/path/to/file.pdf` ✅
- [ ] **Invalid URLs:**
  - `not-a-url` ❌
  - `ftp://example.com/file.pdf` (if not supported) ❌
  - Empty string ❌

### File Name Validation:
- [ ] **Valid:**
  - `document.pdf` ✅
  - `my file name.docx` ✅
  - `file123.pdf` ✅
- [ ] **Invalid:**
  - Empty string ❌
  - Only whitespace ❌

### MIME Type Validation:
- [ ] **Valid:**
  - `application/pdf` ✅
  - `image/png` ✅
  - `text/plain` ✅
- [ ] **Invalid:**
  - Empty string ❌

### Size Validation:
- [ ] **Valid:**
  - `1` (1 byte) ✅
  - `1024` (1 KB) ✅
  - `1048576` (1 MB) ✅
  - `1073741824` (1 GB) ✅
- [ ] **Invalid:**
  - `0` ❌
  - `-1` ❌
  - `1.5` (non-integer) ❌
  - Empty string ❌

---

## Permission Tests

### Upload Permission:
- [ ] **Admin:** Can upload ✅
- [ ] **Accountant:** Can upload ✅
- [ ] **Data Entry:** Cannot upload (403) ❌
- [ ] **Engineer:** Cannot upload (403) ❌
- [ ] **Viewer:** Cannot upload (403) ❌

### Read Permission:
- [ ] **All roles:** Can list attachments ✅
- [ ] **All roles:** Can see attachments from their company ✅

---

## Future-Proofing Tests

### Schema Compatibility:
- [ ] **Verify:** Attachment model has companyId (for company scoping)
- [ ] **Verify:** Attachment model has uploadedByUserId (for tracking)
- [ ] **Verify:** Attachment model has url, fileName, mimeType, sizeBytes
- [ ] **Verify:** No hardcoded projectId (allows future voucher linking)

### Extensibility:
- [ ] **Note:** Current implementation doesn't link attachments to projects
- [ ] **Note:** This is intentional for future voucher support
- [ ] **Verify:** Attachment can be created independently
- [ ] **Verify:** Can be linked to vouchers later without schema changes

---

## Test Summary

**Total Test Cases:** ~40+

**Critical Tests (Must Pass):**
- ✅ Permission enforcement (ADMIN/ACCOUNTANT can upload, others cannot)
- ✅ Company scoping (users only see their company's attachments)
- ✅ Validation (URL, fileName, mimeType, sizeBytes)
- ✅ Attachment metadata creation works
- ✅ UI component works on project edit page

**Future Considerations:**
- ⚠️ Actual file upload not implemented (dev placeholder)
- ⚠️ No attachment-to-project linking yet (future-proof for vouchers)
- ⚠️ No attachment list view on project page yet

---

## Notes

- **Dev Placeholder:** Current implementation uses URL/fileName form fields
- **Future:** Will be replaced with actual file upload when implemented
- **Permissions:** Based on WRITE permission on any master-data module
- **Company Scoping:** All attachments scoped by companyId
- **User Tracking:** All attachments track uploadedByUserId
- **Future-Proof:** Schema designed to support voucher attachments later
