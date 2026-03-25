export const maxDuration = 60;
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const admin = getSupabaseAdmin();
    const weekStr = new Date().toISOString().slice(0, 10);
    let created = 0;

    // 1. 이번 주 청약 일정
    const slug1 = `apt-weekly-${weekStr}`;
    const { data: e1 } = await admin.from('blog_posts').select('id').eq('slug', slug1).maybeSingle();
    if (!e1) {
      const today = new Date().toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const { data: apts } = await admin.from('apt_subscriptions')
        .select('house_nm, region_nm, rcept_bgnde, rcept_endde, tot_supply_hshld_co, house_manage_no')
        .gte('rcept_endde', today).lte('rcept_bgnde', nextWeek).order('rcept_bgnde').limit(10);

      const aptCount = (apts ?? []).length;
      const totalUnits = (apts ?? []).reduce((s: number, a: any) => s + (a.tot_supply_hshld_co ?? 0), 0);
      const regions = [...new Set((apts ?? []).map((a: any) => a.region_nm))];
      const table = (apts ?? []).map(a => `| [**${a.house_nm}**](/apt/${a.house_manage_no}) | ${a.region_nm} | ${a.rcept_bgnde?.slice(5)} ~ ${a.rcept_endde?.slice(5)} | ${(a.tot_supply_hshld_co ?? 0).toLocaleString()} |`).join('\n');
      const weekTitle = `이번 주 아파트 청약 일정 총정리 (${weekStr})`;
      const content = `## 이번 주 아파트 청약 일정 (${weekStr})

${weekStr} 기준 이번 주 주요 **아파트 청약 일정**을 정리했습니다. 이번 주에는 총 **${aptCount}건**의 청약이 접수 중이거나 접수 예정이며, 총 **${totalUnits.toLocaleString()}세대** 규모입니다.${regions.length > 0 ? ` 주요 지역은 **${regions.join(', ')}** 등입니다.` : ''}

청약을 준비하시는 분들은 접수 마감일을 반드시 확인하고, 청약 자격 요건도 미리 점검하세요.

---

### 이번 주 청약 일정표

| 단지명 | 지역 | 접수 기간 | 세대수 |
|---|---|---|---|
${table || '| 이번 주 접수 예정 청약이 없습니다 | | | |'}

---

### 이번 주 청약 분석

${aptCount >= 2 ? `이번 주에는 **${aptCount}건**의 청약이 동시에 진행됩니다. 접수 일정이 겹치는 경우 **중복 청약이 불가**하므로, 가점과 추첨 전략에 따라 우선순위를 정하는 것이 중요합니다.` : aptCount === 1 ? `이번 주는 **1건**의 청약만 진행됩니다. 집중적으로 준비하여 당첨 확률을 높이세요.` : '이번 주에는 접수 예정 청약이 없습니다. 다음 주 일정을 미리 확인해두세요.'}

가점이 높은 분들은 경쟁률이 높더라도 대단지에 도전하는 것이 유리하고, 추첨제 물량을 노리시는 분들은 상대적으로 관심이 적은 단지에서 기회를 찾아보세요.

---

### 관련 정보

- [**전체 청약 일정** 보기 →](/apt)
- [**청약 마감 알림** 받기 →](/login)
- [청약 커뮤니티 **토론** →](/feed?category=apt)
- [카더라 **블로그**에서 더 보기 →](/blog?category=apt)

정확한 청약 일정은 **청약홈(applyhome.co.kr)**에서 확인하시고, 카더라에서 매주 업데이트되는 일정을 참고하세요.

> 청약홈 공공데이터 기반. 투자 권유가 아닙니다.`;

      const _r = await safeBlogInsert(admin, { slug: slug1, title: weekTitle, content: ensureMinLength(content, 'apt'), excerpt: `이번 주 청약 ${aptCount}건 · ${totalUnits.toLocaleString()}세대. ${regions.join(', ')}.`, category: 'apt', tags: ['청약일정', '이번주청약', '아파트분양'], cron_type: 'weekly', cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(weekTitle)}&type=blog`, image_alt: generateImageAlt('apt', weekTitle), meta_description: generateMetaDesc(content), meta_keywords: generateMetaKeywords('apt', ['청약일정', '이번주청약', '아파트분양']) });
      if (_r.success) created++;
    }

    // 2. HOT 게시글 주간 정리
    const slug2 = `hot-weekly-${weekStr}`;
    const { data: e2 } = await admin.from('blog_posts').select('id').eq('slug', slug2).maybeSingle();
    if (!e2) {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: hot } = await admin.from('posts')
        .select('id, title, slug, likes_count, comments_count, category')
        .eq('is_deleted', false).gte('created_at', weekAgo)
        .order('likes_count', { ascending: false }).limit(5);

      const list = (hot ?? []).map((p, i) => `| ${i + 1} | [**${p.title}**](/feed/${p.slug || p.id}) | ${p.likes_count} | ${p.comments_count} |`).join('\n');
      const totalLikes = (hot ?? []).reduce((s: number, p: any) => s + (p.likes_count ?? 0), 0);
      const totalComments = (hot ?? []).reduce((s: number, p: any) => s + (p.comments_count ?? 0), 0);
      const content = `## 이번 주 카더라 HOT 게시글 TOP 5 (${weekStr})

이번 주 **카더라 커뮤니티**에서 가장 많은 관심을 받은 게시글 TOP 5를 정리했습니다. 총 **좋아요 ${totalLikes}개**, **댓글 ${totalComments}개**가 달린 뜨거운 주간이었습니다.

커뮤니티에서 어떤 주제가 화제였는지, 다른 회원들은 어떤 의견을 나눴는지 확인해보세요.

---

### 주간 인기 게시글 TOP 5

| 순위 | 제목 | 좋아요 | 댓글 |
|---|---|---|---|
${list || '| - | 이번 주 인기 게시글이 없습니다 | - | - |'}

---

### 이번 주 트렌드 분석

${(hot ?? []).length >= 3 ? `1위 글 **"${(hot ?? [])[0]?.title}"**이 좋아요 ${(hot ?? [])[0]?.likes_count ?? 0}개로 큰 호응을 얻었습니다. 주식·부동산·자유 카테고리 중 이번 주는 **${(hot ?? []).map((p: any) => p.category).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(', ')}** 카테고리가 두드러졌습니다.` : '이번 주 인기 게시글이 다양한 주제를 다루고 있어 폭넓은 관심이 확인됩니다.'}

카더라에서는 매주 커뮤니티 활동이 활발한 글을 자동으로 선정합니다. **좋아요**와 **댓글**로 좋은 글에 참여해보세요!

---

### 관련 정보

- [**HOT 페이지**에서 전체 순위 보기 →](/hot)
- [피드에서 **토론 참여**하기 →](/feed)
- [**알림 설정**으로 인기 글 소식 받기 →](/notifications/settings)

이번 주도 카더라와 함께 투자 정보를 나눠보세요.

> 카더라 커뮤니티 좋아요 기준 자동 집계. 게시글 내용은 개인 의견이며 투자 권유가 아닙니다.`;

      const _r = await safeBlogInsert(admin, { slug: slug2, title: `이번 주 카더라 HOT 게시글 TOP 5 (${weekStr})`, content: ensureMinLength(content, 'general'), excerpt: '이번 주 커뮤니티에서 가장 인기 있던 게시글 TOP 5.', category: 'general', tags: ['HOT', '인기글', '커뮤니티'], image_alt: generateImageAlt('general', `이번 주 카더라 HOT 게시글 TOP 5 (${weekStr})`), meta_description: generateMetaDesc(content), meta_keywords: generateMetaKeywords('general', ['HOT', '인기글', '커뮤니티']) });
      if (_r.success) created++;
    }

    // 3. 같은 지역 청약 비교 콘텐츠
    const slug3 = `apt-compare-${weekStr}`;
    const { data: e3 } = await admin.from('blog_posts').select('id').eq('slug', slug3).maybeSingle();
    if (!e3) {
      const { data: allApts } = await admin.from('apt_subscriptions')
        .select('house_nm, region_nm, house_manage_no, tot_supply_hshld_co, rcept_bgnde, rcept_endde')
        .order('rcept_bgnde', { ascending: false }).limit(20);
      // 같은 지역 페어 찾기
      const byRegion: Record<string, any[]> = {};
      (allApts ?? []).forEach(a => { const r = a.region_nm ?? 'unknown'; if (!byRegion[r]) byRegion[r] = []; byRegion[r].push(a); });
      const pair = Object.entries(byRegion).find(([, v]) => v.length >= 2);
      if (pair) {
        const [region, items] = pair;
        const [a, b] = items;
        const cmpTitle = `${a.house_nm} vs ${b.house_nm} — ${region} 청약 비교 분석`;
        const aUnits = (a.tot_supply_hshld_co ?? 0).toLocaleString();
        const bUnits = (b.tot_supply_hshld_co ?? 0).toLocaleString();
        const cmpContent = `## ${a.house_nm} vs ${b.house_nm} — ${region} 청약 비교

**${region}** 지역에서 관심이 높은 **${a.house_nm}**과 **${b.house_nm}** 두 단지를 비교 분석합니다. 같은 지역에 비슷한 시기에 분양하는 단지를 비교하면 청약 전략 수립에 도움이 됩니다.

두 단지 모두 ${region}에 위치해 있어 생활 인프라는 유사하지만, 세대수, 접수 일정 등에서 차이가 있습니다.

---

### 기본 비교

| 항목 | **${a.house_nm}** | **${b.house_nm}** |
|---|---|---|
| **지역** | ${region} | ${region} |
| **세대수** | ${aUnits}세대 | ${bUnits}세대 |
| **청약 접수** | ${a.rcept_bgnde?.slice(5) ?? '-'} ~ ${a.rcept_endde?.slice(5) ?? '-'} | ${b.rcept_bgnde?.slice(5) ?? '-'} ~ ${b.rcept_endde?.slice(5) ?? '-'} |

---

### 비교 분석 포인트

1. **세대 규모**: ${Number(a.tot_supply_hshld_co ?? 0) > Number(b.tot_supply_hshld_co ?? 0) ? `${a.house_nm}(${aUnits}세대)이 ${b.house_nm}(${bUnits}세대)보다 대규모입니다. 대단지일수록 커뮤니티 시설이 충실한 편입니다.` : `${b.house_nm}(${bUnits}세대)이 ${a.house_nm}(${aUnits}세대)보다 규모가 큽니다.`}

2. **접수 일정**: 접수 기간이 겹치는 경우 **중복 청약은 불가**하므로 우선순위를 정해야 합니다. 가점이 높다면 경쟁률이 높은 단지에, 추첨 전략이라면 상대적으로 경쟁률이 낮은 단지에 도전하는 것이 유리합니다.

3. **입지 비교**: 같은 ${region} 내에서도 세부 위치에 따라 교통, 학군, 상업 시설 접근성이 다릅니다. 실거주 목적이라면 현장 답사를 권합니다.

---

### 관련 정보

- [**${a.house_nm}** 청약 상세 →](/apt/${a.house_manage_no})
- [**${b.house_nm}** 청약 상세 →](/apt/${b.house_manage_no})
- [**${region}** 전체 청약 일정 →](/apt)
- [청약 관련 **커뮤니티 토론** →](/feed?category=apt)
- [**청약 마감 알림** 받기 →](/login)

두 단지의 모집공고를 꼼꼼히 비교하고, 본인의 자격 요건에 맞는 최적의 선택을 하시길 바랍니다.

> 청약홈(applyhome.co.kr) 공공데이터 기반. 투자 권유가 아닙니다.`;
        const _r = await safeBlogInsert(admin, { slug: slug3, title: cmpTitle, content: ensureMinLength(cmpContent, 'apt'), excerpt: `${region} 두 청약 단지 비교.`, category: 'apt', tags: [a.house_nm, b.house_nm, `${region} 청약`, '청약비교'], cron_type: 'weekly', cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(cmpTitle)}&type=blog`, image_alt: generateImageAlt('apt', cmpTitle), meta_description: generateMetaDesc(cmpContent), meta_keywords: generateMetaKeywords('apt', [a.house_nm, b.house_nm, `${region} 청약`, '청약비교']) });
      if (_r.success) created++;
      }
    }

    // 4. FAQ 자동 생성 (질문형 인기 글)
    const slug4 = `faq-${weekStr}`;
    const { data: e4 } = await admin.from('blog_posts').select('id').eq('slug', slug4).maybeSingle();
    if (!e4) {
      const weekAgo2 = new Date(Date.now() - 14 * 86400000).toISOString();
      const { data: qPosts } = await admin.from('posts')
        .select('title, slug, id, likes_count')
        .eq('is_deleted', false).gte('created_at', weekAgo2)
        .ilike('title', '%?%').order('likes_count', { ascending: false }).limit(8);
      if (qPosts && qPosts.length >= 3) {
        const faqItems = qPosts.map(q => `### Q. ${q.title}\n\n카더라 커뮤니티에서 **좋아요 ${q.likes_count}개**를 받은 질문입니다. 많은 회원들이 공감한 만큼 비슷한 궁금증을 가진 분들이 많습니다.\n\n자세한 답변과 다른 회원들의 의견은 [**원문 보기 →**](/feed/${q.slug || q.id})에서 확인하세요.\n`).join('\n');
        const faqContent = `## 자주 묻는 질문 — 청약·주식·부동산 (${weekStr})

최근 2주간 **카더라 커뮤니티**에서 가장 많이 물어본 질문 **${qPosts.length}개**를 정리했습니다. 청약, 주식, 부동산 관련 궁금증이 있다면 아래 질문들을 참고해보세요.

---

${faqItems}

---

### 더 많은 질문과 답변

카더라 커뮤니티에서는 매일 수십 개의 투자 관련 질문과 답변이 오가고 있습니다. 궁금한 점이 있다면 직접 글을 남겨보세요!

- [**카더라 피드**에서 질문하기 →](/feed)
- [**주식 토론** 참여 →](/feed?category=stock)
- [**청약 정보** 보기 →](/apt)

> 커뮤니티 인기 질문 기반 자동 생성. 답변은 개인 의견이며 투자 권유가 아닙니다.`;
        const _r = await safeBlogInsert(admin, { slug: slug4, title: `자주 묻는 질문 — 청약·주식·부동산 (${weekStr})`, content: ensureMinLength(faqContent, 'general'), excerpt: '커뮤니티에서 가장 많이 물어본 질문 모음.', category: 'general', tags: ['FAQ', '자주묻는질문', '청약', '주식'], cron_type: 'weekly', cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent('자주 묻는 질문')}&type=blog`, image_alt: generateImageAlt('general', `자주 묻는 질문 — 청약·주식·부동산 (${weekStr})`), meta_description: generateMetaDesc(faqContent), meta_keywords: generateMetaKeywords('general', ['FAQ', '자주묻는질문', '청약', '주식']) });
      if (_r.success) created++;
      }
    }

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    console.error('[blog-weekly]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 200 });
  }
}
