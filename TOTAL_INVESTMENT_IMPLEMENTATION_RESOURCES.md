# Total Investment Implementation Resources

This document contains all existing "Total Investment" implementation resources (UI + API + DB + voucher posting).

---

## 1) ROUTES + PAGES (where Total Investment is shown)

### 1.1 Project Dashboard Card: "Total Investment" and "Click to add investment"

**File:** `apps/web/app/dashboard/projects/[id]/components/ProjectDashboardClient.tsx`

**Component that renders the card + onClick navigation:**

```tsx:161:174:apps/web/app/dashboard/projects/[id]/components/ProjectDashboardClient.tsx
        {/* Total Investments */}
        <div
          className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-purple-200"
          onClick={handleAddInvestment}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Total Investment</h3>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(totals.investments)}</p>
            </div>
            <div className="text-purple-500 text-3xl">💰</div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Click to add investment</p>
        </div>
```

**onClick handler:**

```tsx:75:77:apps/web/app/dashboard/projects/[id]/components/ProjectDashboardClient.tsx
  const handleAddInvestment = () => {
    setShowInvestmentModal(true);
  };
```

**Route it navigates to:** 
- **No navigation** - Opens a modal instead (see Investment Modal section below)

### 1.2 Navigation "Total Investment" (company-wide)

**File:** `apps/web/app/dashboard/components/DashboardLayout.tsx`

**Nav config:**

```tsx:148:155:apps/web/app/dashboard/components/DashboardLayout.tsx
              {canReadVouchers && (
                <>
                  <Link
                    href="/dashboard/investments"
                    className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    Total Investment
                  </Link>
```

**Page component it opens:**

**File:** `apps/web/app/dashboard/investments/page.tsx`

```tsx:1:19:apps/web/app/dashboard/investments/page.tsx
import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import DashboardLayout from '../components/DashboardLayout';
import InvestmentsClient from './InvestmentsClient';

export default async function InvestmentsPage() {
  let auth;
  try {
    auth = await requirePermissionServer('projects', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  return (
    <DashboardLayout title="Total Investment">
      <InvestmentsClient />
    </DashboardLayout>
  );
}
```

---

## 2) INVESTMENT LIST PAGE + FORM (current behavior)

### 2.1 Investment List/Table Page(s)

**a) Company-level investments:**

**File:** `apps/web/app/dashboard/investments/InvestmentsClient.tsx`

**Full component:**

