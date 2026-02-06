import { redirect } from 'next/navigation';
import { requirePermissionServer } from '@/lib/rbac';
import { getAccountLedger, findBankAccounts } from '@/lib/reports/ledger';
import DashboardLayout from '@/app/dashboard/components/DashboardLayout';
import BankBookClient from './BankBookClient';
import { dateRange } from '@/lib/reports/helpers';

export default async function BankBookPage({
  searchParams,
}: {
  searchParams: { accountId?: string; from?: string; to?: string };
}) {
  let auth;
  try {
    auth = await requirePermissionServer('vouchers', 'READ');
  } catch (error) {
    redirect('/forbidden');
  }

  // Find bank accounts
  const bankAccounts = await findBankAccounts(auth.companyId);

  if (bankAccounts.length === 0) {
    return (
      <DashboardLayout title="Bank Book">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            No bank accounts found. Please create an account with "Bank" in the name.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  // Determine account to use
  const accountId = searchParams.accountId || bankAccounts[0]?.id;
  const selectedAccount = bankAccounts.find((a) => a.id === accountId) || bankAccounts[0];

  // Parse dates
  const today = new Date();
  const fromDate = searchParams.from
    ? new Date(searchParams.from)
    : new Date(today.getFullYear(), today.getMonth(), 1);
  const toDate = searchParams.to ? new Date(searchParams.to) : today;

  const { from, to } = dateRange(fromDate, toDate);

  // Get ledger data
  const ledgerData = await getAccountLedger(selectedAccount.id, auth.companyId, from, to);

  return (
    <DashboardLayout title="Bank Book">
      <BankBookClient
        initialData={ledgerData}
        availableAccounts={bankAccounts}
        selectedAccountId={accountId}
        fromDate={fromDate.toISOString().split('T')[0]}
        toDate={toDate.toISOString().split('T')[0]}
      />
    </DashboardLayout>
  );
}
