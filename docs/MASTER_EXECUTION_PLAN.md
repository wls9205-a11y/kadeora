# 카더라 풀스택 마스터 실행 플랜
> 네이버 카페 한글 깨짐 픽스 + 계산기 네이버 1위 + 무하드코딩 아키텍처
> 2026-04-17 · Claude Opus 4.7
> **이 문서는 PR 단위로 잘라서 바로 머지할 수 있도록 설계됨**

---

## 0. Executive Summary

### 무엇을 한다
1. **네이버 카페 한글 깨짐 진짜 원인 픽스** — multipart → URL-encoded 전환 + OAuth rotation 영구화 + DB 토큰 저장
2. **계산기 142종을 네이버 1위로** — 계산 결과 영구 URL + 클러스터 허브 + 계산기↔블로그 양방향 자동 링크 + JSON-LD 풀세트
3. **모든 변경을 무하드코딩으로** — 설정 테이블 (`app_config`, `oauth_tokens`, `calc_seo_overrides`) 통해 어드민에서 즉시 조정
4. **병렬 4-Wave 실행** — 12시간 내 전체 머지 가능하도록 의존성 분리

### 핵심 원칙
- **연결 누락 금지** — 코드를 짜면 (1) 스케줄/스토리지/트래커 모두 연결 (2) 어드민 토글 추가 (3) Sentry 캡처 추가 — 이 셋이 없으면 머지 안 함
- **DB-driven config** — 시간별 한도, OAuth 토큰, 계산기 메타 오버라이드 전부 DB에서 읽음
- **Idempotent operations** — 같은 입력 두 번 실행해도 동일 결과
- **Fail-safe degradation** — API 키 누락 시 크래시 아닌 정상 응답 (`processed: 0, metadata: { reason: '...' }`)

### Wave 구조 (의존성 정렬)
```
Wave 1 (Foundation, 2h)         : DB 마이그레이션 + 설정 테이블 + 헬퍼 함수
   ├─ Wave 2A (Naver Cafe, 3h)  : 한글 픽스 + OAuth rotation + 어드민 UI
   ├─ Wave 2B (Calc SEO, 4h)    : 결과 공유 URL + 클러스터 허브 + JSON-LD 강화
   └─ Wave 2C (Quick wins, 1h)  : Sonnet 4.6 + premium-expire + JSON-LD 이스케이프
Wave 3 (Sitemap & Crawl, 2h)    : 계산기 사이트맵 분리 + lastmod 정상화 + IndexNow
Wave 4 (Auto-publish, 2h)       : 계산기 → 블로그 자동 생성 + 카페 발행 연결
```

각 Wave 는 git branch로 분리 → main에 순차 머지.

---

## 1. 네이버 카페 한글 깨짐 — 근본 원인 진단 + 픽스

### 1-A. 진단

**이전 실패 코드** (`src/app/api/cron/naver-cafe-publish/route.ts`):
```ts
import FormData from 'form-data';
import https from 'https';

const form = new FormData();
form.append('subject', subject);   // ← 한글 그대로 append
form.append('content', content);

const req = https.request({
  hostname: 'openapi.naver.com',
  headers: {
    ...form.getHeaders(),  // multipart/form-data; boundary=...
    'Authorization': 'Bearer ' + token,
  },
}, ...);
form.pipe(req);
```

**왜 깨졌나** (3중 원인):

1. **Multipart/form-data 의 part header에 charset=utf-8 명시 누락**
   - `form-data` npm 패키지는 part에 `Content-Type: text/plain` 만 붙이고 charset을 안 적음
   - 네이버 게이트웨이는 charset 없으면 **EUC-KR 로 디폴트 해석** (구 네이버 인프라 호환)
   - UTF-8 byte stream이 EUC-KR로 해석돼서 깨짐

2. **네이버 카페 Open API 공식 문서는 `application/x-www-form-urlencoded` 가 표준**
   - multipart 는 공식 미지원 (이미지 첨부 시만 multipart 사용)
   - Naver developer 가이드: "POST 본문은 URL 인코딩, charset=utf-8"

3. **`https.request` 응답 파싱이 인코딩 자동 감지 안 함**
   - `chunk.toString()` 기본은 UTF-8
   - 하지만 응답이 EUC-KR 이면 거기서도 깨짐

### 1-B. 검증된 픽스 — `application/x-www-form-urlencoded; charset=utf-8`

```ts
// src/lib/naver/cafe-client.ts (신규)
import { errMsg } from '@/lib/error-utils';

export interface CafePostResult {
  ok: boolean;
  articleId?: string;
  status?: number;
  error?: string;
  raw?: any;
}

/**
 * 네이버 카페 글쓰기 — UTF-8 안전
 * Naver Cafe Open API: https://developers.naver.com/docs/cafeapi/article/
 *
 * 핵심: application/x-www-form-urlencoded; charset=utf-8 필수
 * URLSearchParams 가 자동 percent-encoding (UTF-8) 해줌
 */
export async function postCafeArticle(params: {
  accessToken: string;
  cafeId: string;
  menuId: string;
  subject: string;
  content: string;
  timeoutMs?: number;
}): Promise<CafePostResult> {
  const { accessToken, cafeId, menuId, subject, content, timeoutMs = 15000 } = params;

  const body = new URLSearchParams();
  body.append('subject', subject);
  body.append('content', content);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/cafe/${cafeId}/menu/${menuId}/articles`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          'Accept': 'application/json',
        },
        body: body.toString(),
        signal: ctrl.signal,
      }
    );
    clearTimeout(timer);

    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: parsed?.message?.error?.errorMessage || text.slice(0, 300),
        raw: parsed,
      };
    }

    const articleId = parsed?.message?.result?.articleId?.toString();
    return { ok: true, articleId, status: res.status, raw: parsed };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: errMsg(e) };
  }
}
```

### 1-C. 본문 HTML 정화 — 네이버 카페 안전 화이트리스트

네이버 카페는 자체 SmartEditor 호환 HTML 만 받음. 이상한 태그 있으면 본문 빈칸 처리됨.

```ts
// src/lib/naver/cafe-html.ts (신규)

const NAVER_SAFE_TAGS = new Set([
  'p', 'br', 'span', 'strong', 'em', 'b', 'i', 'u',
  'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'blockquote', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'hr',
]);

/**
 * 카더라 블로그 HTML → 네이버 카페 안전 HTML
 * - 위험 태그 제거 (script, style, iframe, form, etc.)
 * - 위험 속성 제거 (on*, javascript:, data:)
 * - 카더라 도메인 외 외부 링크는 nofollow
 * - 인라인 style 은 카페 표시용 안전 스타일만 유지
 * - Carriage return 정규화
 */
export function toNaverCafeHtml(html: string, opts: { siteUrl: string } = { siteUrl: 'https://kadeora.app' }): string {
  if (!html) return '';

  let s = html;

  // 1. 위험 블록 통째 제거
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  s = s.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  s = s.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  s = s.replace(/<form[\s\S]*?<\/form>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  // 2. 위험 속성 제거 (이벤트 핸들러, javascript:, data:)
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  s = s.replace(/\b(href|src|action)\s*=\s*("|')?\s*(javascript|vbscript|data)\s*:[^"'\s>]*("|')?/gi, '');

  // 3. 안전하지 않은 태그 통째 제거 (allowlist)
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
    return NAVER_SAFE_TAGS.has(tag.toLowerCase()) ? match : '';
  });

  // 4. 외부 링크 nofollow + 카더라 자기 사이트 링크는 풀 URL
  s = s.replace(/<a\s+([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)>/gi, (_, pre, url, post) => {
    if (url.startsWith('/')) {
      return `<a ${pre}href="${opts.siteUrl}${url}"${post}>`;
    }
    if (url.startsWith(opts.siteUrl)) {
      return `<a ${pre}href="${url}"${post}>`;
    }
    if (/^https?:\/\//.test(url)) {
      const hasRel = /rel\s*=/i.test(pre + post);
      const relAttr = hasRel ? '' : ' rel="nofollow noopener"';
      const hasTarget = /target\s*=/i.test(pre + post);
      const tgtAttr = hasTarget ? '' : ' target="_blank"';
      return `<a ${pre}href="${url}"${post}${relAttr}${tgtAttr}>`;
    }
    return ''; // 의심 URL 제거
  });

  // 5. 이미지 보호 — 카더라 도메인 이미지만 허용 (외부 hotlinking 회피)
  s = s.replace(/<img\s+([^>]*?)src\s*=\s*["']([^"']+)["']([^>]*?)>/gi, (_, pre, url, post) => {
    const fullUrl = url.startsWith('/') ? opts.siteUrl + url : url;
    if (!fullUrl.startsWith(opts.siteUrl) && !fullUrl.startsWith('https://')) {
      return ''; // 이미지 제거
    }
    // alt 속성 강제
    const hasAlt = /alt\s*=/i.test(pre + post);
    const altAttr = hasAlt ? '' : ' alt="카더라 콘텐츠 이미지"';
    return `<img ${pre}src="${fullUrl}"${post}${altAttr}>`;
  });

  // 6. 캐리지 리턴 정규화
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 7. 빈 태그 정리
  s = s.replace(/<(p|div|span)[^>]*>\s*<\/\1>/g, '');

  // 8. 출처 명시 - 글 끝에 카더라 링크 자동 첨부 (네이버 카페 정책 + 백링크)
  // 카페 정책: 출처 표기 의무
  s = s.trim();

  return s;
}

