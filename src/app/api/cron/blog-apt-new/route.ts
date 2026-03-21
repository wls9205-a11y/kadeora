import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function toSlug(name: string) {
  return name.replace(/\s+/g, '-').replace(/[^가-힣a-zA-Z0-9-]/g, '').slice(0, 60);
}

function fmtDate(d: string | null) {
  if (!d) return '-';
  return d.slice(0, 10).replace(/-/g, '.');
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    let created = 0;

    // 1. apt_subscriptions에서 블로그 없는 현장
    const { data: apts } = await admin.from('apt_subscriptions')
      .select('house_manage_no, house_nm, region_nm, hssply_adres, tot_supply_hshld_co, rcept_bgnde, rcept_endde, przwner_presnatn_de, mdatrgbn_nm, mvn_prearnge_ym')
      .order('rcept_bgnde', { ascending: false }).limit(50);

    for (const apt of (apts ?? [])) {
      const slug = `apt-${toSlug(apt.house_nm)}-${apt.house_manage_no}`;
      const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (exists) continue;

      const region = apt.region_nm ?? '';
      const addr = apt.hssply_adres ?? '';
      const units = apt.tot_supply_hshld_co ?? 0;

      const content = `## ${apt.house_nm} 분양 정보

### 기본 정보
| 항목 | 내용 |
|---|---|
| 단지명 | ${apt.house_nm} |
| 지역 | ${region} |
| 주소 | ${addr} |
| 총 세대수 | ${units.toLocaleString()}세대 |
| 분양유형 | ${apt.mdatrgbn_nm ?? '-'} |
| 입주예정 | ${apt.mvn_prearnge_ym ? apt.mvn_prearnge_ym.slice(0, 4) + '년 ' + parseInt(apt.mvn_prearnge_ym.slice(4, 6)) + '월' : '-'} |

### 일정
| 일정 | 날짜 |
|---|---|
| 청약 접수 | ${fmtDate(apt.rcept_bgnde)} ~ ${fmtDate(apt.rcept_endde)} |
| 당첨 발표 | ${fmtDate(apt.przwner_presnatn_de)} |

---

### 관련 링크
- [${apt.house_nm} 청약 상세 →](/apt/${apt.house_manage_no})
- [${region} 청약 전체 보기 →](/apt?region=${encodeURIComponent(region)})
- [청약 관련 소문 보기 →](/feed?category=apt)
- [이 청약 마감 알림 받기 → 회원가입](/login)

---

> 본 콘텐츠는 청약홈(applyhome.co.kr) 공공데이터 기반이며, 정확한 정보는 청약홈에서 확인하세요. 투자 권유가 아닙니다.`;

      const tags = [`${apt.house_nm} 분양`, `${region} 청약`, '아파트 청약', '분양일정'];
      const aptTitle = `${apt.house_nm} ${region} 분양 청약 일정 총정리`;
      await admin.from('blog_posts').insert({
        slug, title: aptTitle,
        content, excerpt: `${apt.house_nm} ${region} ${units.toLocaleString()}세대 분양. 접수 ${fmtDate(apt.rcept_bgnde)}~${fmtDate(apt.rcept_endde)}.`,
        category: 'apt', tags, source_type: 'apt', source_ref: apt.house_manage_no,
        cron_type: 'apt-new', cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(aptTitle)}&type=blog`,
      });
      created++;
    }

    // 2. unsold_apts에서 블로그 없는 현장
    const { data: unsolds } = await admin.from('unsold_apts')
      .select('id, house_nm, region_nm, sigungu_nm, tot_unsold_hshld_co, tot_supply_hshld_co, sale_price_min, sale_price_max')
      .eq('is_active', true).limit(30);

    for (const u of (unsolds ?? [])) {
      const slug = `unsold-${toSlug(u.house_nm || '미분양')}-${u.id}`;
      const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (exists) continue;

      const pMin = u.sale_price_min ? (u.sale_price_min / 10000).toFixed(1) + '억' : '-';
      const pMax = u.sale_price_max ? (u.sale_price_max / 10000).toFixed(1) + '억' : '-';

      const content = `## ${u.house_nm} 미분양 현황

| 항목 | 내용 |
|---|---|
| 단지명 | ${u.house_nm} |
| 지역 | ${u.region_nm} ${u.sigungu_nm ?? ''} |
| 미분양 | ${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대 |
| 전체 세대 | ${(u.tot_supply_hshld_co ?? 0).toLocaleString()}세대 |
| 분양가 | ${pMin} ~ ${pMax} |

---

- [${u.house_nm} 미분양 상세 →](/apt/unsold/${u.id})
- [${u.region_nm} 미분양 현황 →](/apt?tab=unsold)
- [부동산 소문 보기 →](/feed?category=apt)

> 국토교통부 미분양주택현황 기반. 투자 권유가 아닙니다.`;

      const unsoldTitle = `${u.house_nm} ${u.region_nm} 미분양 ${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대 현황`;
      await admin.from('blog_posts').insert({
        slug, title: unsoldTitle,
        content, excerpt: `${u.house_nm} ${u.region_nm} 미분양 ${(u.tot_unsold_hshld_co ?? 0).toLocaleString()}세대. 분양가 ${pMin}~${pMax}.`,
        category: 'unsold', tags: [`${u.house_nm} 미분양`, `${u.region_nm} 미분양`, '미분양 아파트'],
        source_type: 'unsold', source_ref: String(u.id),
        cron_type: 'apt-new', cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(unsoldTitle)}&type=blog`,
      });
      created++;
    }

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    console.error('[blog-apt-new]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
