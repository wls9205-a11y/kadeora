import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(',');
  const body = rows.map(r => columns.map(c => {
    const v = r[c];
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
  }).join(',')).join('\n');
  return `\uFEFF${header}\n${body}`; // BOM for Excel Korean
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'unsold';
  const region = searchParams.get('region');
  const sb = getSupabaseAdmin();

  try {
    if (type === 'unsold') {
      // 미분양 현황
      let q = (sb as any).from('unsold_apts').select('region_nm, house_nm, tot_unsold_hshld_co, sale_price_min, sale_price_max, created_at').order('region_nm');
      if (region) q = q.eq('region_nm', region);
      const { data } = await q.limit(5000);
      const csv = toCSV(data || [], ['region_nm', 'house_nm', 'tot_unsold_hshld_co', 'sale_price_min', 'sale_price_max', 'created_at']);
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="kadeora-unsold-${new Date().toISOString().split('T')[0]}.csv"`, 'Cache-Control': 'public, s-maxage=3600' } });
    }

    if (type === 'trade') {
      // 실거래가
      let q = (sb as any).from('apt_transactions').select('apt_name, region, sigungu, dong, area_sqm, deal_amount, deal_date, floor').order('deal_date', { ascending: false });
      if (region) q = q.eq('region', region);
      const { data } = await q.limit(5000);
      const csv = toCSV(data || [], ['apt_name', 'region', 'sigungu', 'dong', 'area_sqm', 'deal_amount', 'deal_date', 'floor']);
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="kadeora-trade-${region || 'all'}-${new Date().toISOString().split('T')[0]}.csv"`, 'Cache-Control': 'public, s-maxage=3600' } });
    }

    if (type === 'stock') {
      // 주식 종목 목록
      const { data } = await sb.from('stock_quotes').select('symbol, name, market, sector, price, change_pct, market_cap, volume, updated_at').gt('price', 0).order('market_cap', { ascending: false }).limit(1000);
      const csv = toCSV(data || [], ['symbol', 'name', 'market', 'sector', 'price', 'change_pct', 'market_cap', 'volume', 'updated_at']);
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="kadeora-stocks-${new Date().toISOString().split('T')[0]}.csv"`, 'Cache-Control': 'public, s-maxage=3600' } });
    }

    return NextResponse.json({ error: 'type must be unsold, trade, or stock' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
