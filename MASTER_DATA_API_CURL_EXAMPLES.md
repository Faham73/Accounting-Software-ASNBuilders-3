# Master Data API - cURL Examples

## Prerequisites

1. Get authentication token by logging in:
```bash
# Login as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"123456"}' \
  -c cookies.txt

# Login as read-only user (VIEWER)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"viewer@example.com","password":"123456"}' \
  -c cookies.txt
```

**Note:** Replace `http://localhost:3000` with your actual server URL.

---

## Projects API

### GET /api/projects (List Projects)

```bash
# List all active projects
curl -X GET "http://localhost:3000/api/projects" \
  -b cookies.txt

# Search projects by name
curl -X GET "http://localhost:3000/api/projects?q=test" \
  -b cookies.txt

# Filter by status
curl -X GET "http://localhost:3000/api/projects?status=RUNNING" \
  -b cookies.txt

# Include inactive projects
curl -X GET "http://localhost:3000/api/projects?active=false" \
  -b cookies.txt

# Combined filters
curl -X GET "http://localhost:3000/api/projects?q=project&status=DRAFT&active=true" \
  -b cookies.txt
```

### GET /api/projects/[id] (Get Single Project)

```bash
# Replace {id} with actual project ID
curl -X GET "http://localhost:3000/api/projects/clxxx1234567890" \
  -b cookies.txt
```

### POST /api/projects (Create Project)

```bash
# Minimal project
curl -X POST "http://localhost:3000/api/projects" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "New Project"
  }'

# Full project with all fields
curl -X POST "http://localhost:3000/api/projects" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Construction Project Alpha",
    "clientName": "ABC Corp",
    "clientContact": "john@abc.com",
    "siteLocation": "123 Main St",
    "startDate": "2024-01-15T00:00:00Z",
    "expectedEndDate": "2024-12-31T00:00:00Z",
    "contractValue": 500000.50,
    "status": "RUNNING",
    "assignedManager": "Manager Name",
    "isActive": true
  }'
```

### PATCH /api/projects/[id] (Update Project)

```bash
# Update project name
curl -X PATCH "http://localhost:3000/api/projects/clxxx1234567890" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Updated Project Name"
  }'

# Update status
curl -X PATCH "http://localhost:3000/api/projects/clxxx1234567890" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status": "COMPLETED"
  }'

# Update multiple fields
curl -X PATCH "http://localhost:3000/api/projects/clxxx1234567890" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Updated Name",
    "status": "CLOSED",
    "contractValue": 600000
  }'
```

### DELETE /api/projects/[id] (Soft Delete)

```bash
curl -X DELETE "http://localhost:3000/api/projects/clxxx1234567890" \
  -b cookies.txt
```

---

## Vendors API

### GET /api/vendors (List Vendors)

```bash
# List all active vendors
curl -X GET "http://localhost:3000/api/vendors" \
  -b cookies.txt

# Search vendors
curl -X GET "http://localhost:3000/api/vendors?q=supplier" \
  -b cookies.txt

# Include inactive vendors
curl -X GET "http://localhost:3000/api/vendors?active=false" \
  -b cookies.txt
```

### GET /api/vendors/[id]

```bash
curl -X GET "http://localhost:3000/api/vendors/clxxx1234567890" \
  -b cookies.txt
```

### POST /api/vendors (Create Vendor)

```bash
# Minimal vendor
curl -X POST "http://localhost:3000/api/vendors" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Vendor ABC"
  }'

# Full vendor
curl -X POST "http://localhost:3000/api/vendors" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Supplier XYZ",
    "phone": "+1234567890",
    "address": "456 Vendor St",
    "notes": "Preferred supplier",
    "isActive": true
  }'
```

### PATCH /api/vendors/[id] (Update Vendor)

```bash
curl -X PATCH "http://localhost:3000/api/vendors/clxxx1234567890" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Updated Vendor Name",
    "phone": "+9876543210"
  }'
```

### DELETE /api/vendors/[id] (Soft Delete)

```bash
curl -X DELETE "http://localhost:3000/api/vendors/clxxx1234567890" \
  -b cookies.txt
```

---

## Cost Heads API

### GET /api/cost-heads (List Cost Heads)

```bash
# List all active cost heads
curl -X GET "http://localhost:3000/api/cost-heads" \
  -b cookies.txt

# Search cost heads
curl -X GET "http://localhost:3000/api/cost-heads?q=materials" \
  -b cookies.txt

# Include inactive
curl -X GET "http://localhost:3000/api/cost-heads?active=false" \
  -b cookies.txt
```

