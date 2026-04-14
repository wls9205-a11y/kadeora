export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { scoreIssue, extractKeywords, detectIssueType, keywordWeight } from '@/lib/issue-scoring';
import type { IssueCandidate } from '@/lib/issue-scoring';

/**
 * issue-detect 크론 — 부동산+주식 이슈 실시간 탐지
 *
 * Phase 1: 뉴스 RSS 14곳 수집 + 키워드 매칭 + 점수 산정
 * 주기: 매 15분
 * 비용: 0원 (RSS 파싱만)
 */

/* ═══════════ RSS 피드 목록 ═══════════ */

/* ═══════════ apt_sites 동적 엔티티 캐시 ═══════════ */
let _aptNameCache: string[] = [];
async function getAptNameCache(sb: any): Promise<string[]> {
  if (_aptNameCache.length > 0) return _aptNameCache;
  try {
    const { data } = await sb.from('apt_sites').select('name').not('name', 'is', null).limit(6000);
    _aptNameCache = (data || []).map((r: any) => r.name).filter((n: string) => n && n.length >= 4);
    return _aptNameCache;
  } catch { return []; }
}

/* ═══════════ 시공사 분양예정: issue-preempt에서 처리 ═══════════ */


const APT_RSS_FEEDS = [
  { name: '부산일보_부동산', url: 'https://www.busan.com/rss/economy/realestate.xml' },
  { name: '한경_부동산', url: 'https://www.hankyung.com/feed/realestate' },
  { name: '매경_부동산', url: 'https://www.mk.co.kr/rss/realestate/' },
  { name: '머니투데이_부동산', url: 'https://rss.mt.co.kr/mt/realestate/' },
  { name: '서울경제_부동산', url: 'https://www.sedaily.com/rss/NewsList/GC' },
  { name: '조선비즈_부동산', url: 'https://biz.chosun.com/rss/realestate/' },
  { name: '아시아경제_부동산', url: 'https://www.asiae.co.kr/rss/realestate.xml' },
  { name: '뉴시스_부동산', url: 'https://newsis.com/RSS/economy.xml' },
];

const STOCK_RSS_FEEDS = [
  { name: '한경_증권', url: 'https://www.hankyung.com/feed/stock' },
  { name: '매경_증권', url: 'https://www.mk.co.kr/rss/stock/' },
  { name: '서울경제_증권', url: 'https://www.sedaily.com/rss/NewsList/GA' },
  { name: '이데일리_증권', url: 'https://rss.edaily.co.kr/edaily_stock.xml' },
  { name: '머니투데이_증권', url: 'https://rss.mt.co.kr/mt/stock/' },
  { name: '아시아경제_증권', url: 'https://www.asiae.co.kr/rss/stock.xml' },
  { name: '조선비즈_증권', url: 'https://biz.chosun.com/rss/stock/' },
  { name: 'SBS비즈_증권', url: 'https://biz.sbs.co.kr/rss/news.xml' },
];

const FINANCE_RSS_FEEDS = [
  { name: '한경_마이머니', url: 'https://www.hankyung.com/feed/money' },
  { name: '머니투데이_재테크', url: 'https://rss.mt.co.kr/mt/money/' },
  { name: '조선비즈_금융', url: 'https://biz.chosun.com/rss/finance/' },
];

const ECONOMY_RSS_FEEDS = [
  { name: '한경_경제', url: 'https://www.hankyung.com/feed/economy' },
  { name: '이데일리_경제', url: 'https://rss.edaily.co.kr/edaily_economy.xml' },
  { name: '서울경제_경제', url: 'https://www.sedaily.com/rss/NewsList/GB' },
];

const LIFE_RSS_FEEDS = [
  { name: '머니투데이_생활경제', url: 'https://rss.mt.co.kr/mt/life/' },
  { name: '한경_라이프', url: 'https://www.hankyung.com/feed/life' },
];

const GOV_RSS_FEEDS = [
  { name: '기재부_보도', url: 'https://www.moef.go.kr/com/bbs/RSS.do?bbsId=MOSFBBS_000000000028' },
  { name: '국토부_보도', url: 'https://www.molit.go.kr/rss/RSS.do?bbsId=MLTM_000000000015' },
  { name: '금융위_보도', url: 'https://www.fsc.go.kr/rss/RSS.do?bbsId=BBS_000000000' },
  { name: '고용부_보도', url: 'https://www.moel.go.kr/rss/RSS.do?bbsId=BBS_0000000000' },
  { name: '국세청_보도', url: 'https://www.nts.go.kr/rss/RSS.do?bbsId=BBS_0000000000' },
];




