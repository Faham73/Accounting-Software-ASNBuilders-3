import { redirect } from 'next/navigation';
import { prisma } from '@accounting/db';
import { COMPANY_INFO, formatDate, formatDateTime, toMoney } from '@/lib/print/format';
import { authenticateAndVerifyEntity } from '@/lib/print/auth';

export default async function PrintVoucherPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { pdfToken?: string };
}) {
  let auth;
  try {
    auth = await authenticateAndVerifyEntity(
      searchParams,
      { resource: 'vouchers', action: 'READ' },
      'voucher',
      params.id
    );
  } catch (error) {
    redirect('/forbidden');
  }

  const voucher = await prisma.voucher.findUnique({
    where: { id: params.id },
    include: {
      company: {
        select: { id: true, name: true },
      },
      project: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      submittedBy: {
        select: { id: true, name: true, email: true },
      },
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
      postedBy: {
        select: { id: true, name: true, email: true },
      },
      lines: {
        include: {
          account: {
            select: { id: true, code: true, name: true },
          },
          project: {
            select: { id: true, name: true },
          },
          vendor: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!voucher || voucher.companyId !== auth.companyId) {
    redirect('/dashboard/vouchers');
  }

  const totalDebit = voucher.lines.reduce((sum, line) => sum + Number(line.debit), 0);
  const totalCredit = voucher.lines.reduce((sum, line) => sum + Number(line.credit), 0);
  
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

      {/* Voucher Title */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '18pt', margin: '10px 0' }}>VOUCHER</h1>
      </div>

      {/* Voucher Details */}
      <div style={{ marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '5px', width: '30%', fontWeight: 'bold' }}>Voucher No:</td>
                  <td style={{ padding: '5px' }}>{voucher.voucherNo}</td>
                  <td style={{ padding: '5px', width: '30%', fontWeight: 'bold' }}>Date:</td>
                  <td style={{ padding: '5px' }}>{formatDate(voucher.date)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '5px', fontWeight: 'bold' }}>Type:</td>
                  <td style={{ padding: '5px' }}>{voucher.type || 'JOURNAL'}</td>
                  <td style={{ padding: '5px', fontWeight: 'bold' }}>Status:</td>
                  <td style={{ padding: '5px' }}>{voucher.status}</td>
                </tr>
                {voucher.project && (
                  <tr>
                    <td style={{ padding: '5px', fontWeight: 'bold' }}>Project:</td>
                    <td style={{ padding: '5px' }} colSpan={3}>{voucher.project.name}</td>
                  </tr>
                )}
                {voucher.narration && (
                  <tr>
                    <td style={{ padding: '5px', fontWeight: 'bold' }}>Narration:</td>
                    <td style={{ padding: '5px' }} colSpan={3}>{voucher.narration}</td>
                  </tr>
                )}
              </tbody>
      </table>
      </div>

      {/* Voucher Lines */}
      <table className="print-table" style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '20px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Account</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Description</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>Debit</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {voucher.lines.map((line, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #000', padding: '8px' }}>
                    {line.account.code} - {line.account.name}
                    {line.project && (
                      <div style={{ fontSize: '9pt', color: '#666' }}>Project: {line.project.name}</div>
                    )}
                    {line.vendor && (
                      <div style={{ fontSize: '9pt', color: '#666' }}>Vendor: {line.vendor.name}</div>
                    )}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px' }}>{line.description || '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                    {Number(line.debit) > 0 ? toMoney(line.debit) : '-'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                    {Number(line.credit) > 0 ? toMoney(line.credit) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold' }}>
                <td colSpan={2} style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  Totals:
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {toMoney(totalDebit)}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                  {toMoney(totalCredit)}
                </td>
              </tr>
      </tfoot>
      </table>

      {/* Signatures */}
      <div className="print-signatures" style={{ marginTop: '40px' }}>
        <div className="print-signature-line">
          <div>Prepared by:</div>
          <div style={{ marginTop: '30px' }}>{voucher.createdBy.name}</div>
        </div>
        {voucher.submittedBy && (
          <div className="print-signature-line">
            <div>Submitted by:</div>
            <div style={{ marginTop: '30px' }}>{voucher.submittedBy.name}</div>
          </div>
        )}
        {voucher.approvedBy && (
          <div className="print-signature-line">
            <div>Approved by:</div>
            <div style={{ marginTop: '30px' }}>{voucher.approvedBy.name}</div>
          </div>
        )}
        {voucher.postedBy && (
          <div className="print-signature-line">
            <div>Posted by:</div>
            <div style={{ marginTop: '30px' }}>{voucher.postedBy.name}</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="print-footer">
        Generated on {generatedAt}
      </div>
    </div>
  );
}