### GET /api/cost-heads/[id]

```bash
curl -X GET "http://localhost:3000/api/cost-heads/clxxx1234567890" \
  -b cookies.txt
```

### POST /api/cost-heads (Create Cost Head)

```bash
# Minimal cost head
curl -X POST "http://localhost:3000/api/cost-heads" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "New Cost Head"
  }'

# With code
curl -X POST "http://localhost:3000/api/cost-heads" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Materials",
    "code": "MAT"
  }'
```

### PATCH /api/cost-heads/[id] (Update Cost Head)

```bash
curl -X PATCH "http://localhost:3000/api/cost-heads/clxxx1234567890" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Updated Cost Head",
    "code": "UPD"
  }'
```

### DELETE /api/cost-heads/[id] (Soft Delete)

```bash
curl -X DELETE "http://localhost:3000/api/cost-heads/clxxx1234567890" \
  -b cookies.txt
```

---

## Payment Methods API

### GET /api/payment-methods (List Payment Methods)

```bash
# List all active payment methods
curl -X GET "http://localhost:3000/api/payment-methods" \
  -b cookies.txt

# Search payment methods
curl -X GET "http://localhost:3000/api/payment-methods?q=cash" \
  -b cookies.txt

# Include inactive
curl -X GET "http://localhost:3000/api/payment-methods?active=false" \
  -b cookies.txt
```

### GET /api/payment-methods/[id]

```bash
curl -X GET "http://localhost:3000/api/payment-methods/clxxx1234567890" \
  -b cookies.txt
```

### POST /api/payment-methods (Create Payment Method)

```bash
# Create payment method (type is required)
curl -X POST "http://localhost:3000/api/payment-methods" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Credit Card",
    "type": "BANK"
  }'

# Valid types: CASH, BANK, CHEQUE, MOBILE
curl -X POST "http://localhost:3000/api/payment-methods" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Mobile Wallet",
    "type": "MOBILE",
    "isActive": true
  }'
```

### PATCH /api/payment-methods/[id] (Update Payment Method)

```bash
curl -X PATCH "http://localhost:3000/api/payment-methods/clxxx1234567890" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Updated Payment Method",
    "type": "CASH"
  }'
```

### DELETE /api/payment-methods/[id] (Soft Delete)

```bash
curl -X DELETE "http://localhost:3000/api/payment-methods/clxxx1234567890" \
  -b cookies.txt
```

---

## Error Response Examples

### 401 Unauthorized (No Auth Token)
```json
{
  "ok": false,
  "error": "Authentication required"
}
```

### 403 Forbidden (No Permission)
```json
{
  "ok": false,
  "error": "You do not have permission to WRITE projects"
}
```

### 404 Not Found
```json
{
  "ok": false,
  "error": "Project not found"
}
```

### 400 Validation Error
```json
{
  "ok": false,
  "error": "Project name is required"
}
```

### 409 Conflict (Duplicate)
```json
{
  "ok": false,
  "error": "A cost head with this name already exists"
}
```

---

## Testing with Different Roles

### As Admin (Full Access)
```bash
# Login as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"123456"}' \
  -c admin_cookies.txt

# Can read and write
curl -X GET "http://localhost:3000/api/projects" -b admin_cookies.txt
curl -X POST "http://localhost:3000/api/projects" \
  -H "Content-Type: application/json" \
  -b admin_cookies.txt \
  -d '{"name":"Test Project"}'
```

### As VIEWER (Read-Only)
```bash
# Login as viewer
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"viewer@example.com","password":"123456"}' \
  -c viewer_cookies.txt

# Can read
curl -X GET "http://localhost:3000/api/projects" -b viewer_cookies.txt

# Cannot write (will return 403)
curl -X POST "http://localhost:3000/api/projects" \
  -H "Content-Type: application/json" \
  -b viewer_cookies.txt \
  -d '{"name":"Test Project"}'
```

---

## Notes

- All endpoints require authentication (cookie-based)
- Company scoping is automatic (based on authenticated user's company)
- Soft delete sets `isActive=false` (doesn't actually delete records)
- Search (`q` parameter) is case-insensitive
- `active` filter defaults to `true` if not specified
- All timestamps are in ISO 8601 format
- Decimal values (like `contractValue`) are sent as numbers, not strings
