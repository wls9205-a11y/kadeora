// V18 B — 일일 피드 생성기 (Edge Function).
//
// ⚠️ 이 파일은 Next.js 밖이다. `npm run build` 로 나가지 않는다.
//    배포: `supabase functions deploy daily-content`
//
// ── 무엇을 고쳤나 ──
// 이전 판은 42줄에 **하드코딩 템플릿 3개**였다. 내용이 `반도체: 외국인 순매수 지속` 같은
// 고정 문장이라 어제 글과 오늘 글이 똑같았고, `view_count` 를 `Math.random()` 으로 채웠다.
// **비율만 바꾸면 껍데기 글이 부동산 이름으로 늘어날 뿐이라** 실데이터 전환이 본체다.
//
//   A  부울경 이번 주 청약 일정      ← apt_subscriptions
//   B  부울경 단계 변경 현장         ← apt_site_events (7일 실측 71건 · 부울경 31건)
//   C  부울경 미분양·실거래 변동     ← apt_transactions
//
// ⚠️ **대상이 없는 날은 올리지 않는다.** 빈 템플릿을 만들지 않는다.
// ⚠️ `view_count` 를 지어내지 않는다. 0 에서 시작한다.
// ⚠️ 지역 판정은 **`apt_sites.region`**. 제목 문자열 매칭으로 잡으면 4.3% 밖에 안 걸린다.
// ⚠️ `apt_tags` 를 채운다. 피드 → 현장 페이지 → 리드폼 동선이 없으면
//    피드는 트래픽만 쓰고 끝난다 (30일 신규 2,678건이 전부 비어 있었다).
//
// ── 비율 ──
// 부동산 3슬롯은 매일, 주식·잡담은 3일에 한 번씩 (요일 오프셋으로 겹치지 않게).
// 3일 기준 부동산 9 · 주식 1 · 잡담 1 = **82 / 9 / 9**.
// ⚠️ 주식·잡담을 0 으로 만들지 않는다. 커뮤니티가 한 주제만 있으면 죽는다.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const AUTHORS = [
  '265d8c3b-bd40-40c1-b7d2-bdde16a88204',
  '6e215791-e908-4651-a951-3d1fd90fa0d1',
  'b9dca4b5-c280-4c5f-8af8-84648723fe23',
  'f761ff84-7a69-4a13-b52e-5192a2bbe1a3',
  'a01c798d-2883-49c7-b3c2-660b3c7ec356',
];

/** 부산·울산·경남. apt_sites.region 값 그대로다. */
const BUGYEONG = ['부산', '울산', '경남'];

const pickAuthor = () => AUTHORS[Math.floor(Math.random() * AUTHORS.length)];
const won = (manwon: number) =>
  manwon >= 10000 ? `${(manwon / 10000).toFixed(1)}억` : `${manwon.toLocaleString('ko-KR')}만`;

const STAGE_LABEL: Record<string, string> = {
  union_established: '조합설립',
  constructor_selected: '시공사 선정',
  plan_approved: '사업시행인가',
  mgmt_approved: '관리처분인가',
  construction: '착공',
  site_planning: '부지계획',
  pre_announcement: '분양 예고',
  subscription_open: '청약 진행',
  award_announced: '당첨자 발표',
  move_in_ready: '입주 예정',
  move_in_started: '입주중',
  post_move_in: '입주 후',
  unsold_active: '미분양',
};
const stageLabel = (s: string | null) => (s ? STAGE_LABEL[s] ?? s : null);

interface Draft {
  category: string;
  title: string;
  content: string;
  hashtags: string[];
  aptTags: string[];
  /** 부울경 소재인가. 비중 로그용. */
  bugyeong: boolean;
}

/* ───────────────────────── A · 이번 주 청약 일정 ───────────────────────── */

async function slotSubscriptions(kstDate: string): Promise<Draft | null> {
  const today = new Date().toISOString().slice(0, 10);
  const weekLater = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from('apt_subscriptions')
    .select('house_nm, region_nm, supply_addr, tot_supply_hshld_co, rcept_bgnde, rcept_endde, slug, constructor_nm')
    .in('region_nm', BUGYEONG)
    .gte('rcept_bgnde', today)
    .lte('rcept_bgnde', weekLater)
    .order('rcept_bgnde', { ascending: true })
    .limit(8);

  const rows = data ?? [];
  // 대상이 없으면 올리지 않는다.
  if (rows.length === 0) return null;

  const lines = rows.map((r: any) => {
    const where = [r.region_nm, r.supply_addr].filter(Boolean).join(' ').slice(0, 40);
    const units = r.tot_supply_hshld_co ? ` · ${Number(r.tot_supply_hshld_co).toLocaleString('ko-KR')}세대` : '';
    const builder = r.constructor_nm ? ` · ${r.constructor_nm}` : '';
    return `· ${r.house_nm} — ${r.rcept_bgnde} 접수${units}${builder}\n  ${where}`;
  });

  return {
    category: 'apt',
    title: `${kstDate} 부울경 이번 주 청약 ${rows.length}곳`,
    content:
      `부산·울산·경남에서 이번 주 접수 시작하는 단지입니다.\n\n${lines.join('\n')}\n\n` +
      `일정과 공급 세대수는 모집공고 기준입니다. 변경될 수 있으니 청약홈에서 확인하세요.`,
    hashtags: ['부울경청약', '청약일정'],
    aptTags: rows.map((r: any) => r.slug).filter(Boolean),
    bugyeong: true,
  };
}

