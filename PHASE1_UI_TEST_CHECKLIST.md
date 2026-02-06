# Phase 1 UI - Manual Test Checklist

## Overview
This checklist covers testing the Phase 1 UI pages for Projects, Vendors, Cost Heads, and Payment Methods with RBAC enforcement.

**Test Users:**
- Admin: `admin@example.com` / `123456` (READ + WRITE)
- Accountant: `accountant@example.com` / `123456` (READ + WRITE)
- Data Entry: `dataentry@example.com` / `123456` (READ only)

---

## Sidebar Navigation Tests

### ✅ As Admin:
- [ ] **Verify:** Sidebar shows all navigation items
- [ ] **Verify:** Companies link visible
- [ ] **Verify:** Projects, Vendors, Cost Heads, Payment Methods all show ✏️ icon
- [ ] **Verify:** All links navigate correctly

### ✅ As Accountant:
- [ ] **Verify:** Sidebar shows Projects, Vendors, Cost Heads, Payment Methods
- [ ] **Verify:** Companies link NOT visible
- [ ] **Verify:** All master data links show ✏️ icon
- [ ] **Verify:** All links navigate correctly

### ❌ As Data Entry (Read-Only):
- [ ] **Verify:** Sidebar shows Projects, Vendors, Cost Heads, Payment Methods
- [ ] **Verify:** Companies link NOT visible
- [ ] **Verify:** NO ✏️ icons shown (read-only)
- [ ] **Verify:** All links navigate correctly

---

## Projects Page Tests

### ✅ As Admin/Accountant (WRITE Permission):

#### List View:
- [ ] **Verify:** Page loads with projects table
- [ ] **Verify:** "New Project" button visible in header
- [ ] **Verify:** Search box works (filters by name)
- [ ] **Verify:** Status filter works (All, Draft, Running, Completed, Closed)
- [ ] **Verify:** Active filter works (Active, Archived, All)
- [ ] **Verify:** Table shows: Name, Client, Status, Contract Value, Active, Actions
- [ ] **Verify:** Status badges have correct colors
- [ ] **Verify:** Contract values formatted as currency
- [ ] **Verify:** Edit and Archive buttons visible for each project

#### Create Project:
- [ ] **Action:** Click "New Project" button
- [ ] **Verify:** Navigates to `/dashboard/projects/new`
- [ ] **Verify:** Form loads with all fields
- [ ] **Verify:** Required field (name) marked with *
- [ ] **Action:** Fill form and submit
- [ ] **Verify:** Redirects to projects list
- [ ] **Verify:** New project appears in list
- [ ] **Test:** Keyboard navigation (Tab through fields)
- [ ] **Test:** Enter key submits form

#### Edit Project:
- [ ] **Action:** Click "Edit" on a project
- [ ] **Verify:** Navigates to `/dashboard/projects/{id}`
- [ ] **Verify:** Form pre-filled with project data
- [ ] **Action:** Update fields and save
- [ ] **Verify:** Changes saved and reflected in list
- [ ] **Test:** Keyboard navigation works

#### Archive Project:
- [ ] **Action:** Click "Archive" on a project
- [ ] **Verify:** Confirmation dialog appears
- [ ] **Action:** Confirm archive
- [ ] **Verify:** Project disappears from default list (active=true)
- [ ] **Action:** Change filter to "Archived"
- [ ] **Verify:** Archived project appears with isActive=false

### ❌ As Data Entry (READ Only):

#### List View:
- [ ] **Verify:** Page loads with projects table
- [ ] **Verify:** "New Project" button NOT visible
- [ ] **Verify:** Search and filters work
- [ ] **Verify:** Table shows data but NO Actions column
- [ ] **Verify:** Can view all project details

#### Direct URL Access (Should Block):
- [ ] **Action:** Try to access `/dashboard/projects/new` directly
- [ ] **Expected:** Redirects to `/forbidden`
- [ ] **Action:** Try to access `/dashboard/projects/{id}` directly
- [ ] **Expected:** Redirects to `/forbidden`

---

## Vendors Page Tests

