import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 120;

// GET /api/admin/audit — 주식 시세 + 부동산 세부정보 전수조사
export async function GET(req: NextRequest) {
  const sbServer = await createSupabaseServer();
  const { data: { user } } = await sbServer.auth.getUser();
  if (!user) return NextResponse.json({ error: 'login required' }, { status: 401 });
  const sb = getSupabaseAdmin();
  const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'admin only' }, { status: 403 });

  const type = req.nextUrl.searchParams.get('type') || 'all';
  const results: Record<string, any> = {};

  // ═══ 1. 주식 전수조사 ═══
  if (type === 'all' || type === 'stock') {
    const { data: stocks } = await sb.from('stock_quotes')
      .select('symbol, name, market, price, change_pct, volume, market_cap, currency, updated_at, is_active')
      .eq('is_active', true)
      .order('market_cap', { ascending: false });

    const stockIssues: any[] = [];
    const now = Date.now();

    for (const s of (stocks || [])) {
      const issues: string[] = [];
      const price = Number(s.price);
      const marketCap = Number(s.market_cap);
      const changePct = Number(s.change_pct);
      const volume = Number(s.volume);
      const updatedAt = s.updated_at ? new Date(s.updated_at).getTime() : 0;
      const staleDays = Math.floor((now - updatedAt) / 86400000);

      if (price <= 0) issues.push('가격 0원');
      if (marketCap <= 0) issues.push('시총 0');
      if (Math.abs(changePct) > 30) issues.push(`등락률 이상: ${changePct}%`);
      if (volume <= 0 && price > 0) issues.push('거래량 0');
      if (staleDays > 3) issues.push(`${staleDays}일 미갱신`);
      if (!s.updated_at || s.updated_at.startsWith('2000')) issues.push('갱신일 없음');

      // 한국 주식 시총 상식 체크 (삼성전자 시총이 1조 미만이면 이상)
      if (s.symbol === '005930' && marketCap < 1e12) issues.push('삼성전자 시총 이상');
      if (s.symbol === '000660' && marketCap < 1e11) issues.push('SK하이닉스 시총 이상');

      if (issues.length > 0) {
        stockIssues.push({
          symbol: s.symbol, name: s.name, market: s.market,
          price, market_cap: marketCap, change_pct: changePct, volume,
          updated_at: s.updated_at?.slice(0, 19),
          issues,
        });
      }
    }

    // 시총 TOP 20 확인
    const top20 = (stocks || []).slice(0, 20).map(s => ({
      rank: (stocks || []).indexOf(s) + 1,
      symbol: s.symbol, name: s.name, market: s.market,
      price: Number(s.price).toLocaleString(),
      market_cap: Number(s.market_cap),
      market_cap_display: Number(s.market_cap) >= 1e12
        ? `${(Number(s.market_cap) / 1e12).toFixed(1)}조`
        : Number(s.market_cap) >= 1e8
          ? `${Math.round(Number(s.market_cap) / 1e8).toLocaleString()}억`
          : Number(s.market_cap).toLocaleString(),
      change_pct: Number(s.change_pct),
      updated: s.updated_at?.slice(0, 16),
    }));

    results.stock = {
      total: (stocks || []).length,
      issues_count: stockIssues.length,
      issues: stockIssues.slice(0, 50),
      top20,
      price_zero: (stocks || []).filter(s => Number(s.price) <= 0).length,
      market_cap_zero: (stocks || []).filter(s => Number(s.market_cap) <= 0).length,
      stale_3days: (stocks || []).filter(s => {
        const u = s.updated_at ? new Date(s.updated_at).getTime() : 0;
        return (now - u) > 3 * 86400000;
      }).length,
    };
  }

  // ═══ 2. 부동산 전수조사 ═══
  if (type === 'all' || type === 'apt') {
    // 2a. apt_subscriptions — 총세대수/공급세대 체크
    const { data: subs } = await (sb as any).from('apt_subscriptions')
      .select('id, house_nm, region_nm, tot_supply_hshld_co, total_households, general_supply_total, special_supply_total, house_type_info, constructor_nm, developer_nm, rcept_bgnde, mvn_prearnge_ym, project_type')
      .order('id', { ascending: false })
      .limit(500);

    const aptIssues: any[] = [];

    for (const a of (subs || [])) {
      const issues: string[] = [];
      const supply = Number(a.tot_supply_hshld_co) || 0;
      const totalHH = Number(a.total_households) || 0;
      const genSupply = Number(a.general_supply_total) || 0;
      const speSupply = Number(a.special_supply_total) || 0;
      const types = Array.isArray(a.house_type_info) ? a.house_type_info : [];
      const typesGenSum = types.reduce((s: number, t: any) => s + (Number(t.supply) || 0), 0);
      const typesSpeSum = types.reduce((s: number, t: any) => s + (Number(t.spsply_hshldco) || 0), 0);

      // 공급세대 0
      if (supply <= 0) issues.push('공급세대 0');

      // total_households가 tot_supply_hshld_co보다 작은 건 비정상 (총세대 > 공급세대)
      if (totalHH > 0 && supply > 0 && totalHH < supply) {
        issues.push(`총세대(${totalHH}) < 공급세대(${supply})`);
      }

      // general+special != tot_supply 불일치
      if (genSupply > 0 && speSupply > 0 && supply > 0) {
        const sum = genSupply + speSupply;
        if (Math.abs(sum - supply) > 2) {
          issues.push(`일반(${genSupply})+특별(${speSupply})=${sum} ≠ 공급(${supply})`);
        }
      }

      // house_type_info 합계 불일치
      if (types.length > 0 && supply > 0) {
        const typeTotal = typesGenSum + typesSpeSum;
        if (typeTotal > 0 && Math.abs(typeTotal - supply) > 2) {
          issues.push(`평형별합계(${typeTotal}) ≠ 공급(${supply})`);
        }
      }

      // 재개발/재건축인데 total_households 없음
      if ((a.project_type === '재개발' || a.project_type === '재건축') && !totalHH) {
        issues.push('재개발인데 총세대수 미입력');
      }

      // 시공사/시행사 없음
      if (!a.constructor_nm && !a.developer_nm) issues.push('시공사/시행사 없음');

      if (issues.length > 0) {
        aptIssues.push({
          id: a.id,
          name: a.house_nm,
          region: a.region_nm,
          supply,
          total_hh: totalHH,
          gen: genSupply,
          spe: speSupply,
          type_count: types.length,
          project_type: a.project_type,
          issues,
        });
      }
    }

    // 2b. apt_sites — content_score 낮은 현장
    const { data: sites } = await sb.from('apt_sites')
      .select('slug, name, region, total_units, content_score, site_type, is_active')
      .eq('is_active', true)
      .lt('content_score', 30)
      .order('content_score', { ascending: true })
      .limit(50);

    // 2c. 총세대수 null 현장 수
    const { count: hhNull } = await sb.from('apt_subscriptions')
      .select('id', { count: 'exact', head: true })
      .is('total_households', null);

    // 2d. 공급세대 0인 현장
    const { count: supplyZero } = await sb.from('apt_subscriptions')
      .select('id', { count: 'exact', head: true })
      .or('tot_supply_hshld_co.is.null,tot_supply_hshld_co.eq.0');

    results.apt = {
      total_subscriptions: (subs || []).length,
      issues_count: aptIssues.length,
      issues: aptIssues.slice(0, 80),
      total_households_null: hhNull || 0,
      supply_zero: supplyZero || 0,
      low_content_score_sites: (sites || []).length,
      low_content_sites: (sites || []).slice(0, 20).map(s => ({
        slug: s.slug, name: s.name, region: s.region,
        score: s.content_score, type: s.site_type,
      })),
    };
  }

  return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
