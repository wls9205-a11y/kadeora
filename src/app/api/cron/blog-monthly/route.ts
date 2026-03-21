import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const month = new Date().toISOString().slice(0, 7);
    let created = 0;

    // 지역별 청약 모음
    const REGIONS = ['서울', '경기', '부산', '인천', '대구'];
    for (const region of REGIONS) {
      const slug = `apt-region-${region}-${month}`;
      const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (exists) continue;

      const { data: apts } = await admin.from('apt_subscriptions')
        .select('house_nm, house_manage_no, rcept_bgnde, rcept_endde, tot_supply_hshld_co')
        .eq('region_nm', region).order('rcept_bgnde', { ascending: false }).limit(10);

      if (!apts || apts.length === 0) continue;

      const table = apts.map(a => `| [${a.house_nm}](/apt/${a.house_manage_no}) | ${a.rcept_bgnde?.slice(5) ?? '-'} ~ ${a.rcept_endde?.slice(5) ?? '-'} | ${(a.tot_supply_hshld_co ?? 0).toLocaleString()} |`).join('\n');
      const content = `## ${region} 아파트 청약 현황 (${month})\n\n| 단지명 | 접수 기간 | 세대수 |\n|---|---|---|\n${table}\n\n---\n\n[${region} 청약 전체 보기 →](/apt)\n[청약 알림 받기 →](/login)\n\n> 청약홈 공공데이터 기반.`;

      await admin.from('blog_posts').insert({ slug, title: `${region} 아파트 청약 ${apts.length}건 총정리 (${month})`, content, excerpt: `${month} ${region} 지역 청약 ${apts.length}건 일정 정리.`, category: 'apt', tags: [`${region} 청약`, `${region} 분양`, '아파트 청약'], source_type: 'auto' });
      created++;
    }

    // 미분양 월간 리포트
    const slugUnsold = `unsold-monthly-${month}`;
    const { data: eU } = await admin.from('blog_posts').select('id').eq('slug', slugUnsold).maybeSingle();
    if (!eU) {
      const { data: unsolds } = await admin.from('unsold_apts').select('region_nm, tot_unsold_hshld_co').eq('is_active', true);
      const byRegion: Record<string, number> = {};
      (unsolds ?? []).forEach(u => { byRegion[u.region_nm] = (byRegion[u.region_nm] ?? 0) + (u.tot_unsold_hshld_co ?? 0); });
      const total = Object.values(byRegion).reduce((s, v) => s + v, 0);
      const table = Object.entries(byRegion).sort((a, b) => b[1] - a[1]).map(([r, c]) => `| ${r} | ${c.toLocaleString()} |`).join('\n');

      const content = `## 전국 미분양 현황 (${month})\n\n전국 미분양 총 **${total.toLocaleString()}세대**\n\n| 지역 | 미분양 세대 |\n|---|---|\n${table}\n\n---\n\n[미분양 상세 보기 →](/apt?tab=unsold)\n[부동산 소문 보기 →](/feed?category=apt)\n\n> 국토교통부 미분양주택현황 기반.`;

      await admin.from('blog_posts').insert({ slug: slugUnsold, title: `전국 미분양 아파트 ${total.toLocaleString()}세대 현황 (${month})`, content, excerpt: `${month} 전국 미분양 ${total.toLocaleString()}세대. 지역별 현황 정리.`, category: 'unsold', tags: ['미분양', '미분양아파트', '부동산'], source_type: 'auto' });
      created++;
    }

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    console.error('[blog-monthly]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
