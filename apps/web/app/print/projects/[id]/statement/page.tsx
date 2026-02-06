import { redirect } from 'next/navigation';
import { prisma } from '@accounting/db';
import { COMPANY_INFO, formatDate, formatDateTime, formatPeriod, toMoney } from '@/lib/print/format';
import { getDateRange } from '@/lib/print/range';
import { decimalToNumber } from '@/lib/reports/helpers';
import { authenticateAndVerifyEntity } from '@/lib/print/auth';

export default async function PrintProjectStatementPage({
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
      { resource: 'projects', action: 'READ' },
      'project',
      params.id
    );
  } catch (error) {
    redirect('/forbidden');
  }

  const project = await prisma.project.findFirst({
    where: {
      id: params.id,
      companyId: auth.companyId,
    },
    select: {
      id: true,
      name: true,
      clientName: true,
      clientContact: true,
      contractValue: true,
    },
  });

  if (!project) {
    redirect('/dashboard/projects');
  }

  // Extract date params (exclude pdfToken)
  const dateParams = new URLSearchParams();
  if (searchParams.from) dateParams.set('from', searchParams.from);
  if (searchParams.to) dateParams.set('to', searchParams.to);
  const dateRange = getDateRange(dateParams);

  // Get all posted voucher lines for this project in date range
  const lines = await prisma.voucherLine.findMany({
    where: {
      projectId: params.id,
      companyId: auth.companyId,
      voucher: {
        status: { in: ['POSTED', 'REVERSED'] },
        date: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
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
          type: true,
        },
      },
    },
    orderBy: [
      { voucher: { date: 'asc' } },
      { voucher: { voucherNo: 'asc' } },
      { createdAt: 'asc' },
    ],
  });

  // Calculate totals
  let totalIncome = 0;
  let totalExpense = 0;
  let runningBalance = 0;

  const statementLines = lines.map((line) => {
    const debit = decimalToNumber(line.debit);
    const credit = decimalToNumber(line.credit);

    // Income accounts: credit increases income
    if (line.account.type === 'INCOME') {
      totalIncome += credit - debit;
    }
    // Expense accounts: debit increases expense
    if (line.account.type === 'EXPENSE') {
      totalExpense += debit - credit;
    }

    // Running balance (net impact)
    const impact = credit - debit;
    runningBalance += impact;

    return {
      date: line.voucher.date,
      voucherNo: line.voucher.voucherNo,
      type: line.voucher.type,
      narration: line.voucher.narration || line.description || '',
      accountCode: line.account.code,
      accountName: line.account.name,
      accountType: line.account.type,
      debit,
      credit,
      impact,
      runningBalance,
    };
  });

  const netProfit = totalIncome - totalExpense;
  
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
        <h1 style={{ fontSize: '18pt', margin: '10px 0' }}>PROJECT STATEMENT</h1>
      </div>

      {/* Project Info */}
      <div style={{ marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '5px', width: '30%', fontWeight: 'bold' }}>Project:</td>
                  <td style={{ padding: '5px' }}>{project.name}</td>
                </tr>
                {project.clientName && (
                  <tr>
                    <td style={{ padding: '5px', fontWeight: 'bold' }}>Client:</td>
                    <td style={{ padding: '5px' }}>{project.clientName}</td>
                  </tr>
                )}
                {project.contractValue && (
                  <tr>
                    <td style={{ padding: '5px', fontWeight: 'bold' }}>Contract Value:</td>
                    <td style={{ padding: '5px' }}>{toMoney(project.contractValue)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '5px', fontWeight: 'bold' }}>Period:</td>
                  <td style={{ padding: '5px' }}>{formatPeriod(dateRange.from, dateRange.to)}</td>
                </tr>
      </tbody>
      </table>
      </div>

      {/* Summary Totals */}
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f9f9f9', border: '1px solid #ccc' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '5px', fontWeight: 'bold', width: '50%' }}>Total Income:</td>
                  <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>
                    {toMoney(totalIncome)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '5px', fontWeight: 'bold' }}>Total Expense:</td>
                  <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>
                    {toMoney(totalExpense)}
                  </td>
                </tr>
                <tr style={{ borderTop: '2px solid #000' }}>
                  <td style={{ padding: '5px', fontWeight: 'bold' }}>Net Profit/Loss:</td>
                  <td style={{ padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>
                    {toMoney(netProfit)}
                  </td>
                </tr>
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
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Type</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Narration</th>
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
                  <td style={{ border: '1px solid #000', padding: '8px' }}>{line.type || '-'}</td>
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
                <td colSpan={4} style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  Totals:
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {toMoney(statementLines.reduce((sum, l) => sum + l.debit, 0))}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {toMoney(statementLines.reduce((sum, l) => sum + l.credit, 0))}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {toMoney(runningBalance)}
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
