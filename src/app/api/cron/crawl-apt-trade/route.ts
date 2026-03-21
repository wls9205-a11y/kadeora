import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';

const LAWD_CODES: Record<string, string> = {
  '서울 종로구':'11110','서울 중구':'11140','서울 용산구':'11170','서울 성동구':'11200',
  '서울 광진구':'11215','서울 동대문구':'11230','서울 중랑구':'11260','서울 성북구':'11290',
  '서울 강북구':'11305','서울 도봉구':'11320','서울 노원구':'11350','서울 은평구':'11380',
  '서울 서대문구':'11410','서울 마포구':'11440','서울 양천구':'11470','서울 강서구':'11500',
  '서울 구로구':'11530','서울 금천구':'11545','서울 영등포구':'11560','서울 동작구':'11590',
  '서울 관악구':'11620','서울 서초구':'11650','서울 강남구':'11680','서울 송파구':'11710',
  '서울 강동구':'11740',
  '경기 수원시':'41111','경기 성남시':'41131','경기 고양시':'41281','경기 용인시':'41461',
  '경기 부천시':'41190','경기 안양시':'41171','경기 화성시':'41590','경기 평택시':'41220',
  '경기 시흥시':'41390','경기 김포시':'41570',
  '부산 해운대구':'26350','부산 부산진구':'26170','부산 남구':'26290',
  '부산 수영구':'26410','부산 동래구':'26260',
  // 대구 (8개)
  '대구 중구':'27110','대구 동구':'27140','대구 서구':'27170','대구 남구':'27200',
  '대구 북구':'27230','대구 수성구':'27260','대구 달서구':'27290','대구 달성군':'27710',
  // 인천 (10개)
  '인천 중구':'28110','인천 동구':'28140','인천 미추홀구':'28177','인천 연수구':'28185',
  '인천 남동구':'28200','인천 부평구':'28237','인천 계양구':'28245','인천 서구':'28260',
  '인천 강화군':'28710','인천 옹진군':'28720',
  // 광주 (5개)
  '광주 동구':'29110','광주 서구':'29140','광주 남구':'29155','광주 북구':'29170',
  '광주 광산구':'29200',
  // 대전 (5개)
  '대전 동구':'30110','대전 중구':'30140','대전 서구':'30170','대전 유성구':'30200',
  '대전 대덕구':'30230',
  // 울산 (5개)
  '울산 중구':'31110','울산 남구':'31140','울산 동구':'31170','울산 북구':'31200',
  '울산 울주군':'31710',
  // 세종 (1개)
  '세종시':'36110',
};

function parseXmlItems(xml: string): any[] {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const b = m[1];
    const g = (tag: string) => { const r = b.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)); return r ? r[1].trim() : null; };
    items.push({
      apt_name: g('아파트') || g('aptNm') || '미상',
      dong: g('법정동') || g('umdNm') || null,
      exclusive_area: parseFloat(g('전용면적') || g('excluUseAr') || '0'),
      deal_amount: parseInt((g('거래금액') || g('dealAmount') || '0').replace(/,/g, '').trim()),
      deal_year: g('년') || g('dealYear'), deal_month: g('월') || g('dealMonth'), deal_day: g('일') || g('dealDay'),
      floor: parseInt(g('층') || g('floor') || '0'),
      built_year: parseInt(g('건축년도') || g('buildYear') || '0'),
    });
  }
  return items;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const apiKey = process.env.BUSAN_DATA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'BUSAN_DATA_API_KEY not set' }, { status: 500 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const result = await withCronLogging('crawl-apt-trade', async () => {
    const now = new Date();
    const months = [
      `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`,
      `${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0')}`,
    ];

    const entries = Object.entries(LAWD_CODES);
    let totalInserted = 0;
    let failed: string[] = [];
    const BATCH = 15;

    async function fetchOne(label: string, lawdCd: string): Promise<number> {
      const [regionPart, sigunguPart] = label.split(' ');
      let count = 0;
      for (const ym of months) {
        const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${encodeURIComponent(apiKey)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&pageNo=1&numOfRows=1000`;
        const res = await fetch(url);
        const xml = await res.text();
        const items = parseXmlItems(xml);
        const rows = items.map(it => ({
          apt_name: it.apt_name, region_nm: regionPart, sigungu: sigunguPart, dong: it.dong,
          exclusive_area: it.exclusive_area, deal_amount: it.deal_amount,
          deal_date: it.deal_year && it.deal_month && it.deal_day
            ? `${it.deal_year}-${String(it.deal_month).padStart(2,'0')}-${String(it.deal_day).padStart(2,'0')}` : null,
          floor: it.floor, built_year: it.built_year || null, trade_type: '매매', source: 'molit_trade',
        })).filter(r => r.deal_amount > 0 && r.deal_date);
        if (rows.length > 0) {
          const { error } = await supabase.from('apt_transactions').insert(rows);
          if (!error) count += rows.length;
        }
      }
      return count;
    }

    // 5 그룹 × 15개 병렬
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(([name, code]) => fetchOne(name, code)));
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') totalInserted += r.value;
        else failed.push(batch[j][0]);
      }
    }

    // 관심단지 알림 생성
    let notifCount = 0;
    try {
      const { data: watchItems } = await supabase.from('apt_watchlist').select('user_id, item_id').eq('item_type', 'transaction').eq('notify_enabled', true);
      if (watchItems?.length) {
        const aptNames = new Set(watchItems.map(w => w.item_id));
        const { data: newTrades } = await supabase.from('apt_transactions')
          .select('apt_name, deal_amount, deal_date')
          .in('apt_name', Array.from(aptNames))
          .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
          .limit(50);
        if (newTrades?.length) {
          const notifs = watchItems.filter(w => newTrades.some((t: any) => t.apt_name === w.item_id))
            .map(w => {
              const trade = newTrades.find((t: any) => t.apt_name === w.item_id);
              return { user_id: w.user_id, type: 'system', content: `관심단지 ${w.item_id}의 새 거래가 등록되었습니다. ${trade?.deal_date} ${trade?.deal_amount ? (trade.deal_amount / 10000).toFixed(1) + '억' : ''}` };
            });
          if (notifs.length > 0) {
            await supabase.from('notifications').insert(notifs);
            notifCount = notifs.length;
          }
        }
      }
    } catch {}

    return {
      processed: entries.length,
      created: totalInserted,
      failed: failed.length,
      metadata: { api_name: 'data_go_kr', api_calls: entries.length * 2, months, notifications: notifCount, ...(failed.length > 0 ? { failed } : {}) },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...result });
}
