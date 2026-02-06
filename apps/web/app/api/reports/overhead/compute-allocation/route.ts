import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { computeAllocation } from '@/lib/reports/overhead';

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    const body = await request.json();
    const { month, method, allocations } = body;

    if (!month || !method) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Month and method are required',
        },
        { status: 400 }
      );
    }

    const monthDate = new Date(month + '-01');
    const result = await computeAllocation(auth.companyId, monthDate, method, allocations);

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
