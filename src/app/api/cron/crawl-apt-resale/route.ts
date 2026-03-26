export const maxDuration = 60;
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';

const LAWD_CODES: Record<string, string> = {
  '서울 강남구':'11680','서울 서초구':'11650','서울 송파구':'11710','서울 강동구':'11740',
  '서울 마포구':'11440','서울 영등포구':'11560','서울 용산구':'11170',
  '서울 성동구':'11200','서울 광진구':'11215','서울 동작구':'11590',
  '경기 수원시':'41111','경기 성남시':'41131','경기 화성시':'41590','경기 평택시':'41220',
  '경기 용인시':'41461','경기 고양시':'41281','경기 김포시':'41570','경기 시흥시':'41390',
  '부산 해운대구':'26350','부산 부산진구':'26170','부산 수영구':'26410',
  '대구 수성구':'27260','대구 달서구':'27290',
  '인천 연수구':'28185','인천 서구':'28260','인천 남동구':'28200',
  '대전 유성구':'30200','대전 서구':'30170',
  '광주 광산구':'29200','광주 북구':'29170',
  '울산 남구':'31140',
  '충남 천안시':'44131','충남 아산시':'44200',
  '경남 창원시':'48121','경남 김해시':'48250',
  '세종시':'36110',
};

function parseXmlItems(xml: string): Record<string, any>[] {
  const items: Record<string, any>[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const b = m[1];
    const g = (tag: string) => { const r = b.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)); return r ? r[1].trim() : null; };
    items.push({
      apt_name: g('단지') || g('아파트') || '미상', dong: g('법정동') || null,
      exclusive_area: parseFloat(g('전용면적') || '0'),
      deal_amount: parseInt((g('거래금액') || '0').replace(/,/g, '').trim()),
      deal_year: g('년'), deal_month: g('월'), deal_day: g('일'),
      floor: parseInt(g('층') || '0'),
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
  if (!apiKey) return NextResponse.json({ error: 'BUSAN_DATA_API_KEY not set' }, { status: 200 });

  const supabase = getSupabaseAdmin();

  const result = await withCronLogging('crawl-apt-resale', async () => {
    const now = new Date();
    const months: string[] = [];
    for (let m = 1; m <= now.getMonth() + 1; m++) {
      months.push(`${now.getFullYear()}${String(m).padStart(2, '0')}`);
    }

    const entries = Object.entries(LAWD_CODES);
    let totalInserted = 0;

    async function fetchOne(label: string, lawdCd: string): Promise<number> {
      const [regionPart, sigunguPart] = label.split(' ');
      let count = 0;
      for (const ym of months) {
        const url = `https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade?serviceKey=${encodeURIComponent(apiKey!)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&pageNo=1&numOfRows=1000`;
        const res = await fetch(url);
        const xml = await res.text();
        const items = parseXmlItems(xml);
        const rows = items.map(it => ({
          apt_name: it.apt_name, region_nm: regionPart, sigungu: sigunguPart, dong: it.dong,
          exclusive_area: it.exclusive_area, deal_amount: it.deal_amount,
          deal_date: it.deal_year && it.deal_month && it.deal_day
            ? `${it.deal_year}-${String(it.deal_month).padStart(2,'0')}-${String(it.deal_day).padStart(2,'0')}` : null,
          floor: it.floor, source: 'molit_resale',
        })).filter(r => r.deal_amount > 0 && r.deal_date);
        if (rows.length > 0) {
          const { error } = await supabase.from('apt_resale_rights').insert(rows);
          if (!error) count += rows.length;
        }
      }
      return count;
    }

    // 전체 병렬 처리 (15개 시군구 한번에)
    const results = await Promise.allSettled(entries.map(([name, code]) => fetchOne(name, code)));
    for (const r of results) {
      if (r.status === 'fulfilled') totalInserted += r.value;
    }

    return {
      processed: entries.length,
      created: totalInserted,
      failed: 0,
      metadata: { api_name: 'data_go_kr', api_calls: entries.length * 2, months },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result });
}
