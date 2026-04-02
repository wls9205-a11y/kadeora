import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

interface ExportOptions {
  data: Record<string, unknown>[];
  headers: string[];
  filename: string;
  sheetName?: string;
}

function toCSV(data: Record<string, unknown>[], headers: string[]): string {
  const rows = data.map(r =>
    Object.keys(r).map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

function toXLSX(data: Record<string, unknown>[], headers: string[], sheetName: string): Uint8Array {
  const ws = XLSX.utils.json_to_sheet(data.map(r => {
    const obj: Record<string, unknown> = {};
    const keys = Object.keys(r);
    keys.forEach((k, i) => { obj[headers[i] || k] = r[k]; });
    return obj;
  }));
  // 컬럼 너비 자동 조정
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length * 2, 12) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(buf);
}

export function exportData(opts: ExportOptions, format: string): NextResponse {
  const { data, headers, filename, sheetName = '데이터' } = opts;

  if (format === 'xlsx') {
    const buf = toXLSX(data, headers, sheetName);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}_${new Date().toISOString().slice(0,10)}.xlsx"`,
      },
    });
  }

  // Default: CSV
  const csv = toCSV(data, headers);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}_${new Date().toISOString().slice(0,10)}.csv"`,
    },
  });
}
