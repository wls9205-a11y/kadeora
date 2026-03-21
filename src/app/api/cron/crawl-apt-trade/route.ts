import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

  try {
    const now = new Date();
    const months = [
      `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`,
      `${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}${String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0')}`,
    ];

    const entries = Object.entries(LAWD_CODES);
    let totalInserted = 0;
    let failed: string[] = [];
    const BATCH = 10;

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

    // 4 그룹 × 10개 병렬
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(([name, code]) => fetchOne(name, code)));
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') totalInserted += r.value;
        else failed.push(batch[j][0]);
      }
    }

    return NextResponse.json({
      message: 'Apt trade data crawled (full)',
      total_regions: entries.length,
      inserted: totalInserted,
      months,
      ...(failed.length > 0 ? { failed } : {}),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