/* ───────────────────────── B · 단계 변경 현장 ───────────────────────── */

async function slotStageChanges(kstDate: string): Promise<Draft | null> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // ⚠️ 지역은 apt_sites.region 으로 본다. 제목 문자열 매칭이 4.3% 밖에 못 잡던 원인이다.
  const { data } = await supabase
    .from('apt_site_events')
    .select(
      'to_value, from_value, confidence, occurred_at, apt_sites!inner(slug, name, region, sigungu, builder, is_active)',
    )
    .eq('event_type', 'stage_change')
    .gte('occurred_at', since)
    .eq('apt_sites.is_active', true)
    .in('apt_sites.region', BUGYEONG)
    .order('occurred_at', { ascending: false })
    .limit(20);

  const seen = new Set<string>();
  const rows = (data ?? []).filter((r: any) => {
    const slug = r.apt_sites?.slug;
    if (!slug || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  }).slice(0, 6);

  if (rows.length === 0) return null;

  const lines = rows.map((r: any) => {
    const s = r.apt_sites;
    const to = stageLabel(r.to_value) ?? '단계 변경';
    const from = stageLabel(r.from_value);
    const where = [s.region, s.sigungu].filter(Boolean).join(' ');
    // 등급을 감추지 않는다. 추정·카더라를 확정처럼 보이게 하지 않는다.
    const grade = r.confidence === 'confirmed' ? '확정' : r.confidence === 'estimated' ? '추정' : '카더라';
    return `· ${s.name} — ${from ? `${from} → ` : ''}${to} [${grade}]\n  ${where}${s.builder ? ` · ${s.builder}` : ''}`;
  });

  return {
    category: 'apt',
    title: `${kstDate} 부울경 단계 바뀐 현장 ${rows.length}곳`,
    content:
      `최근 7일 사이 진행 단계가 바뀐 부울경 현장입니다.\n\n${lines.join('\n')}\n\n` +
      `[확정]은 고시·공시 원문, [추정]은 복수 언론, [카더라]는 업계·조합 전언 기준입니다.`,
    hashtags: ['부울경재개발', '정비사업'],
    aptTags: rows.map((r: any) => r.apt_sites.slug),
    bugyeong: true,
  };
}

/* ───────────────────────── C · 실거래 변동 ───────────────────────── */

async function slotTrades(kstDate: string): Promise<Draft | null> {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from('apt_transactions')
    .select('apt_name, region_nm, sigungu, deal_amount, exclusive_area, floor, deal_date')
    .in('region_nm', BUGYEONG)
    .gte('deal_date', since)
    .gt('deal_amount', 0)
    .order('deal_amount', { ascending: false })
    .limit(8);

  const rows = data ?? [];
  if (rows.length === 0) return null;

  const lines = rows.map((r: any) => {
    const area = r.exclusive_area ? ` ${Number(r.exclusive_area).toFixed(0)}㎡` : '';
    const fl = r.floor ? ` ${r.floor}층` : '';
    return `· ${r.apt_name}${area}${fl} — ${won(Number(r.deal_amount))} (${r.deal_date})\n  ${[r.region_nm, r.sigungu].filter(Boolean).join(' ')}`;
  });

  // ── ADDENDUM §1-3 · 실거래 슬롯의 apt_tags ──
  //
  // apt_transactions 에는 slug 가 없고 `해운대두산위브더제니스` 처럼 apt_sites.name 과
  // 표기가 다르다. **정확 일치로만** 붙이고, 못 찾으면 태그 없이 둔다.
  // ⚠️ 부분 문자열 매칭 금지 — `자이`·`푸르지오` 같은 조각이 엉뚱한 현장을 끌어온다.
  const names = [...new Set(rows.map((r: any) => String(r.apt_name ?? '').trim()).filter(Boolean))];
  const aptTags = names.length > 0 ? await resolveSlugsExact(names) : [];

  return {
    category: 'apt',
    title: `${kstDate} 부울경 최근 2주 고가 실거래 ${rows.length}건`,
    content:
      `부산·울산·경남에서 최근 2주 사이 신고된 거래 중 금액 상위입니다.\n\n${lines.join('\n')}\n\n` +
      `국토교통부 실거래 신고 기준이라 계약일과 신고일이 다를 수 있습니다.`,
    hashtags: ['부울경실거래', '아파트시세'],
    aptTags,
    bugyeong: true,
  };
}