```tsx:1:267:apps/web/app/dashboard/investments/InvestmentsClient.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Investment {
  id: string;
  date: string;
  amount: number;
  note: string | null;
  project: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
}

interface InvestmentsResponse {
  ok: boolean;
  data: Investment[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  totals: {
    investments: number;
  };
}

interface Project {
  id: string;
  name: string;
}

export default function InvestmentsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });

  const [filters, setFilters] = useState({
    projectId: searchParams.get('projectId') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
  });

  useEffect(() => {
    loadProjects();
    loadInvestments();
  }, []);

  useEffect(() => {
    loadInvestments();
  }, [filters, pagination.page]);

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.ok) {
        setProjects(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load projects', err);
    }
  };

  const loadInvestments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.projectId) params.set('projectId', filters.projectId);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      params.set('page', pagination.page.toString());
      params.set('pageSize', pagination.pageSize.toString());

      const response = await fetch(`/api/investments?${params.toString()}`);
      const data: InvestmentsResponse = await response.json();
      if (data.ok) {
        setInvestments(data.data);
        setTotal(data.totals.investments);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to load investments', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-BD');
  };

  return (
    <div>
      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-2 border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Investment</h3>
            <p className="text-3xl font-bold text-purple-600">{formatCurrency(total)}</p>
          </div>
          <div className="text-purple-500 text-4xl">💰</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select
              value={filters.projectId}
              onChange={(e) => handleFilterChange('projectId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ projectId: '', dateFrom: '', dateTo: '' });
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : investments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No investments found</div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Note
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {investments.map((investment) => (
                  <tr key={investment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(investment.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {investment.project.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                      {formatCurrency(investment.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {investment.note || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {investment.createdBy.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                  {pagination.total} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

**b) Project-level investments:**

**Note:** There is **NO separate project-level investment list page**. Investments are only shown in the company-wide list (`/dashboard/investments`) with optional project filter.

### 2.2 "Add Investment" Form/Modal/Page Component(s)

**File:** `apps/web/app/dashboard/projects/[id]/components/ProjectDashboardClient.tsx`

**Investment Modal:**

```tsx:252:311:apps/web/app/dashboard/projects/[id]/components/ProjectDashboardClient.tsx
      {/* Investment Modal */}
      {showInvestmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add Investment</h2>
            <form onSubmit={handleInvestmentSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  name="date"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  name="amount"
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note (optional)
                </label>
                <textarea
                  name="note"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
                >
                  Add Investment
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvestmentModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
```

**Form submission handler:**

```tsx:83:110:apps/web/app/dashboard/projects/[id]/components/ProjectDashboardClient.tsx
  const handleInvestmentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      date: formData.get('date'),
      amount: parseFloat(formData.get('amount') as string),
      note: formData.get('note') || null,
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/investments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (result.ok) {
        setShowInvestmentModal(false);
        loadTotals();
        (e.target as HTMLFormElement).reset();
      } else {
        alert(result.error || 'Failed to create investment');
      }
    } catch (err) {
      alert('Failed to create investment');
    }
  };
```

### 2.3 Shared Components Used

**None found** - The investment list uses standard table markup, no shared column/filter/dialog components.

---

## 3) API / SERVER ACTIONS

### 3.1 GET List Investments (Company-wide)

**File:** `apps/web/app/api/investments/route.ts`

**Full code:**

```tsx:1:104:apps/web/app/api/investments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  requirePermission,
  createErrorResponse,
  ForbiddenError,
  UnauthorizedError,
} from '@/lib/rbac';
import { prisma } from '@accounting/db';
import { ProjectInvestmentListFiltersSchema } from '@accounting/shared';
import { ZodError } from 'zod';
import { getCompanyTotals } from '@/lib/projects/projectTotals.server';

