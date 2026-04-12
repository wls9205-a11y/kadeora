import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

/**
 * 블로그 청약 분석 V2 — 고품질 데이터 기반 + 주변 시세 교차검증
 * 배치: 1회 5현장, 편당 3,000~4,000자
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-apt-v2', async () => {
    const sb = getSupabaseAdmin();
    const BATCH = 5;
    const today = new Date().toISOString().slice(0, 10);

    // 1. 블로그 없는 청약 현장 (최신순)
    const { data: allApts } = await (sb as any).from('apt_subscriptions')
      .select('id, house_manage_no, house_nm, region_nm, supply_addr, hssply_adres, tot_supply_hshld_co, rcept_bgnde, rcept_endde, przwner_presnatn_de, cntrct_cncls_bgnde, cntrct_cncls_endde, mdatrgbn_nm, mvn_prearnge_ym, constructor_nm, developer_nm, is_price_limit, brand_name, project_type, price_per_pyeong_avg, price_per_pyeong_min, price_per_pyeong_max, house_type_info, general_supply_total, special_supply_total, ai_summary, community_facilities, heating_type, parking_ratio, balcony_extension, loan_rate, is_regulated_area, nearest_station, nearest_school, competition_rate_1st, total_households, move_in_month, announcement_pdf_url, transfer_limit_years, residence_obligation_years')
      .order('rcept_bgnde', { ascending: false })
      .limit(200);

    if (!allApts?.length) return { processed: 0, created: 0, failed: 0 };

    const { data: existingBlogs } = await sb.from('blog_posts')
      .select('source_ref').eq('is_published', true).eq('category', 'apt')
      .not('source_ref', 'is', null);
    const covered = new Set((existingBlogs || []).map((b: any) => b.source_ref));
    const targets = allApts.filter((a: any) => !covered.has(a.house_manage_no)).slice(0, BATCH);
    if (!targets.length) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'all_covered' } };

    let created = 0;

    for (const apt of targets) {
      try {
        const addr = apt.hssply_adres || apt.supply_addr || '';
        const region = apt.region_nm || '';
        const units = Number(apt.tot_supply_hshld_co || 0);
        const genSupply = Number(apt.general_supply_total || 0);
        const specSupply = Number(apt.special_supply_total || 0);
        const ppyeong = apt.price_per_pyeong_avg ? Number(apt.price_per_pyeong_avg) : 0;
        const ppMin = apt.price_per_pyeong_min ? Number(apt.price_per_pyeong_min) : 0;
        const ppMax = apt.price_per_pyeong_max ? Number(apt.price_per_pyeong_max) : 0;
        const constructor = apt.constructor_nm || '';
        const developer = apt.developer_nm || '';
        const brand = apt.brand_name || '';
        const moveIn = apt.move_in_month || apt.mvn_prearnge_ym || '';
        const isLimit = apt.is_price_limit;
        const isRegulated = apt.is_regulated_area;

        // 2. 주변 실거래 시세 (같은 시군구)
        let nearbyTrades: any[] = [];
        if (region) {
          const regionPart = addr.split(' ').slice(0, 2).join(' '); // "경기 화성시" 같은 형태
          const { data: trades } = await (sb as any).from('apt_transactions')
            .select('apt_name, deal_amount, area, deal_date')
            .like('sigungu', `%${regionPart.split(' ')[1] || region}%`)
            .order('deal_date', { ascending: false })
            .limit(10);
          nearbyTrades = trades || [];
        }

        // 3. 같은 지역 미분양 현황
        let unsoldCount = 0;
        try {
          const { data: unsold } = await (sb as any).from('unsold_apts')
            .select('tot_unsold_hshld_co')
            .eq('is_active', true)
            .like('sigungu_nm', `%${addr.split(' ')[1] || ''}%`)
            .limit(5);
          unsoldCount = (unsold || []).reduce((s: number, u: any) => s + Number(u.tot_unsold_hshld_co || 0), 0);
        } catch { /* skip */ }

        // 4. AI 분석 (Haiku)
        let aiText = '';
        if (process.env.ANTHROPIC_API_KEY) {
          try {
            const prompt = `한국 아파트 청약 "${apt.house_nm}" 분석.
위치: ${addr}, 세대수: ${units}, 시공사: ${constructor}, 시행사: ${developer}
분양가: ${ppMin > 0 && ppMax > 0 ? '평당 '+ppMin.toLocaleString()+'~'+ppMax.toLocaleString()+'만원 (평균 '+ppyeong.toLocaleString()+'만원)' : ppyeong > 0 ? '평당 '+ppyeong.toLocaleString()+'만원' : '미공개'}
분양가상한제: ${isLimit ? '적용' : '미적용'}, 규제지역: ${isRegulated ? '규제' : '비규제'}
입주예정: ${moveIn}, 경쟁률: ${apt.competition_rate_1st || '미발표'}

아래 형식으로 작성 (마크다운, 이모지 없이, 각 항목 2줄):
### 이 단지의 강점
1. (강점1)
2. (강점2)
3. (강점3)

### 청약 시 유의사항
1. (유의1)
2. (유의2)
3. (유의3)`;

            const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': ANTHROPIC_VERSION },
              body: JSON.stringify({ model: AI_MODEL_HAIKU, max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
              signal: AbortSignal.timeout(15000),
            });
            if (aiRes.ok) {
              const d = await aiRes.json();
              aiText = d.content?.[0]?.text || '';
            }
          } catch { /* skip */ }
        }

        // 5. 본문 조립
        const slug = `apt-v2-${apt.house_manage_no}-${today.replace(/-/g, '')}`;
        const title = `${apt.house_nm} 청약 분석 — ${region} ${units}세대 ${constructor || ''} (${today})`;

        // 청약 상태
        const now = new Date();
        const rceptEnd = apt.rcept_endde ? new Date(apt.rcept_endde) : null;
        const rceptBgn = apt.rcept_bgnde ? new Date(apt.rcept_bgnde) : null;
        let status = '예정';
        if (rceptBgn && now >= rceptBgn && rceptEnd && now <= rceptEnd) status = '접수중';
        else if (rceptEnd && now > rceptEnd) status = '접수마감';
        else if (apt.przwner_presnatn_de && now > new Date(apt.przwner_presnatn_de)) status = '당첨발표 완료';

        let c = `## ${apt.house_nm} — 한눈에 보기

**${apt.house_nm}**은 ${region} ${addr.split(' ').slice(1, 3).join(' ')}에 위치한 **${units}세대** 규모의 ${apt.mdatrgbn_nm || '민영'} 아파트입니다.${constructor ? ` 시공은 **${constructor}**` : ''}${brand ? `(${brand})` : ''}${developer ? `, 시행은 ${developer}` : ''}.

---

## 청약 일정

| 항목 | 일정 |
|---|---|
| **현재 상태** | ${status} |
| **특별공급 접수** | ${apt.spsply_rcept_bgnde || '—'} ~ ${apt.spsply_rcept_endde || '—'} |
| **1순위 접수** | ${apt.rcept_bgnde || '—'} ~ ${apt.rcept_endde || '—'} |
| **당첨자 발표** | ${apt.przwner_presnatn_de || '—'} |
| **계약 기간** | ${apt.cntrct_cncls_bgnde || '—'} ~ ${apt.cntrct_cncls_endde || '—'} |
| **입주 예정** | ${moveIn || '—'} |

---

## 분양 개요

| 항목 | 내용 |
|---|---|
| **총 세대수** | ${units > 0 ? units.toLocaleString()+'세대' : '미확인'} |
| **일반공급** | ${genSupply > 0 ? genSupply.toLocaleString()+'세대' : '—'} |
| **특별공급** | ${specSupply > 0 ? specSupply.toLocaleString()+'세대' : '—'} |
| **분양가** | ${ppyeong > 0 ? '평당 약 '+ppyeong.toLocaleString()+'만원' : '미공개'} |
| **분양가상한제** | ${isLimit ? '적용 ✓' : '미적용'} |
| **규제지역** | ${isRegulated ? '규제지역' : '비규제지역'} |
| **시공사** | ${constructor || '—'} |
| **시행사** | ${developer || '—'} |
| **브랜드** | ${brand || '—'} |
| **공급유형** | ${apt.mdatrgbn_nm || '—'} |
${apt.heating_type ? `| **난방** | ${apt.heating_type} |\n` : ''}${apt.parking_ratio ? `| **주차** | ${apt.parking_ratio} |\n` : ''}${apt.balcony_extension ? `| **발코니 확장** | ${apt.balcony_extension} |\n` : ''}${apt.loan_rate ? `| **대출 금리** | ${apt.loan_rate} |\n` : ''}
`;

        // 타입별 공급 정보
        if (apt.house_type_info) {
          try {
            const types = typeof apt.house_type_info === 'string' ? JSON.parse(apt.house_type_info) : apt.house_type_info;
            if (Array.isArray(types) && types.length > 0) {
              c += `\n---\n\n## 타입별 공급 세대\n\n| 타입 | 전용면적 | 세대수 | 분양가 |\n|---|---|---|---|\n`;
              types.forEach((t: any) => {
                c += `| ${t.type || t.house_type || '—'} | ${t.area || t.exclusive_area || '—'}㎡ | ${t.supply || t.supply_count || '—'}세대 | ${t.price ? Number(t.price).toLocaleString()+'만원' : '—'} |\n`;
              });
            }
          } catch { /* skip */ }
        }

        // 경쟁률
        if (apt.competition_rate_1st) {
          c += `\n---\n\n## 청약 경쟁률\n\n`;
          c += `- **1순위 경쟁률**: ${apt.competition_rate_1st}\n`;
          if (apt.competition_rate_2nd) c += `- **2순위 경쟁률**: ${apt.competition_rate_2nd}\n`;
          c += '\n';
        }

        // 주변 시세
        if (nearbyTrades.length > 0) {
          c += `\n---\n\n## 주변 아파트 실거래 시세\n\n| 단지명 | 거래일 | 전용면적 | 거래가 |\n|---|---|---|---|\n`;
          nearbyTrades.slice(0, 7).forEach((t: any) => {
            c += `| ${t.apt_name || '—'} | ${t.deal_date || '—'} | ${t.exclusive_area || '—'}㎡ | ${t.deal_amount ? Number(t.deal_amount).toLocaleString()+'만원' : '—'} |\n`;
          });
          if (ppyeong > 0) {
            const avgTradePrice = nearbyTrades.reduce((s: number, t: any) => s + Number(t.deal_amount || 0), 0) / nearbyTrades.length;
            if (avgTradePrice > 0) {
              c += `\n주변 실거래 평균가 대비 분양가 수준을 참고하시기 바랍니다.\n`;
            }
          }
        }

        // 미분양 컨텍스트
        if (unsoldCount > 0) {
          c += `\n---\n\n## 지역 미분양 현황\n\n해당 시군구의 현재 미분양 세대는 약 **${unsoldCount.toLocaleString()}세대**입니다. [미분양 상세 →](/apt?tab=unsold)\n`;
        }

        // 입지 정보
        const hasLocation = apt.nearest_station || apt.nearest_school || apt.community_facilities;
        if (hasLocation) {
          c += `\n---\n\n## 입지 정보\n\n`;
          if (apt.nearest_station) c += `- **최근 역**: ${apt.nearest_station}\n`;
          if (apt.nearest_school) c += `- **학군**: ${apt.nearest_school}\n`;
          if (apt.community_facilities) c += `- **커뮤니티**: ${apt.community_facilities}\n`;
          c += '\n';
        }

        // AI 분석
        if (aiText) c += `\n---\n\n${aiText}\n`;

        // FAQ
        c += `\n---\n\n## 자주 묻는 질문\n\n`;
        c += `**Q. ${apt.house_nm} 청약 일정은?**\nA. ${apt.rcept_bgnde ? `1순위 접수 ${apt.rcept_bgnde} ~ ${apt.rcept_endde}, 당첨 발표 ${apt.przwner_presnatn_de || '미정'}.` : '일정이 아직 공개되지 않았습니다.'} [상세 →](/apt/${apt.id})\n\n`;
        c += `**Q. ${apt.house_nm} 분양가는?**\nA. ${ppyeong > 0 ? `평당 약 ${ppyeong.toLocaleString()}만원 수준입니다.` : '분양가가 아직 공개되지 않았습니다.'} ${isLimit ? '분양가상한제 적용 단지입니다.' : ''}\n\n`;
        c += `**Q. ${apt.house_nm} 시공사는?**\nA. ${constructor || '미확인'}${brand ? `(${brand})` : ''}이 시공합니다.\n`;

        // 관련 링크
        c += `\n---\n\n## 관련 링크\n\n`;
        c += `- [${apt.house_nm} 상세 정보 →](/apt/${apt.id})\n`;
        c += `- [${region} 청약 전체 →](/apt/region/${encodeURIComponent(region)})\n`;
        c += `- [청약 가점 계산기 →](/apt/diagnose)\n`;
        c += `- [카더라 데일리 리포트 →](/daily)\n`;
        if (apt.announcement_pdf_url) c += `- [입주자모집공고 PDF →](${apt.announcement_pdf_url})\n`;

        const tags = [apt.house_nm, region, constructor, brand, '청약', '분양', '아파트', addr.split(' ')[1] || ''].filter(Boolean) as string[];
        const ok = await safeBlogInsert(sb, {
          slug, title, content: c,
          excerpt: `${apt.house_nm} ${region} ${units}세대 청약 분석. ${constructor} 시공, ${ppyeong > 0 ? '평당 '+ppyeong.toLocaleString()+'만원' : ''} 분양가, 일정, 주변 시세 비교 (${today}).`,
          category: 'apt', tags,
          source_type: 'auto', source_ref: apt.house_manage_no, data_date: today,
        });
        if (ok) created++;
      } catch { continue; }
    }

    return { processed: targets.length, created, failed: targets.length - created };
  });

  if (!result.success) return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
}
