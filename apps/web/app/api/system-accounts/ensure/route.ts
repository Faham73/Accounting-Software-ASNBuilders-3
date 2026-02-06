/**
 * POST /api/system-accounts/ensure
 * Internal endpoint to ensure system accounts exist for a company
 * This can be called on first access or during setup
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac';
import { ensureSystemAccounts } from '@/lib/systemAccounts.server';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    // Ensure system accounts for the authenticated user's company
    const accountIdMap = await ensureSystemAccounts(auth.companyId);

    return NextResponse.json({
      ok: true,
      message: 'System accounts ensured',
      data: {
        accountCount: Object.keys(accountIdMap).length,
        accountIds: accountIdMap,
      },
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
