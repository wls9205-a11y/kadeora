import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const LAWD_CODES: Record<string, string> = {
  '서울 강남구':'11680','서울 서초구':'11650','서울 송파구':'11710','서울 강동구':'11740',
  '서울 마포구':'11440','서울 영등포구':'11560','서울 용산구':'11170',
  '경기 수원시':'41111','경기 성남시':'41131','경기 화성시':'41590','경기 평택시':'41220',
  '경기 용인시':'41461','경기 고양시':'41281',
  '부산 해운대구':'26350','부산 부산진구':'26170',
};

function parseXmlItems(xml: string): any[] {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].trim() : null;
    };
    items.push({
      apt_name: get('단지') || get('아파트') || '미상',
      dong: get('법정동') || null,
      exclusive_area: parseFloat(get('전용면적') || '0'),
      deal_amount: parseInt((get('거래금액') || '0').replace(/,/g, '').trim()),
      deal_year: get('년'), deal_month: get('월'), deal_day: get('일'),
      floor: parseInt(get('층') || '0'),
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

    let totalInserted = 0;
    for (const [label, lawdCd] of Object.entries(LAWD_CODES)) {
      const [regionPart, sigunguPart] = label.split(' ');
      for (const ym of months) {
        try {
          const url = `https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade?serviceKey=${encodeURIComponent(apiKey)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&pageNo=1&numOfRows=1000`;
          const res = await fetch(url);
          const xml = await res.text();
          const items = parseXmlItems(xml);

          const rows = items.map(item => ({
            apt_name: item.apt_name,
            region_nm: regionPart,
            sigungu: sigunguPart,
            dong: item.dong,
            exclusive_area: item.exclusive_area,
            deal_amount: item.deal_amount,
            deal_date: item.deal_year && item.deal_month && item.deal_day
              ? `${item.deal_year}-${String(item.deal_month).padStart(2,'0')}-${String(item.deal_day).padStart(2,'0')}`
              : null,
            floor: item.floor,
            source: 'molit_resale',
          })).filter(r => r.deal_amount > 0 && r.deal_date);

          if (rows.length > 0) {
            const { error } = await supabase.from('apt_resale_rights').insert(rows);
            if (!error) totalInserted += rows.length;
          }
        } catch {}
      }
    }

    return NextResponse.json({ message: 'Resale rights data crawled', inserted: totalInserted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
