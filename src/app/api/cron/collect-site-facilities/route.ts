import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const BATCH_SIZE = 20;

const FACILITY_TYPES = [
  { key: 'subway', query: '지하철역', label: '지하철' },
  { key: 'school', query: '초등학교', label: '학교' },
  { key: 'hospital', query: '병원', label: '병원' },
  { key: 'mart', query: '대형마트', label: '마트' },
  { key: 'park', query: '공원', label: '공원' },
];

async function searchLocal(query: string, display = 3): Promise<{ title: string; address: string; category: string }[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const url = `https://openapi.naver.com/v1/search/local?query=${encodeURIComponent(query)}&display=${display}&sort=random`;
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      title: (item.title || '').replace(/<[^>]*>/g, ''),
      address: item.roadAddress || item.address || '',
      category: item.category || '',
    }));
  } catch { return []; }
}

async function handler(_req: NextRequest) {
  const start = Date.now();
  const sb = getSupabaseAdmin();
  let collected = 0;

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return NextResponse.json({ error: 'NAVER API keys not set' }, { status: 200 });
  }

  const { data: sites } = await sb.from('apt_sites')
    .select('id, name, region, sigungu, address, nearby_facilities, nearby_station')
    .eq('is_active', true).gte('content_score', 40)
    .order('interest_count', { ascending: false })
    .limit(BATCH_SIZE * 3);

  const targets = (sites || []).filter((s: any) => {
    const fac = s.nearby_facilities;
    if (!fac || typeof fac !== 'object' || Object.keys(fac).length === 0) return true;
    const updatedAt = (fac as any)?.updated_at;
    if (!updatedAt) return true;
    return Date.now() - new Date(updatedAt).getTime() > 30 * 24 * 60 * 60 * 1000;
  }).slice(0, BATCH_SIZE);

  for (const site of targets) {
    try {
      const locationPrefix = `${site.sigungu || site.region || ''} ${site.name}`;
      const facilities: Record<string, any> = {};
      let nearestStation = site.nearby_station || '';

      for (const ft of FACILITY_TYPES) {
        const results = await searchLocal(`${locationPrefix} ${ft.query}`, 3);
        facilities[ft.key] = results.length;
        if (ft.key === 'subway' && results.length > 0 && !nearestStation) {
          nearestStation = results[0].title.replace(/역$/, '') + '역';
        }
        await new Promise(r => setTimeout(r, 100));
      }

      facilities.updated_at = new Date().toISOString();

      const updateData: any = {
        nearby_facilities: facilities,
        updated_at: new Date().toISOString(),
      };
      if (nearestStation && !site.nearby_station) {
        updateData.nearby_station = nearestStation;
      }

      await sb.from('apt_sites').update(updateData).eq('id', site.id);
      collected++;
    } catch {}
  }

  // content_score 재계산 (nearby_station 추가분)
  for (const site of targets) {
    try { await sb.rpc('calculate_site_content_score', { p_site_id: site.id }); } catch {}
  }

  return NextResponse.json({ success: true, collected, total_checked: targets.length, elapsed: `${Date.now() - start}ms` });
}

export const GET = withCronAuth(handler);
