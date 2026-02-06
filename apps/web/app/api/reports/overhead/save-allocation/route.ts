import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { saveAllocation } from '@/lib/reports/overhead';

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'vouchers', 'WRITE');

    const body = await request.json();
    const { month, method, results, totalOverhead } = body;

    if (!month || !method || !results || totalOverhead === undefined) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Month, method, results, and totalOverhead are required',
        },
        { status: 400 }
      );
    }

    const monthDate = new Date(month + '-01');
    await saveAllocation(auth.companyId, auth.userId, monthDate, method, results, totalOverhead);

    return NextResponse.json({
      ok: true,
      message: 'Allocation saved successfully',
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
