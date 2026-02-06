import { redirect } from 'next/navigation';
import { getVendorLedger, getVendorGLBalance, getVendorOpenBalance } from '@/lib/payables';
import { COMPANY_INFO, formatDate, formatDateTime, formatPeriod, toMoney } from '@/lib/print/format';
import { getDateRange } from '@/lib/print/range';
import { prisma } from '@accounting/db';
import { authenticateAndVerifyEntity } from '@/lib/print/auth';

export default async function PrintVendorStatementPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string; to?: string; pdfToken?: string };
}) {
  let auth;
  try {
    auth = await authenticateAndVerifyEntity(
      searchParams,
      { resource: 'vouchers', action: 'READ' },
      'vendor',
      params.id
    );
  } catch (error) {
    redirect('/forbidden');
  }

  const vendor = await prisma.vendor.findFirst({
    where: {
      id: params.id,
      companyId: auth.companyId,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
    },
  });

  if (!vendor) {
    redirect('/dashboard/vendors');
  }

  // Extract date params (exclude pdfToken)
  const dateParams = new URLSearchParams();
  if (searchParams.from) dateParams.set('from', searchParams.from);
  if (searchParams.to) dateParams.set('to', searchParams.to);
  const dateRange = getDateRange(dateParams);

  // Get all posted voucher lines for this vendor
  const allLines = await prisma.voucherLine.findMany({
    where: {
      vendorId: params.id,
      companyId: auth.companyId,
      voucher: {
        status: { in: ['POSTED', 'REVERSED'] },
      },
    },
    include: {
      voucher: {
        select: {
          id: true,
          voucherNo: true,
          date: true,
          type: true,
          narration: true,
        },
      },
      account: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
    orderBy: [
      { voucher: { date: 'asc' } },
      { voucher: { voucherNo: 'asc' } },
      { createdAt: 'asc' },
    ],
  });

  // Calculate opening balance (before date range)
  let openingBalance = 0;
  allLines.forEach((line) => {
    if (line.voucher.date < dateRange.from) {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      openingBalance += credit - debit; // AP increases with credit
    }
  });

  // Filter lines in date range
  const periodLines = allLines.filter(
    (line) => line.voucher.date >= dateRange.from && line.voucher.date <= dateRange.to
  );

  // Calculate running balance
  let runningBalance = openingBalance;
  const statementLines = periodLines.map((line) => {
    const debit = Number(line.debit);
    const credit = Number(line.credit);
    const impact = credit - debit; // AP increases with credit
    runningBalance += impact;

    return {
      date: line.voucher.date,
      voucherNo: line.voucher.voucherNo,
      type: line.voucher.type,
      narration: line.voucher.narration || line.description || '',
      accountCode: line.account.code,
      accountName: line.account.name,
      debit,
      credit,
      impact,
      runningBalance,
    };
  });

  const closingBalance = runningBalance;
  const totalDebit = statementLines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = statementLines.reduce((sum, l) => sum + l.credit, 0);

  // Get open balance (outstanding payables)
  const openBalance = await getVendorOpenBalance(params.id, auth.companyId);
  
  // Compute generated date server-side
  const generatedAt = formatDateTime(new Date());

  return (
    <div className="print-layout">
      {/* Header */}
      <div className="print-header">
        <div className="print-title">{COMPANY_INFO.name}</div>
        <div style={{ fontSize: '10pt', color: '#666' }}>
          {COMPANY_INFO.address} | {COMPANY_INFO.phone}
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18pt', margin: '10px 0' }}>VENDOR STATEMENT</h1>
      </div>

      {/* Vendor Info */}
      <div style={{ marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '5px', width: '30%', fontWeight: 'bold' }}>Vendor:</td>
                  <td style={{ padding: '5px' }}>{vendor.name}</td>
                </tr>
                {vendor.address && (
                  <tr>
                    <td style={{ padding: '5px', fontWeight: 'bold' }}>Address:</td>
                    <td style={{ padding: '5px' }}>{vendor.address}</td>
                  </tr>
                )}
                {vendor.phone && (
                  <tr>
                    <td style={{ padding: '5px', fontWeight: 'bold' }}>Phone:</td>
                    <td style={{ padding: '5px' }}>{vendor.phone}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '5px', fontWeight: 'bold' }}>Period:</td>
                  <td style={{ padding: '5px' }}>{formatPeriod(dateRange.from, dateRange.to)}</td>
                </tr>
      </tbody>
      </table>
      </div>

      {/* Summary */}
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f9f9f9', border: '1px solid #ccc' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '5px', fontWeight: 'bold', width: '50%' }}>Opening Balance:</td>
                  <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>
                    {toMoney(openingBalance)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '5px', fontWeight: 'bold' }}>Closing Balance:</td>
                  <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>
                    {toMoney(closingBalance)}
                  </td>
                </tr>
                {openBalance > 0 && (
                  <tr>
                    <td style={{ padding: '5px', fontWeight: 'bold' }}>Outstanding Payables:</td>
                    <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>
                      {toMoney(openBalance)}
                    </td>
                  </tr>
                )}
      </tbody>
      </table>
      </div>

      {/* Transaction Details */}
      <h2 style={{ fontSize: '14pt', marginBottom: '10px' }}>Transaction Details</h2>
      <table className="print-table" style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '20px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Date</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Voucher No</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Description</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>Debit</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>Credit</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {statementLines.map((line, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #000', padding: '8px' }}>
                    {formatDate(line.date)}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px' }}>{line.voucherNo}</td>
                  <td style={{ border: '1px solid #000', padding: '8px' }}>
                    {line.narration}
                    <div style={{ fontSize: '9pt', color: '#666' }}>
                      {line.accountCode} - {line.accountName}
                    </div>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                    {line.debit > 0 ? toMoney(line.debit) : '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                    {line.credit > 0 ? toMoney(line.credit) : '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                    {toMoney(line.runningBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold' }}>
                <td colSpan={3} style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  Totals:
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {toMoney(totalDebit)}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {toMoney(totalCredit)}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {toMoney(closingBalance)}
                </td>
              </tr>
      </tfoot>
      </table>

      {/* Footer */}
      <div className="print-footer">
        Generated on {generatedAt} | Only POSTED and REVERSED vouchers are included
      </div>
    </div>
  );
}