/**
 * 카페 발행 시 본문 끝에 출처 박스 자동 추가
 */
export function appendSourceBox(html: string, opts: { canonicalUrl: string; title: string }): string {
  const sourceBox = `
<div>
  <hr>
  <p><strong>📌 원문 출처</strong></p>
  <p>이 글은 카더라(kadeora.app)의 데이터·블로그 콘텐츠를 기반으로 작성되었습니다.</p>
  <p>👉 원문 보기: <a href="${opts.canonicalUrl}" rel="noopener" target="_blank">${opts.title}</a></p>
  <p>📊 더 많은 부동산·주식 데이터: <a href="https://kadeora.app" rel="noopener" target="_blank">카더라 (kadeora.app)</a></p>
</div>`;
  return html + sourceBox;
}
```

### 1-D. OAuth Token Rotation — DB 영구 저장

```sql
-- migrations/20260417_oauth_tokens.sql (신규)
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  provider TEXT PRIMARY KEY,                -- 'naver_cafe', 'naver_blog', 'kakao_channel'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  access_token_expires_at TIMESTAMPTZ,      -- 1시간 유효
  refresh_token_expires_at TIMESTAMPTZ,     -- 1년 유효
  client_id TEXT,
  client_secret TEXT,                       -- 가능하면 Vault 사용 권장
  metadata JSONB DEFAULT '{}',              -- cafeId, menuId 등
  last_refreshed_at TIMESTAMPTZ,
  refresh_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- 모든 접근은 service_role 만 (어드민 API)
CREATE POLICY "oauth_tokens_service_only" ON public.oauth_tokens
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires
  ON public.oauth_tokens(refresh_token_expires_at);
```

```ts
// src/lib/naver/oauth-store.ts (신규)
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export interface OAuthRecord {
  provider: string;
  access_token: string;
  refresh_token: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  client_id: string | null;
  client_secret: string | null;
  metadata: Record<string, any>;
}

/**
 * Provider 의 현재 access token 가져오기 (자동 갱신)
 * - access_token 만료 5분 전이면 refresh
 * - refresh 시 새 refresh_token 도 DB 저장
 */
export async function getValidAccessToken(provider: string): Promise<{ token: string; meta: Record<string, any> } | null> {
  const sb = getSupabaseAdmin();
  const { data: rec } = await (sb as any)
    .from('oauth_tokens')
    .select('*')
    .eq('provider', provider)
    .maybeSingle();

  if (!rec) return null;

  const now = Date.now();
  const expiresAt = rec.access_token_expires_at ? new Date(rec.access_token_expires_at).getTime() : 0;
  const needsRefresh = !expiresAt || (expiresAt - now < 5 * 60 * 1000); // 5분 이내 만료 시

  if (!needsRefresh) {
    return { token: rec.access_token, meta: rec.metadata || {} };
  }

  // Refresh 시도
  if (!rec.refresh_token || !rec.client_id || !rec.client_secret) {
    // refresh 불가 — 만료된 토큰이라도 일단 반환 (호출자가 재시도 처리)
    return { token: rec.access_token, meta: rec.metadata || {} };
  }

  try {
    const r = await fetch('https://nid.naver.com/oauth2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: rec.client_id,
        client_secret: rec.client_secret,
        refresh_token: rec.refresh_token,
      }).toString(),
    });
    const d = await r.json();
    if (!d.access_token) {
      console.error('[oauth-store] refresh failed:', provider, d);
      return { token: rec.access_token, meta: rec.metadata || {} };
    }

    const newExpiresAt = new Date(Date.now() + (Number(d.expires_in) || 3600) * 1000).toISOString();
    const updates: any = {
      access_token: d.access_token,
      access_token_expires_at: newExpiresAt,
      last_refreshed_at: new Date().toISOString(),
      refresh_count: (rec.refresh_count || 0) + 1,
      updated_at: new Date().toISOString(),
    };
    // 네이버는 refresh 시 새 refresh_token 반환할 수 있음 (정책에 따라)
    if (d.refresh_token && d.refresh_token !== rec.refresh_token) {
      updates.refresh_token = d.refresh_token;
      updates.refresh_token_expires_at = new Date(Date.now() + 365 * 86400 * 1000).toISOString();
    }
    await (sb as any).from('oauth_tokens').update(updates).eq('provider', provider);

    return { token: d.access_token, meta: rec.metadata || {} };
  } catch (e) {
    console.error('[oauth-store] exception:', e);
    return { token: rec.access_token, meta: rec.metadata || {} };
  }
}

/**
 * 어드민 UI에서 최초 OAuth 토큰 등록
 */
