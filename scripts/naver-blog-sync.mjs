#!/usr/bin/env node
/**
 * 세션 146 E2 — 카더라 최신 포스트를 네이버 블로그에 요약+역링크로 포스팅.
 *
 * 실행: node scripts/naver-blog-sync.mjs [--limit=3]
 *
 * 선결:
 * - 네이버 블로그 OAuth 2.0 토큰 (Open API 앱 등록 필요):
 *   https://developers.naver.com/docs/serviceapi/blog/blog-write.md
 * - .env.local 에 NAVER_BLOG_OAUTH_TOKEN (access token) 필수
 * - 블로그 ID: NAVER_BLOG_ID
 *
 * 미설정 시 guided error 출력 후 종료.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NAVER_TOKEN = process.env.NAVER_BLOG_OAUTH_TOKEN;
const NAVER_BLOG_ID = process.env.NAVER_BLOG_ID || 'kadeora';

if (!SERVICE_ROLE) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY 누락'); process.exit(1); }
if (!NAVER_TOKEN) {
  console.error(`
❌ NAVER_BLOG_OAUTH_TOKEN 누락. 설정 가이드:

1. https://developers.naver.com/apps 에서 앱 생성 — 권한 "블로그 글쓰기" 체크
2. OAuth 2.0 인증 플로우로 access_token 발급
   (refresh_token 은 별도 저장 후 만료 시 재발급 로직 작성)
3. .env.local 에:
     NAVER_BLOG_OAUTH_TOKEN=ya29.xxx
     NAVER_BLOG_ID=kadeora
4. 다시 실행.

자동화 CI 에서는 Vercel env 에 등록 후 workflow dispatch 로 호출 가능.
`);
  process.exit(1);
}

const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '3', 10);
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function summarize(post) {
  const lines = (post.excerpt || post.content || '').split('\n').filter(l => l.trim()).slice(0, 6);
  const summary = lines.map(l => '- ' + l.trim().slice(0, 120)).join('\n');
  return `${post.title}

${summary}

━━━━━━━━
자세히 보기: https://kadeora.app/blog/${encodeURIComponent(post.slug)}

본 글은 카더라 (https://kadeora.app) 원글의 네이버 블로그 요약본입니다.`;
}

async function postToNaver(title, body) {
  const form = new URLSearchParams({
    title,
    contents: body,
    blogId: NAVER_BLOG_ID,
  }).toString();
  const res = await fetch('https://openapi.naver.com/blog/writePost.xml', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NAVER_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  return { status: res.status, text: (await res.text()).slice(0, 500) };
}

async function main() {
  const { data: posts } = await sb
    .from('blog_posts')
    .select('id, slug, title, excerpt, content, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(LIMIT);
  if (!posts || posts.length === 0) { console.log('대상 없음'); return; }

  for (const p of posts) {
    const body = await summarize(p);
    const r = await postToNaver(p.title, body);
    console.log(`${p.slug} → Naver status=${r.status}`);
    if (r.status >= 300) console.log('  ', r.text);
    await new Promise(s => setTimeout(s, 1500));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
