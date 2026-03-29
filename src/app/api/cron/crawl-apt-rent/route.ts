import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { LAWD_CODES, parseXmlItems, parseRegionSigungu } from '@/lib/lawd-codes';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'DATA_GO_KR_API_KEY not set' }, { status: 200 });

  const supabase = getSupabaseAdmin();

  const result = await withCronLogging('crawl-apt-rent', async () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 당월 + 전월 수집
    const months: string[] = [];
    if (currentMonth > 1) months.push(`${currentYear}${String(currentMonth - 1).padStart(2, '0')}`);
    months.push(`${currentYear}${String(currentMonth).padStart(2, '0')}`);

    const entries = Object.entries(LAWD_CODES);
    let totalInserted = 0;
    let totalSkipped = 0;
    const failed: string[] = [];
    const BATCH = 15;

    async function fetchOne(label: string, lawdCd: string): Promise<{ inserted: number; skipped: number }> {
      const { region, sigungu } = parseRegionSigungu(label);
      let inserted = 0;
      let skipped = 0;

      for (const ym of months) {
        try {
          const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent?serviceKey=${encodeURIComponent(apiKey!)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&pageNo=1&numOfRows=1000`;
          const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
          const xml = await res.text();

          // API 에러 체크
          if (xml.includes('<returnReasonCode>') && !xml.includes('<item>')) continue;

          const items = parseXmlItems(xml);
          const rows = items.map(it => {
            const deposit = parseInt(it.deposit || '0');
            const monthlyRent = parseInt(it.monthly_rent || '0');
            const dealDate = it.deal_year && it.deal_month && it.deal_day
              ? `${it.deal_year}-${String(it.deal_month).padStart(2, '0')}-${String(it.deal_day).padStart(2, '0')}`
              : null;

            return {
              apt_name: it.apt_name || '미상',
              region_nm: region,
              sigungu,
              dong: it.dong || null,
              exclusive_area: parseFloat(it.exclusive_area || '0'),
              rent_type: monthlyRent > 0 ? 'monthly' : 'jeonse',
              deposit,
              monthly_rent: monthlyRent,
              deal_date: dealDate,
              floor: parseInt(it.floor || '0'),
              built_year: parseInt(it.built_year || '0') || null,
              contract_term: it.contract_term || null,
              renewal_right: it.renewal_right || null,
            };
          }).filter(r => r.deposit > 0 && r.deal_date);

          if (rows.length > 0) {
            // UPSERT — 중복 무시
            const { data, error } = await (supabase as any)
              .from('apt_rent_transactions')
              .upsert(rows, { onConflict: 'apt_name,sigungu,dong,exclusive_area,deal_date,floor,rent_type,deposit', ignoreDuplicates: true })
              .select('id');

            if (!error) {
              inserted += data?.length || 0;
              skipped += rows.length - (data?.length || 0);
            }
          }
        } catch {
          // 개별 시군구 실패 무시
        }
      }
      return { inserted, skipped };
    }

    // 배치 병렬 실행
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(([name, code]) => fetchOne(name, code)));
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') {
          totalInserted += r.value.inserted;
          totalSkipped += r.value.skipped;
        } else {
          failed.push(batch[j][0]);
        }
      }
    }

    return {
      processed: entries.length * months.length,
      created: totalInserted,
      failed: failed.length,
      metadata: {
        months,
        skipped_duplicates: totalSkipped,
        api_calls: entries.length * months.length,
        ...(failed.length > 0 ? { failed_regions: failed.slice(0, 10) } : {}),
      },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result });
}