### ✅ As Admin/Accountant (WRITE Permission):

#### List View:
- [ ] **Verify:** Page loads with vendors table
- [ ] **Verify:** "New Vendor" button visible
- [ ] **Verify:** Search box works
- [ ] **Verify:** Active filter works
- [ ] **Verify:** Table shows: Name, Phone, Address, Active, Actions

#### Create Vendor (Inline):
- [ ] **Action:** Click "New Vendor" button
- [ ] **Verify:** Create form appears above table
- [ ] **Action:** Fill form (name required, others optional)
- [ ] **Action:** Submit form
- [ ] **Verify:** Form disappears, vendor appears in table
- [ ] **Test:** Cancel button closes form without saving

#### Edit Vendor (Inline):
- [ ] **Action:** Click "Edit" on a vendor
- [ ] **Verify:** Row expands to show edit form
- [ ] **Action:** Update fields and save
- [ ] **Verify:** Changes saved, row returns to normal view
- [ ] **Test:** Cancel button restores original values

#### Archive Vendor:
- [ ] **Action:** Click "Archive" on a vendor
- [ ] **Verify:** Confirmation dialog
- [ ] **Verify:** Vendor archived (isActive=false)

### ❌ As Data Entry (READ Only):

#### List View:
- [ ] **Verify:** Page loads with vendors table
- [ ] **Verify:** "New Vendor" button NOT visible
- [ ] **Verify:** Search and filters work
- [ ] **Verify:** NO Actions column
- [ ] **Verify:** Can view all vendor data

---

## Cost Heads Page Tests

### ✅ As Admin/Accountant (WRITE Permission):

#### List View:
- [ ] **Verify:** Page loads with cost heads table
- [ ] **Verify:** "New Cost Head" button visible
- [ ] **Verify:** Search box works
- [ ] **Verify:** Table shows: Name, Code, Active, Actions

#### Create Cost Head (Inline):
- [ ] **Action:** Click "New Cost Head"
- [ ] **Verify:** Create form appears
- [ ] **Action:** Enter name (required), code (optional)
- [ ] **Action:** Submit
- [ ] **Verify:** Cost head created and appears in table
- [ ] **Test:** Try to create duplicate name
- [ ] **Expected:** Error message "A cost head with this name already exists"

#### Edit Cost Head (Inline):
- [ ] **Action:** Click "Edit" on a cost head
- [ ] **Verify:** Inline edit form appears
- [ ] **Action:** Update and save
- [ ] **Verify:** Changes saved

#### Archive Cost Head:
- [ ] **Action:** Archive a cost head
- [ ] **Verify:** Archived successfully

### ❌ As Data Entry (READ Only):

#### List View:
- [ ] **Verify:** Page loads, can view all cost heads
- [ ] **Verify:** "New Cost Head" button NOT visible
- [ ] **Verify:** NO Actions column
- [ ] **Verify:** Cannot edit or archive

---

## Payment Methods Page Tests

### ✅ As Admin/Accountant (WRITE Permission):

#### List View:
- [ ] **Verify:** Page loads with payment methods table
- [ ] **Verify:** "New Payment Method" button visible
- [ ] **Verify:** Table shows: Name, Type, Active, Actions
- [ ] **Verify:** Type shown as badge (CASH, BANK, CHEQUE, MOBILE)

#### Create Payment Method (Inline):
- [ ] **Action:** Click "New Payment Method"
- [ ] **Verify:** Create form appears
- [ ] **Action:** Enter name and select type (required)
- [ ] **Action:** Submit
- [ ] **Verify:** Payment method created
- [ ] **Test:** Try to create duplicate name
- [ ] **Expected:** Error message about duplicate

#### Edit Payment Method (Inline):
- [ ] **Action:** Edit a payment method
- [ ] **Verify:** Inline form with type dropdown
- [ ] **Action:** Change type and save
- [ ] **Verify:** Changes saved

#### Archive Payment Method:
- [ ] **Action:** Archive a payment method
- [ ] **Verify:** Archived successfully

### ❌ As Data Entry (READ Only):