/**
 * GET /api/investments
 * List investments company-wide with optional project filter
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'projects', 'READ');

    const { searchParams } = new URL(request.url);
    const filters = ProjectInvestmentListFiltersSchema.parse({
      projectId: searchParams.get('projectId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '25',
    });

    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 25;

    const where: any = {
      companyId: auth.companyId,
    };

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.date.lte = filters.dateTo;
      }
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [investments, total, totals] = await Promise.all([
      prisma.projectInvestment.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: {
          project: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.projectInvestment.count({ where }),
      getCompanyTotals(auth.companyId, filters.projectId),
    ]);

    return NextResponse.json({
      ok: true,
      data: investments,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      totals: {
        investments: totals.investments,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.errors[0]?.message || 'Validation error',
        },
        { status: 400 }
      );
    }
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}
```

### 3.2 GET List Investments (Project-specific)

**File:** `apps/web/app/api/projects/[id]/investments/route.ts`

**GET handler:**

```tsx:18:129:apps/web/app/api/projects/[id]/investments/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'READ');

    const { searchParams } = new URL(request.url);
    const filters = ProjectInvestmentListFiltersSchema.parse({
      projectId: params.id,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '25',
    });

    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 25;

    // Verify project belongs to company
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Project not found',
        },
        { status: 404 }
      );
    }

    const where: any = {
      companyId: auth.companyId,
      projectId: params.id,
    };

    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.date.lte = filters.dateTo;
      }
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [investments, total] = await Promise.all([
      prisma.projectInvestment.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: {
          project: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.projectInvestment.count({ where }),
    ]);

    const totals = await prisma.projectInvestment.aggregate({
      where,
      _sum: {
        amount: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: investments,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      totals: {
        total: totals._sum.amount?.toNumber() || 0,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.errors[0]?.message || 'Validation error',
        },
        { status: 400 }
      );
    }
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}
```

### 3.3 POST Create Investment

**File:** `apps/web/app/api/projects/[id]/investments/route.ts`

**Full POST handler:**

```tsx:131:220:apps/web/app/api/projects/[id]/investments/route.ts
/**
 * POST /api/projects/[id]/investments
 * Create a new investment for a project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePermission(request, 'projects', 'WRITE');

    const body = await request.json();
    const validatedData = ProjectInvestmentCreateSchema.parse({
      ...body,
      projectId: params.id,
    });

    // Verify project exists and belongs to company
    const project = await prisma.project.findFirst({
      where: {
        id: params.id,
        companyId: auth.companyId,
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Project not found or does not belong to your company',
        },
        { status: 400 }
      );
    }

    const investment = await prisma.projectInvestment.create({
      data: {
        companyId: auth.companyId,
        projectId: params.id,
        date: validatedData.date,
        amount: new Prisma.Decimal(validatedData.amount),
        note: validatedData.note || null,
        createdByUserId: auth.userId,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await createAuditLog({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      entityType: 'ProjectInvestment',
      entityId: investment.id,
      action: 'CREATE',
      after: investment,
      request,
    });

    return NextResponse.json(
      {
        ok: true,
        data: investment,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.errors[0]?.message || 'Validation error',
        },
        { status: 400 }
      );
    }
    if (error instanceof UnauthorizedError) {
      return createErrorResponse(error, 401);
    }
    if (error instanceof ForbiddenError) {
      return createErrorResponse(error, 403);
    }
    return createErrorResponse(error instanceof Error ? error : new Error('Unknown error'), 500);
  }
}
```

### 3.4 PUT/PATCH Update Investment

**DOES NOT EXIST** - No update endpoint found.

### 3.5 DELETE Investment

**DOES NOT EXIST** - No delete endpoint found.

---

## 4) DATABASE / PRISMA

### 4.1 Investment Model

**File:** `packages/db/prisma/schema.prisma`

**Full model:**

```prisma:786:806:packages/db/prisma/schema.prisma
model ProjectInvestment {
  id        String   @id @default(cuid())
  companyId String   @map("company_id")
  projectId String   @map("project_id")
  date      DateTime
  amount    Decimal  @db.Decimal(18, 2)
  note      String?
  createdByUserId String @map("created_by_user_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  company   Company @relation(fields: [companyId], references: [id])
  project   Project @relation(fields: [projectId], references: [id])
  createdBy User    @relation("ProjectInvestmentCreator", fields: [createdByUserId], references: [id])

  @@index([companyId])
  @@index([companyId, projectId])
  @@index([companyId, projectId, date])
  @@index([projectId])
  @@map("project_investments")
}
```

### 4.2 Related Models

**Voucher Model:**

```prisma:332:382:packages/db/prisma/schema.prisma
model Voucher {
  id              String        @id @default(cuid())
  companyId       String        @map("company_id")
  projectId       String?       @map("project_id")
  voucherNo       String        @map("voucher_no")
  type            VoucherType?  @default(JOURNAL)
  expenseType     ExpenseType?  @map("expense_type")
  date            DateTime
  status          VoucherStatus @default(DRAFT)
  narration       String?
  createdByUserId String        @map("created_by_user_id")
  
  // Workflow fields
  submittedAt     DateTime?     @map("submitted_at")
  submittedById   String?       @map("submitted_by_id")
  approvedAt      DateTime?     @map("approved_at")
  approvedById    String?       @map("approved_by_id")
  postedByUserId  String?       @map("posted_by_user_id")
  postedAt        DateTime?     @map("posted_at")
  
  // Reversal fields
  reversalOfId    String?       @map("reversal_of_id")
  reversedById    String?       @map("reversed_by_id")
  reversedAt      DateTime?     @map("reversed_at")
  
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  company         Company            @relation(fields: [companyId], references: [id])
  project         Project?           @relation(fields: [projectId], references: [id])
  createdBy       User               @relation("VoucherCreator", fields: [createdByUserId], references: [id])
  submittedBy     User?              @relation("VoucherSubmitter", fields: [submittedById], references: [id])
  approvedBy      User?              @relation("VoucherApprover", fields: [approvedById], references: [id])
  postedBy        User?              @relation("VoucherPoster", fields: [postedByUserId], references: [id])
  reversedBy      User?              @relation("VoucherReverser", fields: [reversedById], references: [id])
  originalVoucher Voucher?          @relation("VoucherReversal", fields: [reversalOfId], references: [id])
  reversalVouchers Voucher[]         @relation("VoucherReversal")
  purchase        Purchase?          @relation("PurchaseVoucher")
  expense         Expense?           @relation("ExpenseVoucher")
  lines           VoucherLine[]
  allocations     VendorAllocation[] @relation("PaymentVoucher")

  @@unique([companyId, voucherNo])
  @@index([companyId, date])
  @@index([companyId, status])
  @@index([companyId, type])
  @@index([companyId, expenseType])
  @@index([reversalOfId])
  @@index([companyId, status, date])
  @@map("vouchers")
}
```

**VoucherLine Model:**

```prisma:384:422:packages/db/prisma/schema.prisma
model VoucherLine {
  id             String   @id @default(cuid())
  voucherId      String   @map("voucher_id")
  companyId      String   @map("company_id")
  accountId      String   @map("account_id")
  description    String?
  debit          Decimal  @default(0) @db.Decimal(18, 2)
  credit         Decimal  @default(0) @db.Decimal(18, 2)
  projectId      String?  @map("project_id")
  isCompanyLevel Boolean  @default(false) @map("is_company_level")
  vendorId       String?  @map("vendor_id")
  paymentMethodId String? @map("payment_method_id")
  // PDF fields
  workDetails    String?  @map("work_details")
  paidBy         String?  @map("paid_by")
  receivedBy     String?  @map("received_by")
  fileRef        String?  @map("file_ref")
  voucherRef     String?  @map("voucher_ref")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  voucher          Voucher            @relation(fields: [voucherId], references: [id], onDelete: Cascade)
  company          Company            @relation(fields: [companyId], references: [id])
  account          Account            @relation(fields: [accountId], references: [id])
  project          Project?           @relation(fields: [projectId], references: [id])
  vendor           Vendor?            @relation(fields: [vendorId], references: [id])
  paymentMethod    PaymentMethod?     @relation(fields: [paymentMethodId], references: [id])
  sourceAllocations VendorAllocation[] @relation("SourceLine")

  @@index([voucherId])
  @@index([companyId])
  @@index([accountId])
  @@index([vendorId])
  @@index([companyId, projectId])
  @@index([companyId, projectId, voucherId])
  @@index([companyId, vendorId])
  @@index([companyId, isCompanyLevel])
  @@map("voucher_lines")
}
```

**Account Model:**

```prisma:303:330:packages/db/prisma/schema.prisma
model Account {
  id        String      @id @default(cuid())
  companyId String      @map("company_id")
  code      String
  name      String
  type      AccountType
  parentId  String?     @map("parent_id")
  isActive  Boolean     @default(true) @map("is_active")
  isSystem  Boolean     @default(true) @map("is_system")
  locked    Boolean     @default(true)
  createdAt DateTime    @default(now()) @map("created_at")
  updatedAt DateTime    @updatedAt @map("updated_at")

  company      Company       @relation(fields: [companyId], references: [id])
  parent       Account?      @relation("AccountHierarchy", fields: [parentId], references: [id])
  children     Account[]     @relation("AccountHierarchy")
  voucherLines VoucherLine[]
  purchasePayments Purchase[] @relation("PurchasePaymentAccount")
  expenseDebitAccounts Expense[] @relation("ExpenseDebitAccount")
  expenseCreditAccounts Expense[] @relation("ExpenseCreditAccount")
  creditPayments Credit[] @relation("CreditPaymentAccount")

  @@unique([companyId, code])
  @@unique([companyId, name])
  @@index([companyId])
  @@index([parentId])
  @@map("accounts")
}
```

**Enums:**

```prisma:62:68:packages/db/prisma/schema.prisma
enum AccountType {
  ASSET
  LIABILITY
  INCOME
  EXPENSE
  EQUITY
}
```

```prisma:37:42:packages/db/prisma/schema.prisma
enum VoucherType {
  RECEIPT
  PAYMENT
  JOURNAL
  CONTRA
}
```

```prisma:54:60:packages/db/prisma/schema.prisma
enum VoucherStatus {
  DRAFT
  SUBMITTED
  APPROVED
  POSTED
  REVERSED
}
```

### 4.3 Migration SQL

**No migration SQL files found** - Prisma migrations are managed through Prisma's migration system (no separate SQL files in the repository).

---

## 5) ACCOUNTING POSTING (the MOST IMPORTANT)

### 5.1 Voucher Creation for Investment

**DOES NOT EXIST** - **Investments do NOT create vouchers automatically.**

When an investment is created via `POST /api/projects/[id]/investments`, it only creates a `ProjectInvestment` record. There is **no voucher creation logic** in the investment creation flow.

### 5.2 How Other Entities Create Vouchers (for reference)

**Example: Expense creates voucher automatically**

**File:** `apps/web/app/api/expenses/route.ts`

```tsx:360:403:apps/web/app/api/expenses/route.ts
    const voucherNo = await generateVoucherNumber(auth.companyId, expenseDate);

    // Create expense + voucher + voucher lines in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create voucher with POSTED status (direct posting for expenses)
      const voucher = await tx.voucher.create({
        data: {
          companyId: auth.companyId,
          projectId: validatedData.projectId,
          voucherNo,
          type: 'PAYMENT',
          date: expenseDate,
          status: 'POSTED', // Direct posting for expenses
          narration: `Expense: ${category.name} - ${validatedData.notes || 'No description'}`,
          createdByUserId: auth.userId,
          postedByUserId: auth.userId,
          postedAt: new Date(),
          lines: {
            create: [
              // Debit: Expense account
              {
                companyId: auth.companyId,
                accountId: validatedData.debitAccountId,
                description: `Expense: ${category.name}`,
                debit: validatedData.amount,
                credit: 0,
                projectId: validatedData.projectId,
                paymentMethodId: validatedData.paymentMethodId,
              },
              // Credit: Payment account (Cash/Bank/etc)
              {
                companyId: auth.companyId,
                accountId: validatedData.creditAccountId,
                description: `Payment for ${category.name}`,
                debit: 0,
                credit: validatedData.amount,
                projectId: validatedData.projectId,
                paymentMethodId: validatedData.paymentMethodId,
                vendorId: validatedData.vendorId || null,
              },
            ],
          },
        },
      });
```

### 5.3 Cash/Bank Account Selection

**DOES NOT EXIST** - No logic found for selecting cash/bank accounts for investments.

### 5.4 Owner Capital Account Selection/Mapping

**DOES NOT EXIST** - No logic found for selecting/mapping "Owner Capital" account for investments.

### 5.5 Default Account IDs

**DOES NOT EXIST** - No default account IDs (cash account id, bank account id, owner capital id) found in the codebase.

---

## 6) TYPES / VALIDATION

### 6.1 Zod Schemas

**File:** `packages/shared/src/schemas/investment.ts`

**Full schema file:**

```tsx:1:37:packages/shared/src/schemas/investment.ts
import { z } from 'zod';

/**
 * Schema for creating a project investment
 */
export const ProjectInvestmentCreateSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  date: z.coerce.date(),
  amount: z.number().positive('Amount must be positive'),
  note: z.string().optional().nullable(),
});

/**
 * Schema for updating a project investment
 */
export const ProjectInvestmentUpdateSchema = z.object({
  date: z.coerce.date().optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  note: z.string().optional().nullable(),
});

/**
 * Schema for filtering investments list
 */
export const ProjectInvestmentListFiltersSchema = z.object({
  projectId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
});

// Inferred TypeScript types
export type ProjectInvestmentCreate = z.infer<typeof ProjectInvestmentCreateSchema>;
export type ProjectInvestmentUpdate = z.infer<typeof ProjectInvestmentUpdateSchema>;
export type ProjectInvestmentListFilters = z.infer<typeof ProjectInvestmentListFiltersSchema>;
```

**Exported from shared package:**

**File:** `packages/shared/src/index.ts`

```tsx:141:149:packages/shared/src/index.ts
// Investment schemas
export {
  ProjectInvestmentCreateSchema,
  ProjectInvestmentUpdateSchema,
  ProjectInvestmentListFiltersSchema,
  type ProjectInvestmentCreate,
  type ProjectInvestmentUpdate,
  type ProjectInvestmentListFilters,
} from './schemas/investment';
```

### 6.2 DTO Mapping Code

**DOES NOT EXIST** - No DTO mapping code found. The API directly uses Prisma models and Zod schemas.

---

## 7) PERMISSIONS / RBAC

### 7.1 Permission Checks

**Viewing investments:**

**File:** `apps/web/app/api/investments/route.ts`
```tsx:19:19:apps/web/app/api/investments/route.ts
    const auth = await requirePermission(request, 'projects', 'READ');
