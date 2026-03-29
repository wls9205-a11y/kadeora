import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { LAWD_CODES, parseXmlItems, parseRegionSigungu } from '@/lib/lawd-codes';

export const maxDuration = 300;

/* ═══════════════════════════════════════════════════════════
   과거 실거래 벌크 수집 (매매 + 전월세)
   POST /api/admin/backfill-trades
   body: { type: 'sale' | 'rent', year: 2023 | 2024 | 2025, monthStart?: 1, monthEnd?: 12 }
   
   일일 API 한도: 10,000건
   1회 실행: ~200 시군구 × 12개월 = 2,400 호출
   → 하루에 매매 1년 + 전월세 1년 = 4,800 호출 (한도 내)
═══════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const sb = supabase as any;

  // 관리자 인증
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { type = 'sale', year = 2025, monthStart = 1, monthEnd = 12 } = await req.json();
  const apiKey = process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'DATA_GO_KR_API_KEY not set' }, { status: 500 });

  const cronName = `backfill-${type}-${year}`;

  const result = await withCronLogging(cronName, async () => {
    const months: string[] = [];
    for (let m = monthStart; m <= monthEnd; m++) {
      months.push(`${year}${String(m).padStart(2, '0')}`);
    }

    const entries = Object.entries(LAWD_CODES);
    let totalInserted = 0;
    let totalSkipped = 0;
    let apiCalls = 0;
    const errors: string[] = [];
    const BATCH = 20;

    // API 엔드포인트 분기
    const endpoint = type === 'rent'
      ? 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent'
      : 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';

    async function fetchOneRegion(label: string, lawdCd: string): Promise<{ inserted: number; skipped: number; calls: number }> {
      const { region, sigungu } = parseRegionSigungu(label);
      let inserted = 0;
      let skipped = 0;
      let calls = 0;

      for (const ym of months) {
        try {
          const url = `${endpoint}?serviceKey=${encodeURIComponent(apiKey!)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&pageNo=1&numOfRows=1000`;
          const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
          const xml = await res.text();
          calls++;

          if (xml.includes('<returnReasonCode>') && !xml.includes('<item>')) continue;

          const items = parseXmlItems(xml);

          if (type === 'rent') {
            // 전월세 INSERT
            const rows = items.map(it => {
              const deposit = parseInt(it.deposit || '0');
              const monthlyRent = parseInt(it.monthly_rent || '0');
              const dealDate = it.deal_year && it.deal_month && it.deal_day
                ? `${it.deal_year}-${String(it.deal_month).padStart(2, '0')}-${String(it.deal_day).padStart(2, '0')}`
                : null;
              return {
                apt_name: it.apt_name || '미상', region_nm: region, sigungu, dong: it.dong || null,
                exclusive_area: parseFloat(it.exclusive_area || '0'),
                rent_type: monthlyRent > 0 ? 'monthly' : 'jeonse',
                deposit, monthly_rent: monthlyRent, deal_date: dealDate,
                floor: parseInt(it.floor || '0'), built_year: parseInt(it.built_year || '0') || null,
                contract_term: it.contract_term || null, renewal_right: it.renewal_right || null,
              };
            }).filter(r => r.deposit > 0 && r.deal_date);

            if (rows.length > 0) {
              const { data, error } = await sb.from('apt_rent_transactions')
                .upsert(rows, { onConflict: 'apt_name,sigungu,dong,exclusive_area,deal_date,floor,rent_type,deposit', ignoreDuplicates: true })
                .select('id');
              if (!error) { inserted += data?.length || 0; skipped += rows.length - (data?.length || 0); }
            }
          } else {
            // 매매 INSERT
            const rows = items.map(it => ({
              apt_name: it.apt_name || '미상', region_nm: region, sigungu, dong: it.dong || null,
              exclusive_area: parseFloat(it.exclusive_area || '0'),
              deal_amount: parseInt(it.deal_amount || '0'),
              deal_date: it.deal_year && it.deal_month && it.deal_day
                ? `${it.deal_year}-${String(it.deal_month).padStart(2, '0')}-${String(it.deal_day).padStart(2, '0')}`
                : null,
              floor: parseInt(it.floor || '0'), built_year: parseInt(it.built_year || '0') || null,
              trade_type: '매매', source: 'molit_backfill',
            })).filter(r => r.deal_amount > 0 && r.deal_date);

            if (rows.length > 0) {
              const { error } = await supabase.from('apt_transactions').insert(rows);
              if (!error) inserted += rows.length;
              else skipped += rows.length;
            }
          }
        } catch (e) {
          errors.push(`${label}/${ym}: ${e instanceof Error ? e.message : 'unknown'}`);
        }
      }
      return { inserted, skipped, calls };
    }

    // 배치 병렬 실행 (20개씩)
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(([name, code]) => fetchOneRegion(name, code)));
      for (const r of results) {
        if (r.status === 'fulfilled') {
          totalInserted += r.value.inserted;
          totalSkipped += r.value.skipped;
          apiCalls += r.value.calls;
        }
      }
    }

    return {
      processed: entries.length * months.length,
      created: totalInserted,
      failed: errors.length,
      metadata: {
        type, year, months: `${monthStart}~${monthEnd}`,
        api_calls: apiCalls,
        skipped_duplicates: totalSkipped,
        regions: entries.length,
        ...(errors.length > 0 ? { sample_errors: errors.slice(0, 5) } : {}),
      },
    };
  });

  return NextResponse.json({ ok: true, cronName, ...result });
}