#### List View:
- [ ] **Verify:** Page loads, can view all payment methods
- [ ] **Verify:** "New Payment Method" button NOT visible
- [ ] **Verify:** NO Actions column
- [ ] **Verify:** Cannot edit or archive

---

## Cross-Page Tests

### Navigation Flow:
- [ ] **Test:** Navigate between all pages using sidebar
- [ ] **Verify:** All pages load correctly
- [ ] **Verify:** Back to Dashboard button works on all pages

### Company Scoping:
- [ ] **Prerequisite:** Create data in Company A
- [ ] **Action:** Login as user from Company B
- [ ] **Verify:** Cannot see Company A's data
- [ ] **Verify:** Can only see Company B's data

### Keyboard Accessibility:
- [ ] **Test:** Tab through all form fields
- [ ] **Test:** Enter key submits forms
- [ ] **Test:** Escape key cancels (where applicable)
- [ ] **Verify:** All interactive elements keyboard accessible

### Search Functionality:
- [ ] **Test:** Search works on all list pages
- [ ] **Verify:** Search is case-insensitive
- [ ] **Verify:** Search updates results in real-time (debounced)
- [ ] **Verify:** Empty search shows all results

### Filter Functionality:
- [ ] **Test:** All filters work correctly
- [ ] **Verify:** Filters can be combined
- [ ] **Verify:** Changing filter updates list immediately

---

## Error Handling Tests

### Forbidden Access:
- [ ] **As Data Entry:** Try to access `/dashboard/projects/new`
- [ ] **Expected:** Redirects to `/forbidden`
- [ ] **As Data Entry:** Try to access `/dashboard/projects/{id}` (edit)
- [ ] **Expected:** Redirects to `/forbidden`

### Network Errors:
- [ ] **Action:** Disconnect network
- [ ] **Action:** Try to create/edit item
- [ ] **Verify:** Error message shown
- [ ] **Verify:** UI doesn't break

### Validation Errors:
- [ ] **Test:** Submit form with empty required field
- [ ] **Expected:** Validation error shown
- [ ] **Test:** Submit invalid data (e.g., negative contract value)
- [ ] **Expected:** Validation error shown

---

## UI/UX Tests

### Responsive Design:
- [ ] **Test:** Resize browser window
- [ ] **Verify:** Sidebar collapses appropriately on mobile
- [ ] **Verify:** Tables scroll horizontally on small screens
- [ ] **Verify:** Forms stack vertically on mobile

### Loading States:
- [ ] **Verify:** Loading indicators shown during API calls
- [ ] **Verify:** Buttons disabled during submission
- [ ] **Verify:** Forms show "Saving..." or "Creating..." text

### Visual Feedback:
- [ ] **Verify:** Success actions show updated data immediately
- [ ] **Verify:** Error messages are clear and actionable
- [ ] **Verify:** Status badges use appropriate colors
- [ ] **Verify:** Active/Archived badges clearly distinguishable

---

## Test Summary

**Total Test Cases:** ~80+

**Critical Tests (Must Pass):**
- ✅ RBAC enforcement (read-only users cannot create/edit)
- ✅ Company scoping (users only see their company's data)
- ✅ All CRUD operations work for write-enabled users
- ✅ Archive functionality (soft delete)
- ✅ Search and filter functionality
- ✅ Forbidden page redirects for unauthorized access

**Resources Tested:**
- ✅ Projects (with status filter)
- ✅ Vendors
- ✅ Cost Heads
- ✅ Payment Methods

**User Roles Tested:**
- ✅ Admin (full access)
- ✅ Accountant (full access)
- ✅ Data Entry (read-only)

---

## Notes

- All forms are keyboard-friendly (Tab navigation, Enter to submit)
- Archive action uses soft delete (sets isActive=false)
- Inline editing used for Vendors, Cost Heads, Payment Methods
- Separate pages used for Projects (new/edit)
- Sidebar navigation hides Companies for non-admin
- Sidebar shows ✏️ icon for write-enabled resources
- All pages use consistent DashboardLayout with sidebar