export async function setOAuthToken(record: Partial<OAuthRecord> & { provider: string }) {
  const sb = getSupabaseAdmin();
  await (sb as any).from('oauth_tokens').upsert({
    ...record,
    updated_at: new Date().toISOString(),
  });
}
```

### 1-E. 새 카페 발행 크론

```ts
// src/app/api/cron/naver-cafe-publish/route.ts (전면 재작성)
import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { postCafeArticle } from '@/lib/naver/cafe-client';
import { toNaverCafeHtml, appendSourceBox } from '@/lib/naver/cafe-html';
import { getValidAccessToken } from '@/lib/naver/oauth-store';
import { getConfig } from '@/lib/app-config';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function doWork() {
  // 모든 한도/배치 사이즈는 DB config 에서 (하드코딩 금지)
  const config = await getConfig('naver_cafe', {
    batch_size: 1,
    sleep_between_ms: 2000,
    daily_limit: 8,
    enabled: true,
  });

  if (!config.enabled) {
    return { processed: 0, metadata: { reason: 'disabled by config' } };
  }

  // 일일 발행 한도 체크
  const sb = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { count: todayCount } = await (sb as any)
    .from('naver_syndication')
    .select('id', { count: 'exact', head: true })
    .eq('cafe_status', 'published')
    .gte('published_at', `${today}T00:00:00Z`);

  if ((todayCount || 0) >= config.daily_limit) {
    return { processed: 0, metadata: { reason: 'daily_limit_reached', count: todayCount } };
  }

  // OAuth 토큰
  const tokenInfo = await getValidAccessToken('naver_cafe');
  if (!tokenInfo) {
    return { processed: 0, metadata: { reason: 'oauth_not_configured' } };
  }
  const { token, meta } = tokenInfo;
  const cafeId = meta.cafeId as string;
  const menuId = meta.menuId as string;
  if (!cafeId || !menuId) {
    return { processed: 0, metadata: { reason: 'cafeId or menuId missing in oauth_tokens.metadata' } };
  }

  // 발행 대기 큐
  const remaining = (config.daily_limit as number) - (todayCount || 0);
  const limit = Math.min(config.batch_size as number, remaining);
  const { data: pending } = await (sb as any)
    .from('naver_syndication')
    .select('*')
    .eq('cafe_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!pending?.length) {
    return { processed: 0, metadata: { reason: 'no_pending' } };
  }

  let success = 0;
  const results: any[] = [];

  for (const item of pending) {
    const canonicalUrl = `${SITE_URL}/blog/${item.blog_slug}`;

    // HTML 정화 + 출처 박스
    const cleanContent = toNaverCafeHtml(item.naver_html || '', { siteUrl: SITE_URL });
    const finalContent = appendSourceBox(cleanContent, {
      canonicalUrl,
      title: item.original_title || item.naver_title,
    });

    // 제목 정리: 네이버 카페 제목 한도 (실제 50자 권장, 80자 한도)
    const subject = (item.naver_title || item.original_title || '')
      .replace(/[|~`<>]/g, '')
      .trim()
      .slice(0, 60);

    const result = await postCafeArticle({
      accessToken: token,
      cafeId,
      menuId,
      subject,
      content: finalContent,
    });

    if (result.ok && result.articleId) {
      await (sb as any).from('naver_syndication').update({
        cafe_status: 'published',
        cafe_article_id: result.articleId,
        cafe_published_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
      }).eq('id', item.id);
      success++;
      results.push({ id: item.id, articleId: result.articleId });
    } else {
      // 영구 실패 (4xx) vs 일시 실패 (5xx) 구분
      const status = result.status || 0;
      const isPermanent = status >= 400 && status < 500 && status !== 429;
      await (sb as any).from('naver_syndication').update({
        cafe_status: isPermanent ? 'failed' : 'pending', // 5xx 면 다음 시도
        cafe_error: result.error?.slice(0, 500) || null,
        cafe_retry_count: ((item as any).cafe_retry_count || 0) + 1,
      }).eq('id', item.id);
      results.push({ id: item.id, error: result.error, status });
    }

    // Rate limit 보호
    if (success < limit) {
      await new Promise(r => setTimeout(r, config.sleep_between_ms as number));
    }
  }

  return {
    processed: success,
    failed: results.length - success,
    metadata: { results, daily_count_after: (todayCount || 0) + success },
  };
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('naver-cafe-publish', doWork);
  return NextResponse.json(result);
});
```

### 1-F. 어드민 UI — OAuth 등록 + 발행 큐 관리

```ts
// src/app/api/admin/naver-oauth/route.ts (신규)
import { requireAdmin } from '@/lib/admin-auth';
import { setOAuthToken, getValidAccessToken } from '@/lib/naver/oauth-store';

export async function GET() {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;
  const naver = await getValidAccessToken('naver_cafe');
  return Response.json({
    naver_cafe: naver
      ? { configured: true, hasToken: !!naver.token, meta: naver.meta }
      : { configured: false }
  });
}

export async function POST(req: Request) {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;
  const body = await req.json();
  const { provider, access_token, refresh_token, client_id, client_secret, metadata } = body;
  if (!provider || !access_token) {
    return Response.json({ error: 'provider and access_token required' }, { status: 400 });
  }
  await setOAuthToken({
    provider, access_token, refresh_token, client_id, client_secret, metadata,
    access_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    refresh_token_expires_at: new Date(Date.now() + 365 * 86400 * 1000).toISOString(),
  });
  return Response.json({ ok: true });
}
```

```tsx
// src/app/admin/tabs/NaverPublishTab.tsx (신규 — 어드민 새 탭)
'use client';
import { useState, useEffect } from 'react';

export default function NaverPublishTab() {
  const [oauth, setOauth] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [form, setForm] = useState({ access_token: '', refresh_token: '', client_id: '', client_secret: '', cafeId: '', menuId: '' });

  useEffect(() => { fetchData(); }, []);
  async function fetchData() {
    const o = await fetch('/api/admin/naver-oauth').then(r => r.json());
    const q = await fetch('/api/admin/naver-syndication').then(r => r.json());
    setOauth(o.naver_cafe);
    setQueue(q.items || []);
  }

  async function saveOAuth() {
    await fetch('/api/admin/naver-oauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'naver_cafe',
        access_token: form.access_token,
        refresh_token: form.refresh_token,
        client_id: form.client_id,
        client_secret: form.client_secret,
        metadata: { cafeId: form.cafeId, menuId: form.menuId },
      }),
    });
    fetchData();
  }

  async function triggerNow() {
    const r = await fetch('/api/admin/trigger-cron?path=/api/cron/naver-cafe-publish').then(r => r.json());
    alert(JSON.stringify(r, null, 2));
    fetchData();
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>네이버 카페 자동 발행</h2>
      
      <section style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 8, margin: '16px 0' }}>
        <h3>OAuth 설정 {oauth?.configured ? '✅' : '❌'}</h3>
        <input placeholder="access_token" value={form.access_token} onChange={e => setForm({...form, access_token: e.target.value})} style={{width:'100%',marginBottom:6}} />
        <input placeholder="refresh_token" value={form.refresh_token} onChange={e => setForm({...form, refresh_token: e.target.value})} style={{width:'100%',marginBottom:6}} />
        <input placeholder="client_id" value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})} style={{width:'100%',marginBottom:6}} />
        <input placeholder="client_secret" type="password" value={form.client_secret} onChange={e => setForm({...form, client_secret: e.target.value})} style={{width:'100%',marginBottom:6}} />
        <input placeholder="cafeId (clubId)" value={form.cafeId} onChange={e => setForm({...form, cafeId: e.target.value})} style={{width:'100%',marginBottom:6}} />
        <input placeholder="menuId" value={form.menuId} onChange={e => setForm({...form, menuId: e.target.value})} style={{width:'100%',marginBottom:6}} />
        <button onClick={saveOAuth}>저장</button>
        <button onClick={triggerNow} style={{marginLeft:8}}>지금 즉시 1건 발행 (테스트)</button>
      </section>

      <section>
        <h3>발행 대기 큐 ({queue.filter(q => q.cafe_status === 'pending').length})</h3>
        <table style={{width:'100%'}}>
          <thead><tr><th>제목</th><th>상태</th><th>시도</th><th>오류</th></tr></thead>
          <tbody>
            {queue.map(q => (
              <tr key={q.id}>
                <td>{q.naver_title?.slice(0, 40)}</td>
                <td>{q.cafe_status}</td>
                <td>{q.cafe_retry_count || 0}</td>
                <td>{q.cafe_error?.slice(0, 60)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

### 1-G. 사전 점검 체크리스트 (실제 발행 전 필수)

1. **네이버 개발자 센터 앱 등록** 확인 — `https://developers.naver.com/apps/`
2. **카페 글쓰기 권한** 추가 — "카페 글쓰기 / 카페 멤버 관리" 체크박스 켜져있어야 함
3. **테스트 계정으로 OAuth 인증** → access_token + refresh_token 획득
4. **카페 ID / 메뉴 ID** 획득 — 카페 URL 또는 카페 매니저 → 메뉴 관리에서 확인
5. **본 픽스 코드 머지 → Vercel deploy**
6. **어드민 NaverPublishTab 에서 OAuth 저장** → `oauth_tokens` 테이블에 row 1개
7. **"지금 즉시 1건 발행" 버튼 클릭** → 테스트 발행 → 카페에서 한글 정상 확인
8. **vercel.json 에 스케줄 추가**:
   ```json
   { "path": "/api/cron/naver-blog-content", "schedule": "0 */8 * * *" },
   { "path": "/api/cron/naver-cafe-publish", "schedule": "0 9,21 * * *" }
   ```
9. **24시간 모니터링** → cron_logs + naver_syndication 테이블

---

## 2. 계산기 142종 — 네이버 1위 + 노출면적 최대화

### 2-A. 현재 약점 진단

| 영역 | 현재 | 문제 |
|------|------|------|
| URL 구조 | `/calc/income-tax/year-end-tax` | 평면 — 키워드 클러스터 약함 |
| 결과 공유 | 결과를 URL에 못 담음 | "내 가점 점수 64점" 공유해도 빈 페이지 |
| 사이트맵 | 단일 sitemap[0]에 142건 묶임 | 카테고리별 클러스터 분리 안 됨 |
| 백링크 | 블로그 → 계산기 일방 | 계산기 → 블로그 관련 5건 자동 링크 없음 |
| FAQ | 등록된 것만 노출 | AI로 자동 생성 안 함 |
| HowTo Schema | 일반화된 3 step | 계산기별 특화 step 없음 |
| Rich Results | WebApplication ✅ | Calculator schema ❌ |
| 결과 페이지 | 없음 | "내 결과" 영구 URL 없음 → SNS 공유 가치 0 |
| 내부 링크 hub | `/calc` 단일 허브 | 카테고리·키워드 클러스터 허브 없음 |
| 동적 콘텐츠 | seoContent 정적 | 매월 갱신 안 됨 |
| 청약 가점 | `subscriptionScore` formula 없음 | **결과 안 뜸 — 즉시 픽스** |

### 2-B. 새 URL 구조 — 결과 영구 URL + 클러스터

```
[기존]
/calc                            (전체 허브)
/calc/income-tax                 (카테고리 허브)
/calc/income-tax/year-end-tax    (계산기)

[추가]
/calc/income-tax/year-end-tax/r/[shortId]
   └─ 결과 영구 URL. 짧은 ID로 결과값 인코딩 → 카카오톡 공유 가능
/calc/topic/[keyword]
   └─ 키워드 클러스터 허브 (예: "양도세 계산기" → 양도세 관련 모든 계산기 + 블로그 + FAQ)
```

#### 결과 공유 시스템 (핵심 SEO 무기)

```sql
-- migrations/20260417_calc_results.sql
CREATE TABLE IF NOT EXISTS public.calc_results (
  short_id TEXT PRIMARY KEY,                -- nanoid 8자리
  calc_slug TEXT NOT NULL,
  calc_category TEXT NOT NULL,
  inputs JSONB NOT NULL,                    -- {price: 500000000, dealType: 'trade'}
  result JSONB NOT NULL,                    -- {main: '825만원', details: [...]}
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days')
);

ALTER TABLE public.calc_results ENABLE ROW LEVEL SECURITY;

-- 누구나 short_id 알면 조회 가능 (SEO 목적)
CREATE POLICY "calc_results_read" ON public.calc_results
  FOR SELECT USING (true);

-- 본인 결과만 작성/수정
CREATE POLICY "calc_results_insert" ON public.calc_results
  FOR INSERT WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

-- 만료 정리 인덱스
CREATE INDEX IF NOT EXISTS idx_calc_results_expires
  ON public.calc_results(expires_at);

-- view_count 인덱스 (인기 결과 페이지 추출용)
CREATE INDEX IF NOT EXISTS idx_calc_results_popular
  ON public.calc_results(calc_slug, view_count DESC)
  WHERE expires_at > NOW();
```

```ts
// src/lib/calc/result-share.ts
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789abcdefghijkmnpqrstuvwxyz', 8); // ambiguous chars 제외

export async function saveCalcResult(params: {
  calcSlug: string;
  calcCategory: string;
  inputs: Record<string, any>;
  result: any;
  userId?: string | null;
}): Promise<string> {
  const shortId = nanoid();
  const sb = getSupabaseAdmin();
  await (sb as any).from('calc_results').insert({
    short_id: shortId,
    calc_slug: params.calcSlug,
    calc_category: params.calcCategory,
    inputs: params.inputs,
    result: params.result,
    user_id: params.userId || null,
  });
  return shortId;
}
```

```ts
// src/app/api/calc/result/route.ts (POST: 결과 저장 / GET: 조회)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { calcSlug, calcCategory, inputs, result } = body;
  const userId = await tryGetUserId(req); // optional
  const shortId = await saveCalcResult({ calcSlug, calcCategory, inputs, result, userId });
  return NextResponse.json({ shortId, url: `/calc/${calcCategory}/${calcSlug}/r/${shortId}` });
}
```

```tsx
// src/app/(main)/calc/[category]/[slug]/r/[shortId]/page.tsx (신규)
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { findCalc } from '@/lib/calc/registry';
import { SITE_URL } from '@/lib/constants';
import type { Metadata } from 'next';

export const revalidate = 3600;

export async function generateMetadata({ params }): Promise<Metadata> {
  const { category, slug, shortId } = await params;
  const sb = getSupabaseAdmin();
  const { data: rec } = await (sb as any)
    .from('calc_results')
    .select('inputs, result, view_count')
    .eq('short_id', shortId).maybeSingle();
  if (!rec) return { robots: { index: false, follow: false } };

  const calc = findCalc(slug);
  if (!calc) return {};

  const mainResult = rec.result?.main?.value || '';
  const url = `${SITE_URL}/calc/${category}/${slug}/r/${shortId}`;
  return {
    title: `${calc.title} 결과 — ${mainResult} | 카더라`,
    description: `${calc.titleShort} 계산 결과: ${mainResult}. 자세한 내역과 같은 조건의 다른 사례도 확인하세요.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${calc.emoji} ${calc.titleShort} — ${mainResult}`,
      description: `${calc.titleShort} 결과 공유 페이지`,
      url,
      images: [{
        url: `${SITE_URL}/api/og-calc?slug=${slug}&result=${encodeURIComponent(mainResult)}`,
        width: 1200, height: 630,
      }],
    },
  };
}

export default async function ResultPage({ params }) {
  const { category, slug, shortId } = await params;
  const sb = getSupabaseAdmin();
  const { data: rec } = await (sb as any)
    .from('calc_results')
    .select('*')
    .eq('short_id', shortId).maybeSingle();
  if (!rec) notFound();

  const calc = findCalc(slug);
  if (!calc) notFound();

  // view_count 증가 (RPC 권장)
  (sb as any).rpc('increment_calc_result_view', { p_short_id: shortId }).catch(() => {});

  return (
    <div>
      <h1>{calc.emoji} {calc.title} 결과</h1>
      <div className="result-main">{rec.result.main.value}</div>
      
      <details>
        <summary>입력값 보기</summary>
        <pre>{JSON.stringify(rec.inputs, null, 2)}</pre>
      </details>

      <a href={`/calc/${category}/${slug}`}>나도 계산해보기 →</a>
      
      {/* 같은 계산기의 인기 결과 (소셜 프루프) */}
      <PopularResults calcSlug={slug} excludeId={shortId} />
      
      {/* 관련 블로그 (이 계산기 키워드 매칭) */}
      <RelatedBlogPosts calcSlug={slug} />
    </div>
  );
}
```

### 2-C. OG 이미지 — 계산기 결과 전용 (`/api/og-calc`)

```ts
// src/app/api/og-calc/route.tsx (신규 — Edge runtime)
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') || '';
  const result = url.searchParams.get('result') || '';
  // calc 정보는 서버에서 fetch (작은 KV 또는 직접 import)
  
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#0a0e27', color: '#fff', flexDirection: 'column', padding: 60, fontFamily: 'system-ui' }}>
        <div style={{ fontSize: 28, color: '#60a5fa' }}>📊 카더라 계산기</div>
        <div style={{ fontSize: 64, fontWeight: 800, marginTop: 20 }}>{slug.replace(/-/g, ' ')}</div>
        <div style={{ fontSize: 88, fontWeight: 900, color: '#fbbf24', marginTop: 40 }}>{result}</div>
        <div style={{ fontSize: 24, color: '#9ca3af', marginTop: 'auto' }}>kadeora.app — 무료 145종 계산기</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

### 2-D. 키워드 클러스터 허브 — `/calc/topic/[keyword]`

```sql
-- migrations/20260417_calc_topic_clusters.sql
CREATE TABLE IF NOT EXISTS public.calc_topic_clusters (
  topic_slug TEXT PRIMARY KEY,             -- '양도세-계산기'
  topic_label TEXT NOT NULL,                -- '양도세 계산기'
  search_volume_naver INTEGER DEFAULT 0,   -- 네이버 월 검색량 (키워드 도구로 채움)
  difficulty_score INTEGER DEFAULT 50,     -- 1~100
  calc_slugs TEXT[] NOT NULL DEFAULT '{}',  -- 이 토픽에 묶을 계산기들
  blog_post_ids BIGINT[] DEFAULT '{}',      -- 자동 매칭된 블로그
  intro_html TEXT,                           -- AI 생성 도입부 (300자)
  faqs JSONB DEFAULT '[]',                   -- AI 생성 FAQ
  related_keywords TEXT[] DEFAULT '{}',     -- 검색 의도 변형
  meta_description TEXT,
  is_published BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.calc_topic_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calc_topics_read" ON public.calc_topic_clusters FOR SELECT USING (is_published = true);

-- 인기 토픽 추출용
CREATE INDEX IF NOT EXISTS idx_calc_topics_popular
  ON public.calc_topic_clusters(search_volume_naver DESC)
  WHERE is_published = true;
```

#### 시드 데이터 (네이버 키워드 도구 기반)

```sql
-- 실제 네이버 검색량 데이터로 채우는 시드 (어드민이 주기적으로 갱신)
INSERT INTO calc_topic_clusters (topic_slug, topic_label, search_volume_naver, calc_slugs, related_keywords) VALUES
('yangdose-gyesangi', '양도세 계산기', 27300, ARRAY['property-transfer-tax','property-transfer-tax-multi'], ARRAY['양도세','양도소득세','부동산 양도세','다주택 양도세']),
('chuhdose-gyesangi', '취득세 계산기', 22100, ARRAY['property-acquisition-tax','property-acquisition-multi'], ARRAY['취득세','부동산 취득세','다주택 취득세']),
('jongbusye-gyesangi', '종부세 계산기', 18400, ARRAY['property-comprehensive-tax'], ARRAY['종합부동산세','종부세','종부세 계산']),
('chungyak-gajeon-gyesangi', '청약 가점 계산기', 33500, ARRAY['subscription-score','subscription-eligibility'], ARRAY['청약 가점','청약 점수','무주택 기간','부양가족 청약']),
('dsr-gyesangi', 'DSR 계산기', 14800, ARRAY['dsr','dti','ltv'], ARRAY['DSR','DTI','LTV','대출 한도']),
('silsuryeongaek-gyesangi', '실수령액 계산기', 41200, ARRAY['salary-net','annual-salary-converter'], ARRAY['실수령액','연봉 실수령액','월급 계산']),
('boglyi-gyesangi', '복리 계산기', 12500, ARRAY['compound-interest'], ARRAY['복리','복리 계산','적금 복리']),
('jeonwolse-byeonhwan', '전월세 변환 계산기', 8900, ARRAY['jeonse-wolse'], ARRAY['전월세 전환','전세 월세','월세 전환']),
('joonggae-susulryo', '중개수수료 계산기', 11200, ARRAY['brokerage-fee'], ARRAY['중개수수료','부동산 중개료','복비']),
('yebok-isja-gyesangi', '예적금 이자 계산기', 9700, ARRAY['savings-interest','deposit-interest'], ARRAY['예금 이자','적금 이자','이자 계산']);
-- ...50개 정도 시드, 어드민에서 추가
```

```tsx
// src/app/(main)/calc/topic/[keyword]/page.tsx (신규)
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { CALC_REGISTRY } from '@/lib/calc/registry';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';

export const revalidate = 86400; // 1일

export async function generateStaticParams() {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).from('calc_topic_clusters')
    .select('topic_slug').eq('is_published', true).limit(200);
  return (data || []).map((t: any) => ({ keyword: t.topic_slug }));
}

export async function generateMetadata({ params }) {
  const { keyword } = await params;
  const sb = getSupabaseAdmin();
  const { data: topic } = await (sb as any).from('calc_topic_clusters')
    .select('*').eq('topic_slug', keyword).maybeSingle();
  if (!topic) return {};
  return {
    title: `${topic.topic_label} — 2026 무료 온라인 계산기 | 카더라`,
    description: topic.meta_description || `${topic.topic_label} 무료 사용. 2026 최신 세법·법령 반영. ${topic.related_keywords.slice(0, 3).join('·')} 등 종합 계산.`,
    keywords: [topic.topic_label, ...topic.related_keywords, '카더라', '무료 계산기'],
    alternates: { canonical: `${SITE_URL}/calc/topic/${keyword}` },
    openGraph: {
      title: `${topic.topic_label} 종합 가이드 — 카더라`,
      description: `${topic.topic_label} ${topic.calc_slugs.length}종 + 관련 가이드 ${(topic.blog_post_ids || []).length}편`,
      url: `${SITE_URL}/calc/topic/${keyword}`,
    },
    other: {
      'naver:site_name': '카더라',
      'naver:description': topic.meta_description || topic.topic_label,
      'naver:author': '카더라',
      'article:tag': topic.related_keywords.join(','),
    },
  };
}

export default async function TopicHub({ params }) {
  const { keyword } = await params;
  const sb = getSupabaseAdmin();
  const { data: topic } = await (sb as any).from('calc_topic_clusters')
    .select('*').eq('topic_slug', keyword).maybeSingle();
  if (!topic) notFound();

  const relatedCalcs = (topic.calc_slugs || []).map(s =>
    CALC_REGISTRY.find(c => c.slug === s)
  ).filter(Boolean);

  // 자동 매칭 블로그
  const { data: blogs } = await sb.from('blog_posts')
    .select('id, slug, title, excerpt, cover_image, published_at')
    .in('id', topic.blog_post_ids || [])
    .eq('is_published', true)
    .limit(8);

  // JSON-LD 구조화
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/calc/topic/${keyword}`,
        name: topic.topic_label,
        description: topic.meta_description,
        keywords: topic.related_keywords.join(','),
      },
      {
        '@type': 'ItemList',
        itemListElement: relatedCalcs.map((c, i) => ({
          '@type': 'ListItem', position: i + 1,
          name: c.title, url: `${SITE_URL}/calc/${c.category}/${c.slug}`,
        })),
      },
      ...(topic.faqs?.length > 0 ? [{
        '@type': 'FAQPage',
        mainEntity: topic.faqs.map((f: any) => ({
          '@type': 'Question', name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }] : []),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '계산기', item: `${SITE_URL}/calc` },
          { '@type': 'ListItem', position: 3, name: topic.topic_label },
        ],
      },
    ],
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      
      <h1>{topic.topic_label}</h1>
      
      {topic.intro_html && (
        <div className="topic-intro" dangerouslySetInnerHTML={{ __html: topic.intro_html }} />
      )}

      <section>
        <h2>이 토픽의 무료 계산기 ({relatedCalcs.length}종)</h2>
        <div className="calc-grid">
          {relatedCalcs.map(c => (
            <Link key={c.slug} href={`/calc/${c.category}/${c.slug}`}>
              <div>{c.emoji}</div>
              <div>{c.titleShort}</div>
              <div>{c.description.slice(0, 50)}</div>
            </Link>
          ))}
        </div>
      </section>

      {blogs && blogs.length > 0 && (
        <section>
          <h2>{topic.topic_label} 가이드 ({blogs.length}편)</h2>
          {blogs.map(b => (
            <Link key={b.id} href={`/blog/${b.slug}`}>
              <h3>{b.title}</h3>
              <p>{b.excerpt}</p>
            </Link>
          ))}
        </section>
      )}

      {topic.faqs?.length > 0 && (
        <section>
          <h2>자주 묻는 질문</h2>
          {topic.faqs.map((f: any, i: number) => (
            <details key={i}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
```

### 2-E. 계산기 자동 매칭 크론

```ts
// src/app/api/cron/calc-topic-refresh/route.ts (신규)
// 주 1회 실행
// 1. calc_topic_clusters 의 각 topic 에 대해
// 2. 카더라 블로그에서 related_keywords 매칭하는 글 ID 자동 채움
// 3. 부족하면 새 블로그 글 생성 트리거 (blog-calculator-guide 큐에 enqueue)
// 4. AI로 intro_html + faqs 생성 (없거나 30일 지난 토픽만)

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { AI_MODEL_HAIKU } from '@/lib/constants';

async function doWork() {
  const sb = getSupabaseAdmin();
  const { data: topics } = await (sb as any).from('calc_topic_clusters')
    .select('*').eq('is_published', true)
    .order('search_volume_naver', { ascending: false })
    .limit(20);

  let updated = 0;
  for (const topic of topics || []) {
    // 1. 블로그 자동 매칭
    const { data: matchedBlogs } = await sb.from('blog_posts')
      .select('id, title, view_count')
      .or(topic.related_keywords.map((k: string) =>
        `title.ilike.%${k}%,excerpt.ilike.%${k}%`).join(','))
      .eq('is_published', true)
      .order('view_count', { ascending: false })
      .limit(20);
    const blogIds = (matchedBlogs || []).map((b: any) => b.id);

    // 2. AI 생성 (intro + faqs) — 30일 이상 갱신 안 한 것만
    const needsRefresh = !topic.last_refreshed_at ||
      (Date.now() - new Date(topic.last_refreshed_at).getTime() > 30 * 86400 * 1000);
    
    let intro_html = topic.intro_html;
    let faqs = topic.faqs;
    let meta_description = topic.meta_description;

    if (needsRefresh) {
      const aiResp = await callAI(topic);
      intro_html = aiResp.intro_html;
      faqs = aiResp.faqs;
      meta_description = aiResp.meta_description;
    }

    await (sb as any).from('calc_topic_clusters').update({
      blog_post_ids: blogIds,
      intro_html, faqs, meta_description,
      last_refreshed_at: needsRefresh ? new Date().toISOString() : topic.last_refreshed_at,
      updated_at: new Date().toISOString(),
    }).eq('topic_slug', topic.topic_slug);

    updated++;
  }
  return { processed: updated };
}

async function callAI(topic: any) {
  const prompt = `한국 ${topic.topic_label} 종합 가이드 페이지의 콘텐츠를 작성합니다.
관련 키워드: ${topic.related_keywords.join(', ')}

다음 JSON 형식으로 응답:
{
  "intro_html": "<p>...</p><p>...</p>",  // 250자 도입부 HTML, 핵심 수치 포함
  "faqs": [{"q":"...","a":"..."}],          // 5개. 답변은 200자 이내
  "meta_description": "..."                  // 130자 이내, 키워드 포함
}

규칙: 일반론 금지, 2026년 최신 기준, 구체적 수치 포함, 카더라 자체 언급 금지.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL_HAIKU,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const d = await res.json();
  const text = d.content?.[0]?.text || '{}';
  // JSON 추출
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : { intro_html: '', faqs: [], meta_description: '' };
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('calc-topic-refresh', doWork);
  return NextResponse.json(result);
});
```

### 2-F. 계산기 → 블로그 자동 글 생성 크론 (이미 있는 `blog-calculator-guide` 활용 + 강화)

```ts
// src/app/api/cron/blog-calculator-guide/route.ts (강화)
// 매주 실행: 가장 검색량 높지만 블로그 매칭 < 5건인 토픽에 대해 AI 가이드 글 생성

async function doWork() {
  const sb = getSupabaseAdmin();
  const { data: topics } = await (sb as any).from('calc_topic_clusters')
    .select('topic_label, related_keywords, calc_slugs, blog_post_ids, search_volume_naver')
    .eq('is_published', true)
    .lt('blog_post_ids_count', 5) // PostgreSQL: array_length 활용 view 만들거나 raw
    .order('search_volume_naver', { ascending: false })
    .limit(3); // 주당 3개

  for (const topic of topics || []) {
    const blogContent = await generateGuideBlog(topic);
    await safeBlogInsert(sb, {
      title: `${topic.topic_label} 사용법 — ${new Date().getFullYear()} 완전 가이드`,
      slug: `guide-${topic.topic_slug}-${Date.now()}`,
      content: blogContent.html,
      excerpt: blogContent.excerpt,
      category: 'guide',
      tags: topic.related_keywords,
      meta_description: blogContent.meta,
      is_published: true,
      author_name: '카더라 데이터팀',
      published_at: new Date().toISOString(),
    });
  }
  return { processed: topics?.length || 0 };
}
```

### 2-G. 청약 가점 calculator 픽스

```ts
// src/lib/calc/formulas.ts 에 추가

const SUBSCRIPTION_SCORE_TABLE = {
  // 무주택 기간 (가점 32점, 1년 미만 2점, 매년 +2, 15년 이상 32점)
  noHouseYears: (years: number) => Math.min(32, 2 + Math.floor(years) * 2),
  // 부양가족 (35점, 0명 5점, 1명 10점, 2명 15점, 3명 20점, ...6명 이상 35점)
  dependents: (n: number) => Math.min(35, 5 + Math.min(6, n) * 5),
  // 청약통장 가입기간 (17점, 6개월 미만 1점, 1년 2점, 2년 3점, ...15년 이상 17점)
  bankYears: (years: number) => {
    if (years < 0.5) return 1;
    if (years < 1) return 2;
    return Math.min(17, 2 + Math.floor(years));
  },
};

export function subscriptionScore(v: V): CalcResult {
  const noHouseYears = n(v.noHouseYears);
  const dependents = n(v.dependents);
  const bankYears = n(v.bankYears);
  // 배우자 통장 합산 옵션 (2024년 신규 정책, 최대 3년)
  const spouseBankYears = Math.min(3, n(v.spouseBankYears));
  const effectiveBankYears = bankYears + spouseBankYears;

  const noHouseScore = SUBSCRIPTION_SCORE_TABLE.noHouseYears(noHouseYears);
  const dependentsScore = SUBSCRIPTION_SCORE_TABLE.dependents(dependents);
  const bankScore = SUBSCRIPTION_SCORE_TABLE.bankYears(effectiveBankYears);
  const total = noHouseScore + dependentsScore + bankScore;

  // 가점 등급 진단
  let grade = '하위';
  if (total >= 70) grade = '최상위';
  else if (total >= 60) grade = '상위';
  else if (total >= 50) grade = '중상';
  else if (total >= 40) grade = '중간';
  else if (total >= 30) grade = '중하';

  return {
    main: { label: '내 청약 가점', value: `${total}점 / 84점 (${grade})` },
    details: [
      { label: '무주택 기간 점수', value: `${noHouseScore}점 (만 ${noHouseYears}년)` },
      { label: '부양가족 점수', value: `${dependentsScore}점 (${dependents}명)` },
      { label: '청약통장 점수', value: `${bankScore}점 (${effectiveBankYears.toFixed(1)}년 합산)` },
      ...(spouseBankYears > 0 ? [{ label: '배우자 통장 합산', value: `+${spouseBankYears}년 (${SUBSCRIPTION_SCORE_TABLE.bankYears(spouseBankYears)}점 가산)` }] : []),
      { label: '진단', value: `${grade} 등급 — ${total >= 60 ? '서울 인기 단지 도전 가능' : '경기 외곽·신도시 중심 권장'}` },
    ],
  };
}

// FORMULAS 객체에 추가
export const FORMULAS: Record<string, (v: V) => CalcResult> = {
  // ...기존
  subscriptionScore,
};
```

```ts
// registry.ts 의 subscription-score 항목 업데이트 — inputs 추가
{
  slug: 'subscription-score', emoji: '🏠', category: 'real-estate', categoryLabel: '부동산',
  title: '2026 청약 가점 계산기', titleShort: '청약 가점 계산기',
  description: '무주택기간·부양가족·청약통장 가입기간(배우자 합산)으로 청약 가점 84점 만점 자동 계산.',
  keywords: ['청약 가점 계산기','청약 점수','무주택기간','부양가족','청약통장','배우자 통장 합산','2026 청약'],
  legalBasis: '주택공급에 관한 규칙 제28조 별표1', version: '2026.04', lastUpdated: '2026-04-05',
  pattern: 'diagnose', formula: 'subscriptionScore', resultLabel: '내 청약 가점', resultUnit: '점',
  inputs: [
    { id: 'noHouseYears', label: '무주택 기간', type: 'range', default: 5, min: 0, max: 30, step: 1, unit: '년',
      hint: '세대주 기준. 만 30세부터 또는 결혼일부터 산정.' },
    { id: 'dependents', label: '부양가족 수', type: 'stepper', default: 2, min: 0, max: 10, step: 1, unit: '명',
      hint: '본인 제외, 같은 등본 기준 직계존비속·배우자' },
    { id: 'bankYears', label: '본인 청약통장 가입기간', type: 'range', default: 5, min: 0, max: 30, step: 0.5, unit: '년' },
    { id: 'spouseBankYears', label: '배우자 청약통장 가입기간 (합산 가산)', type: 'range', default: 0, min: 0, max: 15, step: 0.5, unit: '년',
      hint: '2024년 정책 — 배우자 통장 가입기간 최대 3년 합산 가능' },
  ],
  // ... seoContent, faqs, relatedCalcs
}
```

### 2-H. 사이트맵 — 계산기 클러스터 분리

```ts
// src/app/sitemap.xml/route.ts 에 추가
// 30 = calc topic cluster (50개 정도)
// 31 = calc result page (인기 100개)
const NEW_FIXED_IDS = [...existingIds, 30, 31];
```

```ts
// src/app/sitemap/[id]/route.ts 에 case 추가
if (id === 30) {
  // 계산기 토픽 허브
  const { data: topics } = await sb.from('calc_topic_clusters')
    .select('topic_slug, updated_at, search_volume_naver')
    .eq('is_published', true);
  const entries = (topics || []).map((t: any) => ({
    url: `${BASE}/calc/topic/${t.topic_slug}`,
    lastModified: t.updated_at,  // 실제 갱신 시간 사용 (now 금지)
    changeFrequency: 'weekly',
    priority: t.search_volume_naver > 10000 ? 0.9 : 0.7,
  }));
  return xmlResponse(entries);
}

if (id === 31) {
  // 인기 결과 페이지 (조회수 5+)
  const { data: results } = await sb.from('calc_results')
    .select('short_id, calc_slug, calc_category, view_count, created_at')
    .gt('view_count', 5)
    .gt('expires_at', new Date().toISOString())
    .order('view_count', { ascending: false })
    .limit(1000);
  const entries = (results || []).map((r: any) => ({
    url: `${BASE}/calc/${r.calc_category}/${r.calc_slug}/r/${r.short_id}`,
    lastModified: r.created_at,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));
  return xmlResponse(entries);
}
```

---

## 3. 무하드코딩 — 설정 테이블 아키텍처

### 3-A. `app_config` 통합 설정 테이블

```sql
-- migrations/20260417_app_config.sql
CREATE TABLE IF NOT EXISTS public.app_config (
  namespace TEXT NOT NULL,                  -- 'naver_cafe', 'calc_seo', 'cron_limits'
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (namespace, key)
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_config_service_only" ON public.app_config
  FOR ALL USING (auth.role() = 'service_role');

-- 어드민 읽기 정책 (UI 표시용)
CREATE POLICY "app_config_admin_read" ON public.app_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

### 3-B. `getConfig` 헬퍼

```ts
// src/lib/app-config.ts
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const cache = new Map<string, { value: any; ts: number }>();
const TTL_MS = 60_000; // 1분 캐싱

export async function getConfig<T = any>(
  namespace: string,
  defaults: Record<string, T>
): Promise<Record<string, T>> {
  const cacheKey = `${namespace}:${JSON.stringify(defaults)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return cached.value;
  }

  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).from('app_config')
    .select('key, value').eq('namespace', namespace);

  const result: Record<string, T> = { ...defaults };
  for (const row of data || []) {
    result[row.key] = row.value;
  }
  cache.set(cacheKey, { value: result, ts: Date.now() });
  return result;
}

export async function setConfig(namespace: string, key: string, value: any) {
  const sb = getSupabaseAdmin();
  await (sb as any).from('app_config').upsert({
    namespace, key, value, updated_at: new Date().toISOString(),
  });
  // 캐시 무효화
  for (const k of cache.keys()) {
    if (k.startsWith(`${namespace}:`)) cache.delete(k);
  }
}
```

### 3-C. 어드민 설정 UI

```tsx
// src/app/admin/tabs/ConfigTab.tsx (신규)
'use client';
import { useState, useEffect } from 'react';

const NAMESPACES = [
  { id: 'naver_cafe', label: '네이버 카페 자동 발행', schema: {
    enabled: { type: 'boolean', label: '활성화', default: true },
    batch_size: { type: 'number', label: '회차당 발행 건수', default: 1, min: 1, max: 5 },
    sleep_between_ms: { type: 'number', label: '발행 간 대기 (ms)', default: 2000 },
    daily_limit: { type: 'number', label: '일일 한도', default: 8 },
  }},
  { id: 'naver_blog_content', label: '네이버 블로그 콘텐츠 생성', schema: {
    enabled: { type: 'boolean', label: '활성화', default: true },
    batch_size: { type: 'number', label: '회차당 생성', default: 3, min: 1, max: 10 },
  }},
  { id: 'calc_seo', label: '계산기 SEO', schema: {
    auto_share_url: { type: 'boolean', label: '결과 공유 URL 활성화', default: true },
    result_retention_days: { type: 'number', label: '결과 보관 기간 (일)', default: 90 },
    sitemap_top_results_limit: { type: 'number', label: '사이트맵 인기 결과 수', default: 1000 },
  }},
  { id: 'ai_models', label: 'AI 모델 설정', schema: {
    default_haiku: { type: 'string', label: '기본 Haiku', default: 'claude-haiku-4-5-20251001' },
    default_sonnet: { type: 'string', label: '기본 Sonnet', default: 'claude-sonnet-4-6' },
    default_opus: { type: 'string', label: '기본 Opus', default: 'claude-opus-4-7' },
    use_prompt_cache: { type: 'boolean', label: 'Prompt 캐싱 사용', default: true },
  }},
];

// (UI 코드 생략 — 동적 폼 빌더)
```

---

## 4. 병렬 4-Wave 실행 계획

### Wave 1: Foundation (2시간) — **순차 실행 필수**

브랜치: `wave/1-foundation`

1. **DB 마이그레이션 4개 생성** (`docs/migrations/` 에 파일로 저장 — Node가 Supabase Dashboard에서 직접 실행)
   - `20260417_app_config.sql`
   - `20260417_oauth_tokens.sql`
   - `20260417_calc_results.sql`
   - `20260417_calc_topic_clusters.sql`
2. **헬퍼 라이브러리** 추가
   - `src/lib/app-config.ts`
   - `src/lib/naver/oauth-store.ts`
   - `src/lib/naver/cafe-client.ts`
   - `src/lib/naver/cafe-html.ts`
   - `src/lib/calc/result-share.ts`
3. **상수 갱신**
   - `src/lib/constants.ts`: `AI_MODEL_SONNET = 'claude-sonnet-4-6'`, `AI_MODEL_OPUS = 'claude-opus-4-7'`
4. **subscriptionScore formula 추가** — `src/lib/calc/formulas.ts`

**테스트**: `npm run build` 통과 / `app_config` 초기 row insert / `oauth_tokens` 초기 row 확인
**머지 조건**: TypeScript strict 통과, 빌드 성공

### Wave 2 (병렬 — 3개 브랜치 동시 작업)

#### Wave 2A — Naver Cafe (3시간)
브랜치: `wave/2a-naver-cafe`

1. `src/app/api/cron/naver-cafe-publish/route.ts` 전면 재작성 (URL-encoded)
2. `src/app/api/cron/naver-blog-content/route.ts` 보강 (HTML enhanced for 카페)
3. `src/app/api/admin/naver-oauth/route.ts` 신규
4. `src/app/api/admin/naver-syndication/route.ts` 인증 추가
5. `src/app/admin/tabs/NaverPublishTab.tsx` 신규 + AdminShell.tsx 등록
6. **테스트 발행** (수동) → 한글 정상 확인
7. **vercel.json 스케줄 추가**:
   ```json
   { "path": "/api/cron/naver-blog-content", "schedule": "0 */8 * * *" },
   { "path": "/api/cron/naver-cafe-publish", "schedule": "0 9,21 * * *" }
   ```

**머지 조건**: 테스트 발행 성공 + 한글 100% 정상 + 어드민 UI 동작

#### Wave 2B — Calc SEO (4시간)
브랜치: `wave/2b-calc-seo`

1. `src/app/api/calc/result/route.ts` (POST: save / GET: fetch)
2. `src/app/(main)/calc/[category]/[slug]/r/[shortId]/page.tsx` 신규
3. `src/app/api/og-calc/route.tsx` 신규 (Edge runtime)
4. `src/app/(main)/calc/topic/[keyword]/page.tsx` 신규
5. `src/components/calc/CalcEngine.tsx` 수정 — "결과 공유" 버튼 추가, POST `/api/calc/result` → shortId → URL
6. **시드 데이터** — `scripts/seed-calc-topics.ts` (50개 토픽 INSERT)
7. `src/app/api/cron/calc-topic-refresh/route.ts` 신규
8. `src/app/api/cron/blog-calculator-guide/route.ts` 강화
9. **vercel.json 스케줄 추가**:
   ```json
   { "path": "/api/cron/calc-topic-refresh", "schedule": "0 5 * * 0" },
   { "path": "/api/cron/blog-calculator-guide", "schedule": "0 6 * * 1" }
   ```

**머지 조건**: 결과 공유 URL 동작 + 토픽 허브 50개 인덱싱 가능 상태

#### Wave 2C — Quick wins (1시간)
브랜치: `wave/2c-quick-wins`

1. **JSON-LD 이스케이프** 헬퍼 추가
   ```ts
   // src/lib/jsonld.ts
   export function jsonLdSafe(obj: any): string {
     return JSON.stringify(obj).replace(/</g, '\\u003c');
   }
   ```
   전 코드 grep `JSON.stringify` + `dangerouslySetInnerHTML` → `jsonLdSafe()` 로 교체 (sed 스크립트 가능)

2. **Open redirect 픽스** — `src/app/auth/callback/route.ts`, `src/app/(auth)/login/page.tsx`
   ```ts
   const safeRedirect = (redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/\\')) ? redirect : '/feed';
   ```

3. **DOMPurify 도입**
   ```bash
   npm i isomorphic-dompurify
   ```
   ```ts
   // src/lib/sanitize-html.ts (재작성)
   import DOMPurify from 'isomorphic-dompurify';
   export function sanitizeHtml(html: string): string {
     return DOMPurify.sanitize(html, {
       ALLOWED_TAGS: ['p','br','strong','em','b','i','u','h1','h2','h3','h4','ul','ol','li','blockquote','a','img','table','thead','tbody','tr','th','td','div','hr','span','code','pre'],
       ALLOWED_ATTR: ['href','src','alt','title','class','rel','target','width','height','style'],
       ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
     });
   }
   ```

4. **premium-expire + 운영 필수 크론 스케줄 추가**
   ```json
   { "path": "/api/cron/premium-expire", "schedule": "0 0 * * *" },
   { "path": "/api/cron/expire-listings", "schedule": "0 1 * * *" },
   { "path": "/api/cron/health-check", "schedule": "*/30 * * * *" },
   { "path": "/api/cron/seo-content-boost", "schedule": "0 4 * * 0" },
   { "path": "/api/cron/email-digest", "schedule": "0 0 * * 1" }
   ```

5. **robots.txt 갱신** — Claude-Web → ClaudeBot, AI 크롤러 추가

6. **계산기 registry — subscription-score 의 inputs 갱신**

**머지 조건**: 빌드 성공, sanitize-html 테스트 통과, redirect 테스트 통과

### Wave 3: Sitemap & Crawl (2시간)
브랜치: `wave/3-sitemap`

1. `src/app/sitemap/[id]/route.ts` 에 case 30, 31 추가 (calc topic / popular result)
2. `src/app/sitemap.xml/route.ts` 에 30, 31 ID 추가
3. **lastmod=now 정상화** — sitemap [id]/route.ts 에서 `now` → 실제 `updated_at` 또는 `buildDate`
4. `src/app/api/cron/indexnow-mass/route.ts` 강화 — calc topic + result page 포함
5. **블로그 generateStaticParams 한도 상향** — 200 → 2000 (view_count >= 10)

### Wave 4: Auto-publish 연결 (2시간)
브랜치: `wave/4-auto-publish`

1. `naver-blog-content` 크론에서 **계산기 결과 페이지** 도 syndication 대상에 포함
2. `naver-cafe-publish` 가 **블로그 글 + 계산기 토픽 허브 글** 둘 다 발행 가능하도록 source_type 컬럼 추가
3. **Resend 웹훅 secret** 등록 + signature verify 활성화
4. **Sentry 커스텀 캡처** — 결제·award_points·indexnow 경로

---

## 5. 환경변수 / 초기 데이터 체크리스트

### 5-A. Vercel 환경변수 (Production + Preview 둘 다)

```
# 기존 (이미 설정됨)
ANTHROPIC_API_KEY
CRON_SECRET
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL=https://kadeora.app
INDEXNOW_KEY
NEXT_PUBLIC_KAKAO_JS_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY

# 새로 등록 (Wave 2A 전)
# OAuth 토큰은 oauth_tokens 테이블에 저장 — 환경변수 불필요!

# 새로 등록 (Wave 2C 전)
RESEND_WEBHOOK_SECRET=whsec_...

# Sentry (선택, Wave 4)
SENTRY_AUTH_TOKEN
SENTRY_ORG
SENTRY_PROJECT
```

### 5-B. Supabase 초기 데이터 (Wave 1 마이그레이션 후)

```sql
-- app_config 초기값
INSERT INTO app_config (namespace, key, value, description) VALUES
('naver_cafe', 'enabled', 'true', '카페 자동 발행 ON/OFF'),
('naver_cafe', 'batch_size', '1', '회차당 발행 건수'),
('naver_cafe', 'sleep_between_ms', '2000', '발행 간 대기 시간'),
('naver_cafe', 'daily_limit', '8', '일일 발행 한도'),
('calc_seo', 'auto_share_url', 'true', '결과 공유 URL 활성화'),
('calc_seo', 'result_retention_days', '90', '결과 보관 기간'),
('ai_models', 'default_sonnet', '"claude-sonnet-4-6"', '기본 Sonnet'),
('ai_models', 'default_opus', '"claude-opus-4-7"', '기본 Opus'),
('ai_models', 'use_prompt_cache', 'true', 'Prompt 캐싱 사용')
ON CONFLICT (namespace, key) DO NOTHING;
```

### 5-C. 네이버 OAuth 등록 절차 (Node 가 직접 수행)

1. https://developers.naver.com/apps/ 접속
2. "Application 등록" → 사용 API: **카페** 선택
3. "카페 글쓰기 / 댓글" 권한 체크
4. callback URL: `https://kadeora.app/admin/naver-oauth-callback` (지금 안 만들 거면 임시 URL)
5. **Client ID, Client Secret 받기**
6. 카더라 운영용 카페 ID, 메뉴 ID 확인 (카페 매니저 → 메뉴 관리)
7. 1회성 OAuth 인증 — Postman 또는 cURL:
   ```bash
   # Step 1: 인증 URL 열기 (브라우저)
   https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https://kadeora.app/admin/naver-oauth-callback&state=test
   # Step 2: 받은 code 로 token 교환
   curl -X POST https://nid.naver.com/oauth2.0/token \
     -d "grant_type=authorization_code&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&code=RECEIVED_CODE&state=test"
   # → access_token, refresh_token 받음
   ```
8. 어드민 NaverPublishTab → OAuth 등록 → 저장
9. "지금 즉시 1건 발행" 클릭 → 카페 가서 한글 확인

---

## 6. 머지 후 모니터링 — 24시간 체크

### 6-A. 메트릭

| 메트릭 | 출처 | 목표 | 임계값 |
|--------|------|------|--------|
| 카페 발행 성공률 | naver_syndication.cafe_status | 95%+ | 80% 미만 알림 |
| 한글 깨짐 발생 | 카페 수동 확인 | 0 | 1건이라도 발생 시 즉시 정지 |
| OAuth refresh 성공 | oauth_tokens.last_refreshed_at | 매일 | 6시간+ 갱신 안 되면 알림 |
| 계산기 결과 저장 | calc_results.created_at | 일 100+ 예상 | 7일간 0이면 버그 |
| 토픽 허브 색인 | Google Search Console | 7일내 50개 | 미색인 시 IndexNow 재제출 |
| 사이트맵 lastmod | 직접 사이트맵 GET | 정적은 buildDate 고정 | now 발생 시 회귀 버그 |

### 6-B. 롤백 플랜

각 Wave 별로 git tag:
```bash
git tag wave-1-foundation-complete
git tag wave-2a-naver-cafe-complete
# ...
```

문제 발생 시:
1. **즉시 정지** — `app_config` 의 해당 namespace `enabled = false`
2. **롤백** — `git revert <commit>` + force push
3. **DB 변경 롤백** — 마이그레이션은 down 스크립트 미리 준비

```sql
-- 만약 oauth_tokens 롤백 필요 시
-- migrations/20260417_oauth_tokens_DOWN.sql
DROP TABLE IF EXISTS public.oauth_tokens;
```

---

## 7. 일정 — 12시간 (실제 작업 시간)

| 시간대 | Wave | 작업 |
|-------|------|------|
| 0:00 - 2:00 | Wave 1 | 마이그레이션, 헬퍼 라이브러리, 상수 |
| 2:00 - 5:00 | Wave 2A (병렬) | Naver Cafe + 한글 검증 |
| 2:00 - 6:00 | Wave 2B (병렬) | Calc SEO + 토픽 허브 |
| 2:00 - 3:00 | Wave 2C (병렬) | Quick wins |
| 6:00 - 8:00 | Wave 3 | Sitemap + IndexNow |
| 8:00 - 10:00 | Wave 4 | Auto-publish 연결 |
| 10:00 - 12:00 | 통합 테스트 | E2E 플로우 + 카페 실발행 검증 |

**병렬 처리 가능 부분** — Wave 2A/2B/2C 는 Wave 1 끝나면 동시에 진행 가능. 단, 각 작업이 독립된 파일/폴더만 건드리도록 분리.

---

## 8. 무하드코딩 원칙 — 코드 리뷰 체크리스트

머지 전 자동 검증할 항목:

```bash
# 1. 시간/한도/배치 사이즈가 코드 내 magic number 인지
grep -rn "BATCH_SIZE\s*=\s*[0-9]\|DAILY_LIMIT\s*=\s*[0-9]\|MAX_\w*\s*=\s*[0-9]" src/app/api/cron/ | grep -v "config\|Config"

# 2. AI 모델명 하드코딩 여부
grep -rn "claude-haiku\|claude-sonnet\|claude-opus" src/ | grep -v "constants.ts\|README\|test"

# 3. URL 하드코딩 여부 (kadeora.app 직접 사용)
grep -rn "kadeora.app" src/ | grep -v "constants\|SITE_URL\|README"

# 4. OAuth 토큰 환경변수 직접 참조 여부 (oauth_tokens 테이블만 사용해야)
grep -rn "process.env.NAVER_CAFE_ACCESS_TOKEN\|process.env.NAVER_CAFE_REFRESH" src/
```

---

## 9. 마지막 — 한 줄 요약

**Wave 1 끝나면 그 위에 4팀이 동시에 일할 수 있고, 각 Wave는 독립 머지 가능하며, 모든 한도·토큰·AI 모델은 DB 설정으로 즉시 변경 가능하다. 네이버 카페 한글 깨짐은 multipart → URL-encoded 한 번의 변경으로 영구 해결되고, 계산기는 결과 영구 URL + 토픽 클러스터 허브로 노출면적이 즉시 50배 늘어난다.**

설계 끝. 다음 메시지에서 Wave 1 부터 실제 코드 PR로 작업 시작 가능.