/* ═══════════ Google Trends RSS (무료) ═══════════ */

async function fetchGoogleTrends(): Promise<RSSItem[]> {
  try {
    const res = await fetch('https://trends.google.co.kr/trending/rss?geo=KR', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: RSSItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '';
      const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const traffic = block.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/)?.[1] || '';
      const newsUrl = block.match(/<ht:news_item_url>(.*?)<\/ht:news_item_url>/)?.[1] || link;
      if (title) items.push({ title, link: newsUrl || link, pubDate: '', description: `구글 급상승: ${traffic}`, source: 'Google_Trends' });
    }
    return items.slice(0, 15);
  } catch { return []; }
}


/* ═══════════ DART 전자공시 수집 ═══════════ */

async function fetchDARTDisclosures(): Promise<RSSItem[]> {
  const DART_KEY = process.env.DART_API_KEY;
  if (!DART_KEY) return [];
  try {
    // 최근 공시 목록 (당일)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const res = await fetch(
      `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_KEY}&bgn_de=${today}&end_de=${today}&page_count=20`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== '000' || !data.list) return [];

    // 주요 공시만 필터링 (유증, M&A, 실적, 소송 등)
    const majorTypes = ['유상증자', '무상증자', '합병', '분할', '영업실적', '대표이사변경', '주요주주', '자기주식', '배당', '소송'];
    const filtered = data.list.filter((d: any) =>
      majorTypes.some(t => (d.report_nm || '').includes(t))
    );

    return filtered.map((d: any) => ({
      title: `[DART] ${d.corp_name} — ${d.report_nm}`,
      link: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}`,
      pubDate: d.rcept_dt || '',
      description: `${d.corp_name} ${d.report_nm} (${d.flr_nm})`,
      source: 'DART_공시',
    }));
  } catch { return []; }
}

/* ═══════════ RSS 파싱 ═══════════ */

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  source: string;
}

async function fetchRSS(feed: { name: string; url: string }): Promise<RSSItem[]> {
  try {
    const res = await fetch(feed.url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const xml = await res.text();

    // 간단한 XML 파싱 (item/entry 추출)
    const items: RSSItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1] || match[2];
      const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '';
      const link = block.match(/<link[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>|<link[^>]*href="([^"]+)"/)?.[1]
        || block.match(/<link[^>]*href="([^"]+)"/)?.[1] || '';
      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>|<published>(.*?)<\/published>/)?.[1]
        || block.match(/<published>(.*?)<\/published>/)?.[1] || '';
      const desc = block.match(/<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/)?.[1]?.trim() || '';

      if (title) items.push({ title, link: link.trim(), pubDate, description: desc, source: feed.name });
    }

    // 최근 3시간 이내 기사만
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    return items.filter(item => {
      if (!item.pubDate) return true; // 날짜 없으면 포함
      const d = new Date(item.pubDate).getTime();
      return d > threeHoursAgo;
    }).slice(0, 10);
  } catch {
    return [];
  }
}

/* ═══════════ 중복 체크 (v2 — 키워드+카테고리+제목 3중 방어) ═══════════ */

async function isDuplicate(
  sb: any,
  entities: string[],
  title: string,
  keywords: string[],
  category: string,
  issueType: string,
): Promise<{ isDup: boolean; existingId?: string }> {
  if (!title && entities.length === 0 && keywords.length === 0) return { isDup: false };
  const since = new Date(Date.now() - 24 * 3600000).toISOString();

  // 1) pg_trgm 타이틀 유사도 체크 (similarity > 0.2)
  if (title) {
    try {
      const { data: simMatch } = await sb.rpc('check_issue_similarity', {
        p_title: title,
        p_threshold: 0.2,
        p_since: since,
      });
      if (simMatch && simMatch.length > 0) return { isDup: true, existingId: simMatch[0].id };
    } catch {
      // RPC 미존재 시 fallback: 앞 30자 체크
      const shortTitle = title.slice(0, 30);
      const { data: titleMatch } = await sb.from('issue_alerts')
        .select('id').ilike('title', `%${shortTitle}%`)
        .gte('detected_at', since).limit(1);
      if (titleMatch && titleMatch.length > 0) return { isDup: true, existingId: titleMatch[0].id };
    }
  }

  // 2) 키워드 2개 이상 겹치면 + 같은 카테고리 → 중복
  if (keywords.length >= 2) {
    const { data: kwMatch } = await (sb as any).from('issue_alerts')
      .select('id, detected_keywords')
      .eq('category', category)
      .gte('detected_at', since)
      .limit(50);
    if (kwMatch) {
      for (const row of kwMatch) {
        const existingKw: string[] = row.detected_keywords || [];
        const overlap = keywords.filter((k: string) => existingKw.includes(k));
        if (overlap.length >= 2) return { isDup: true, existingId: row.id };
      }
    }
  }

  // 3) 같은 카테고리 + 같은 issue_type → 6시간 내 1건만 허용
  if (issueType && !['apt_general', 'stock_general', 'finance_general', 'economy_general', 'life_general', 'tax_general', 'general'].includes(issueType)) {
    const sixHoursAgo = new Date(Date.now() - 6 * 3600000).toISOString();
    const { data: typeMatch } = await (sb as any).from('issue_alerts')
      .select('id')
      .eq('category', category)
      .eq('sub_category', issueType)
      .gte('detected_at', sixHoursAgo)
      .limit(1);
    if (typeMatch && typeMatch.length > 0) return { isDup: true, existingId: typeMatch[0].id };
  }

  // 4) 엔티티 overlap (기존 로직 유지)
  if (entities.length > 0) {
    const { data } = await (sb as any).from('issue_alerts')
      .select('id, final_score, title')
      .overlaps('related_entities', entities)
      .gte('detected_at', since)
      .order('final_score', { ascending: false })
      .limit(1);
    if (data && data.length > 0) return { isDup: true, existingId: data[0].id };
  }

  return { isDup: false };
}

/* ═══════════ 엔티티 추출 (단지명/종목명) ═══════════ */

function extractEntities(title: string, description: string): string[] {
  const text = `${title} ${description}`;
  const entities: string[] = [];

  // 아파트 브랜드 패턴 — 전국 시공사 브랜드 전수 (50+ 브랜드)
  const aptPatterns = /([가-힣]{1,10}(?:자이|래미안|푸르지오|힐스테이트|아이파크|이편한세상|더샵|파크리오|SK뷰|롯데캐슬|e편한세상|센트럴|프레스티지|디에이치|르엘|아크로|시그니처|카운티|위브|트리니뷰|더제니스|꿈에그린|제일풍경채|중흥S클래스|우미린|금강펜테리움|호반써밋|한화포레나|대방엘리움|쌍용예가|동원로얄듀크|한신더휴|코아루|동문굿모닝힐|부영사랑으로|대림아크로|라인건설|서희스타힐스|모아엘가|태영데시앙|신영지웰|반도유보라|비스타동원|한라비발디|계룡리슈빌|태왕아너스|동부센트레빌|포스코더샵|대우조선해양|한양수자인|청솔|에코델타|트레지움|포레스트|더퍼스트|더센트럴|센트레빌|에피트))/g;
  let m;
  while ((m = aptPatterns.exec(text)) !== null) entities.push(m[1]);

  // 특수 단지명 확장 — 유명 단지 + 신규 브랜드
  const specialNames = [
    // 서울 핫 단지
    '래미안원베일리', '아크로리버파크', '반포자이', '디에이치퍼스티어', '올림픽파크포레온',
    '레이카운티', '아크로리버하임', '래미안퍼스티지', '래미안원펜타스', '오티에르반포',
    // 부산 핫 단지
    '힐스테이트아이코닉', '두산위브트리니뷰', '두산위브트리니뷰구명역',
    '거제역동원로얄듀크', '금강펜테리움', '해운대삼성콘도맨션',
    // 전국 대형 단지
    '검단파라곤', '동탄그웬', '광교자이', '위례자이', '마곡자이',
  ];
  for (const name of specialNames) {
    if (text.includes(name) && !entities.includes(name)) entities.push(name);
  }

  // 종목명: stock_quotes에서 매칭 (나중에 DB 조회로 확장)
  // 일단 주요 종목 하드코딩
  const majorStocks = ['삼성전자', 'SK하이닉스', '현대차', 'LG에너지솔루션', '삼성바이오로직스',
    'NAVER', '카카오', '셀트리온', '기아', 'POSCO홀딩스', 'KB금융', '신한지주', '현대모비스',
    'LG화학', '삼성SDI', 'SK이노베이션', '한화에어로스페이스', '두산에너빌리티',
    '엔비디아', '테슬라', '애플', '마이크로소프트', '구글', '아마존', '메타'];
  for (const stock of majorStocks) {
    if (text.includes(stock) && !entities.includes(stock)) entities.push(stock);
  }

  // DB 기반 apt_sites 동적 매칭 (캐시 사용)
  if (_aptNameCache.length > 0) {
    for (const name of _aptNameCache) {
      if (name.length >= 5 && text.includes(name) && !entities.includes(name)) {
        entities.push(name);
      }
    }
  }

  // 지역 + 브랜드 복합 패턴: "구명역 두산위브", "범천 힐스테이트" 등
  const locationBrandPattern = /([가-힣]{2,4}(?:역|동|구|시))\s*([가-힣]{2,8}(?:위브|자이|래미안|푸르지오|힐스테이트|아이파크|더샵|롯데캐슬|포레나|트리니뷰|더제니스))/g;
  let lbm;
  while ((lbm = locationBrandPattern.exec(text)) !== null) {
    const fullName = `${lbm[2]}${lbm[1]}`.trim();
    if (!entities.includes(fullName) && !entities.includes(lbm[2])) entities.push(lbm[2]);
  }

  return [...new Set(entities)];
}

/* ═══════════ 기존 기사 체크 ═══════════ */

async function checkExistingPosts(sb: any, entities: string[]): Promise<number> {
  if (entities.length === 0) return 0;
  try {
    const { count } = await sb.from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .or(entities.map((e: string) => `title.ilike.%${e}%`).join(','));
    return count || 0;
  } catch {
    return 0;
  }
}

/* ═══════════ 메인 핸들러 ═══════════ */

async function handler(_req: NextRequest) {
  const result = await withCronLogging('issue-detect', async () => {
  const sb = getSupabaseAdmin();
  const results: any[] = [];
  const seenTitles = new Set<string>(); // 동일 실행 내 중복 방지

  // apt_sites 이름 캐시 로드 (엔티티 매칭용)
  await getAptNameCache(sb);

  // 시간대별 소스 분기
  const now = new Date();
  const minute = now.getMinutes();
  const isGroupA = minute < 15 || (minute >= 30 && minute < 45); // :00, :30

  // 1. RSS 수집 (병렬)
  // v2: 전체 RSS + Google Trends + 카테고리 확장
  const feeds = isGroupA
    ? [...APT_RSS_FEEDS, ...STOCK_RSS_FEEDS, ...FINANCE_RSS_FEEDS, ...ECONOMY_RSS_FEEDS, ...LIFE_RSS_FEEDS, ...GOV_RSS_FEEDS]
    : [...APT_RSS_FEEDS, ...FINANCE_RSS_FEEDS]; // 그룹B: 부동산+재테크

  const allItems = await Promise.allSettled(feeds.map(f => fetchRSS(f)));
  const rssItems: RSSItem[] = [];
  for (const r of allItems) {
    if (r.status === 'fulfilled') rssItems.push(...r.value);
  }

  // v2: Google Trends RSS + DART 공시 병합
  const [googleItems, dartItems] = await Promise.all([fetchGoogleTrends(), fetchDARTDisclosures()]);
  rssItems.push(...googleItems, ...dartItems);

  const sampleTitles = rssItems.slice(0, 5).map(r => r.title.slice(0, 40)).join(' | ');
  console.log(`[issue-detect] RSS: ${rssItems.length}, Google: ${googleItems.length}, DART: ${dartItems.length} | ${sampleTitles}`);
  if (rssItems.length === 0) {
    return { processed: 0, created: 0, failed: 0, metadata: { message: 'no RSS items' } };
  }

  // 2. 기사별 키워드 매칭 + 이슈 후보 추출
  const issueMap = new Map<string, { items: RSSItem[]; keywords: string[]; category: 'apt' | 'stock'; entities: string[] }>();

  for (const item of rssItems) {
    const text = `${item.title} ${item.description || ''}`;
    const kw = extractKeywords(text);
    const allKw = [...kw.apt, ...kw.stock, ...kw.finance, ...kw.tax, ...kw.economy, ...kw.life];

    if (allKw.length === 0) continue;

    // 최다 매칭 카테고리 선택
    const catScores: [string, number][] = [
      ['apt', kw.apt.length], ['stock', kw.stock.length],
      ['finance', kw.finance.length], ['tax', kw.tax.length],
      ['economy', kw.economy.length], ['life', kw.life.length],
    ];
    catScores.sort((a, b) => b[1] - a[1]);
    const category = (catScores[0][0] || 'apt') as any;
    const keywords = (kw as any)[category] as string[];
    const entities = extractEntities(item.title, item.description || '');

    // 엔티티 기반 그룹핑 (같은 단지/종목 기사 묶기)
    const groupKey = entities.length > 0 ? entities.sort().join('|') : item.title.slice(0, 20);

    if (issueMap.has(groupKey)) {
      const existing = issueMap.get(groupKey)!;
      existing.items.push(item);
      existing.keywords = [...new Set([...existing.keywords, ...keywords])];
    } else {
      issueMap.set(groupKey, { items: [item], keywords, category, entities });
    }
  }

  // 3. 이슈별 점수 계산 + INSERT
  for (const [_key, group] of issueMap) {
    const { items, keywords, category, entities } = group;

    // 키워드 가중치 체크: 너무 약한 키워드만 있으면 스킵
    if (keywordWeight(keywords) < 1) continue;

    // 동일 실행 내 제목 중복 방지
    const titleKey = items[0].title.slice(0, 40);
    if (seenTitles.has(titleKey)) continue;
    seenTitles.add(titleKey);

    // 이슈 유형 판별 (중복 체크에서도 사용)
    const issueType = detectIssueType(keywords, category);

    // 중복 체크 (v2: 키워드+카테고리+제목 3중 방어)
    const { isDup, existingId } = await isDuplicate(sb, entities, items[0].title, keywords, category, issueType);
    if (isDup) {
      // 기존 이슈 존재 → 중복 스킵 (추후 증폭계수 업데이트는 issue-trend에서)
      continue;
    }

    // 기존 기사 수 체크
    const existingPosts = await checkExistingPosts(sb, entities);

    // 이슈 후보 구성
    const candidate: IssueCandidate = {
      title: items[0].title,
      summary: items.map(i => i.title).join(' | '),
      category,
      sub_category: issueType,
      issue_type: issueType,
      source_type: 'news_rss',
      source_urls: items.map(i => i.link).filter(Boolean),
      detected_keywords: keywords,
      related_entities: entities,
      raw_data: {
        media_count: items.length,
        existing_posts: existingPosts,
        existing_posts_age_days: existingPosts > 0 ? 0 : 999,
        is_breaking: true,
        has_news: true,
        source_type: 'news_rss',
      },
    };

    // 점수 계산
    const score = scoreIssue(candidate);

    // 25점 미만 무시
    if (score.final_score < 10) continue;

    // INSERT
    const { error } = await (sb as any).from('issue_alerts').insert({
      title: candidate.title,
      summary: candidate.summary,
      category: candidate.category,
      sub_category: candidate.sub_category,
      issue_type: candidate.issue_type,
      source_type: candidate.source_type,
      source_urls: candidate.source_urls,
      detected_keywords: candidate.detected_keywords,
      related_entities: candidate.related_entities,
      raw_data: candidate.raw_data,
      base_score: score.base_score,
      multiplier: score.multiplier,
      penalty_rate: score.penalty_rate,
      final_score: score.final_score,
      score_breakdown: score.breakdown,
      is_auto_publish: score.is_auto_publish,
      block_reason: score.block_reason || null,
      detected_at: new Date().toISOString(),
    });

    if (!error) {
      results.push({
        title: candidate.title,
        score: score.final_score,
        auto: score.is_auto_publish,
        keywords: keywords.slice(0, 5),
        entities,
        media: items.length,
      });

      // v2: score 50+ → issue-draft 즉시 트리거 (20분 대기 없이 즉시 발행)
      if (score.final_score >= 50) {
        try {
          const draftUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app'}/api/cron/issue-draft`;
          fetch(draftUrl, {
            method: 'GET',
            headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
          }).catch(() => {}); // fire-and-forget (타임아웃 없음 — 독립 실행)
          console.log(`[issue-detect] 🚀 instant trigger: score=${score.final_score} "${candidate.title.slice(0, 30)}"`);
        } catch {}
      }
    }
  }

  console.log(`[issue-detect] detected: ${results.length}, rss_items: ${rssItems.length}, keyword_matches: ${issueMap.size}`);
  return {
    processed: rssItems.length,
    created: results.length,
    failed: 0,
    metadata: {
      detected: results.length,
      rss_items: rssItems.length,
      issues: results.slice(0, 10),
    },
  };
  }); // withCronLogging
  return NextResponse.json(result);
}

export const GET = withCronAuth(handler);
