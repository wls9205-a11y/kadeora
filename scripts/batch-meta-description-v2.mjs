#!/usr/bin/env node
/**
 * 세션 147 B1 — Meta desc 재제출 v2. 제출 후 metadata.meta_desc_batch_submitted=true 마킹.
 * 대상: 2,827편 (기존 403편 마킹 안 됐으면 중복 가능성 — 조건에 NOT (metadata ? 'meta_desc_batch_submitted') 필터)
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!SERVICE_ROLE || !ANTHROPIC_KEY) { console.error('env missing'); process.exit(1); }

const SUBMIT = process.argv.includes('--submit');
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const PROMPT = (title, excerpt, firstPara) => `제목: ${title}
TLDR: ${excerpt || ''}
첫 문단: ${firstPara || ''}

위 블로그의 meta description 을 80~160자 한국어로 1개 작성하세요.
- 지역명, 핵심 키워드, 연도, 숫자 포함
- 자연문, 키워드 나열 금지
- 응답 JSON: {"meta": "..."}`;

async function main() {
  // Supabase PostgREST 는 metadata ? 'key' 지원 미흡. 큰 배치 가져와서 필터.
  // PostgREST 기본 1,000 cap — pagination 으로 전수 수집
  const collected = [];
  for (let offset = 0; offset < 12000; offset += 1000) {
    const { data: page } = await sb
      .from('blog_posts')
      .select('id, title, excerpt, content, meta_description, metadata')
      .eq('is_published', true)
      .order('id', { ascending: true })
      .range(offset, offset + 999);
    if (!page || page.length === 0) break;
    collected.push(...page);
    if (page.length < 1000) break;
  }
  const targets = collected.filter(p =>
    (!p.meta_description || p.meta_description.length < 80) &&
    !(p.metadata && typeof p.metadata === 'object' && p.metadata.meta_desc_batch_submitted === true)
  );
  console.log(`대상: ${targets.length}`);
  if (targets.length === 0) return;

  const requests = targets.map(p => {
    const firstPara = (p.content || '').split('\n\n').find(l => l.trim().length > 50) || '';
    return {
      custom_id: `meta_${p.id}`,
      params: {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: PROMPT(p.title || '', p.excerpt || '', firstPara.slice(0, 400)) }],
      },
    };
  });

  if (!SUBMIT) { console.log('--submit 없음'); return; }

  console.log('Batch 제출 중...');
  const res = await fetch('https://api.anthropic.com/v1/messages/batches', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });
  const body = await res.json();
  if (!res.ok) { console.error(`❌ ${res.status}`, JSON.stringify(body).slice(0, 400)); process.exit(1); }
  console.log(`batch_id: ${body.id}`);

  await sb.from('blog_batch_jobs').insert({
    batch_id: body.id, job_type: 'meta_description', status: body.processing_status || 'submitted',
    target_count: targets.length,
  });

  // 마킹: 각 post metadata 에 batch_id 기록 (배치로 나눠서)
  console.log('마킹 중...');
  const ids = targets.map(p => p.id);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data: existing } = await sb.from('blog_posts').select('id, metadata').in('id', chunk);
    await Promise.all((existing || []).map(r => {
      const newMeta = { ...(r.metadata && typeof r.metadata === 'object' ? r.metadata : {}), meta_desc_batch_submitted: true, meta_desc_batch_id: body.id };
      return sb.from('blog_posts').update({ metadata: newMeta }).eq('id', r.id);
    }));
  }
  console.log(`마킹 완료: ${ids.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