/**
 * 아파트명 → slug. **정확 일치만** 인정한다.
 *   1) apt_sites.name 정확 일치
 *   2) apt_sites.name_variants 배열에 그 문자열이 원소로 들어 있는 경우
 * 둘 다 아니면 버린다. 부분 문자열·유사도 매칭은 하지 않는다.
 */
async function resolveSlugsExact(names: string[]): Promise<string[]> {
  const out = new Set<string>();

  const { data: byName } = await supabase
    .from('apt_sites')
    .select('slug, name')
    .eq('is_active', true)
    .in('name', names);
  const matched = new Set<string>();
  for (const r of byName ?? []) {
    out.add((r as any).slug);
    matched.add((r as any).name);
  }

  const rest = names.filter((n) => !matched.has(n));
  if (rest.length === 0) return [...out];

  // overlaps 로 후보만 좁힌 뒤, 배열 원소가 **정확히** 같은지 코드에서 다시 확인한다.
  const { data: byVariant } = await supabase
    .from('apt_sites')
    .select('slug, name_variants')
    .eq('is_active', true)
    .overlaps('name_variants', rest);
  for (const r of byVariant ?? []) {
    const variants: unknown = (r as any).name_variants;
    if (!Array.isArray(variants)) continue;
    if (variants.some((v) => typeof v === 'string' && rest.includes(v.trim()))) {
      out.add((r as any).slug);
    }
  }

  return [...out];
}

/* ───────────────────────── 주식 · 잡담 (각 3일에 한 번) ───────────────────────── */

async function slotStock(kstDate: string): Promise<Draft | null> {
  const { data } = await supabase
    .from('stock_quotes')
    .select('name, symbol, change_pct, price')
    .not('change_pct', 'is', null)
    .order('change_pct', { ascending: false })
    .limit(5);

  const rows = data ?? [];
  if (rows.length === 0) return null;

  const lines = rows.map(
    (r: any) => `· ${r.name}(${r.symbol}) ${Number(r.change_pct) >= 0 ? '+' : ''}${Number(r.change_pct).toFixed(2)}%`,
  );
  return {
    category: 'stock',
    title: `${kstDate} 오늘 많이 오른 종목`,
    content: `${lines.join('\n')}\n\n수치는 최근 시세 기준입니다. 투자 권유가 아닙니다.`,
    hashtags: ['오늘의주식'],
    aptTags: [],
    bugyeong: false,
  };
}

function slotFree(kstDate: string): Draft {
  return {
    category: 'free',
    title: `${kstDate} 오늘의 이야기`,
    content: '요즘 관심 있는 주제나 궁금한 것 있으면 편하게 남겨주세요.',
    hashtags: ['자유게시판'],
    aptTags: [],
    bugyeong: false,
  };
}

/* ───────────────────────── 실행 ───────────────────────── */

Deno.serve(async () => {
  const kstDate = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/\. /g, '.')
    .replace(/\.$/, '');

  const todayStart = new Date().toISOString().slice(0, 10);
  // 3일 주기 오프셋. 주식과 잡담이 같은 날 겹치지 않게 어긋나 있다.
  const dayIndex = Math.floor(Date.now() / 86_400_000);

  const drafts: Array<Draft | null> = [
    await slotSubscriptions(kstDate),
    await slotStageChanges(kstDate),
    await slotTrades(kstDate),
    dayIndex % 3 === 0 ? await slotStock(kstDate) : null,
    dayIndex % 3 === 1 ? slotFree(kstDate) : null,
  ];

  let created = 0;
  let skippedNoData = 0;
  let skippedDuplicate = 0;
  const titles: string[] = [];

  for (const d of drafts) {
    if (!d) {
      skippedNoData++;
      continue;
    }

    // 같은 제목이 오늘 이미 있으면 만들지 않는다.
    // (카테고리 단위로 막으면 부동산 3슬롯 중 하나만 올라간다.)
    const { data: existing } = await supabase
      .from('posts')
      .select('id')
      .eq('title', d.title)
      .gte('created_at', todayStart)
      .limit(1);
    if (existing && existing.length > 0) {
      skippedDuplicate++;
      continue;
    }

    const { error } = await supabase.from('posts').insert({
      author_id: pickAuthor(),
      category: d.category,
      region_id: 'all',
      title: d.title,
      content: d.content,
      hashtags: d.hashtags,
      // 피드 → 현장 → 리드폼 동선. 비어 있으면 피드가 트래픽만 쓰고 끝난다.
      apt_tags: d.aptTags,
      likes_count: 0,
      // ⚠️ view_count 를 지어내지 않는다. 0 에서 시작한다.
      view_count: 0,
      is_deleted: false,
    });
    if (error) {
      console.error('[daily-content] insert 실패:', error.message);
      continue;
    }
    created++;
    titles.push(d.title);
  }

  const body = {
    success: true,
    date: kstDate,
    created,
    skipped_no_data: skippedNoData,
    skipped_duplicate: skippedDuplicate,
    realestate: drafts.filter((d) => d?.category === 'apt').length,
    bugyeong: drafts.filter((d) => d?.bugyeong).length,
    titles,
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
});