```

**File:** `apps/web/app/api/projects/[id]/investments/route.ts`
```tsx:23:23:apps/web/app/api/projects/[id]/investments/route.ts
    const auth = await requirePermission(request, 'projects', 'READ');
```

**File:** `apps/web/app/dashboard/investments/page.tsx`
```tsx:9:9:apps/web/app/dashboard/investments/page.tsx
    auth = await requirePermissionServer('projects', 'READ');
```

**Creating investments:**

**File:** `apps/web/app/api/projects/[id]/investments/route.ts`
```tsx:140:140:apps/web/app/api/projects/[id]/investments/route.ts
    const auth = await requirePermission(request, 'projects', 'WRITE');
```

### 7.2 Permission Summary

- **READ investments:** Requires `projects:READ` permission
- **CREATE investments:** Requires `projects:WRITE` permission
- **UPDATE investments:** N/A (not implemented)
- **DELETE investments:** N/A (not implemented)

---

## SUMMARY

### What EXISTS:
✅ Project dashboard card showing "Total Investment"  
✅ Company-wide investment list page (`/dashboard/investments`)  
✅ Add Investment modal/form on project dashboard  
✅ GET `/api/investments` (company-wide list)  
✅ GET `/api/projects/[id]/investments` (project-specific list)  
✅ POST `/api/projects/[id]/investments` (create investment)  
✅ `ProjectInvestment` Prisma model  
✅ Zod schemas for create/update/list filters  
✅ Permission checks (`projects:READ` for view, `projects:WRITE` for create)  

### What DOES NOT EXIST:
❌ **Voucher creation for investments** (MOST IMPORTANT - missing)  
❌ PUT/PATCH update investment endpoint  
❌ DELETE investment endpoint  
❌ Cash/Bank account selection logic  
❌ Owner Capital account mapping  
❌ Default account IDs configuration  
❌ Project-level investment list page (only company-wide with filter)  
❌ Shared investment components (columns, filters, dialogs)  
❌ DTO mapping code  

---

**END OF DOCUMENT**
