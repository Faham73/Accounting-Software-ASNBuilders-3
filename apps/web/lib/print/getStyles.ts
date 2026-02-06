/**
 * Get print styles as a string for inline use
 */
export function getPrintStyles(): string {
  return `
    @media print {
      @page {
        size: A4;
        margin: 1.5cm;
      }
      body {
        background: white;
        color: black;
        font-size: 11pt;
        line-height: 1.4;
      }
      .no-print, .print\\:hidden {
        display: none !important;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      thead {
        display: table-header-group;
      }
      tfoot {
        display: table-footer-group;
      }
      th, td {
        border: 1px solid #000;
        padding: 6px;
        text-align: left;
      }
      th {
        background-color: #f0f0f0 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        font-weight: bold;
      }
    }
    .print-layout {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20px;
      background: white;
      font-family: 'Times New Roman', serif;
    }
    .print-header {
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .print-footer {
      border-top: 1px solid #ccc;
      padding-top: 10px;
      margin-top: 20px;
      font-size: 9pt;
      color: #666;
      text-align: center;
    }
    .print-title {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .print-table {
      width: 100%;
      margin: 15px 0;
    }
    .print-table th {
      background-color: #f0f0f0;
      font-weight: bold;
      text-align: left;
    }
    .print-table td {
      padding: 8px;
    }
    .print-signatures {
      margin-top: 40px;
      display: flex;
      justify-content: space-between;
    }
    .print-signature-line {
      width: 200px;
      border-top: 1px solid #000;
      padding-top: 5px;
      text-align: center;
      font-size: 10pt;
    }
  `;
}
