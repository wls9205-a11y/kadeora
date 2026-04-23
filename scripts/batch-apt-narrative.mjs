#!/usr/bin/env node
/**
 * 세션 146 C5 — 거래 50+ 단지 narrative_text 생성 Batch API 제출.
 * 실행: node scripts/batch-apt-narrative.mjs [--submit] [--limit=1000]
 *
 * [절대 팩트 고정] 블록 포함 — 세션 132-140 프롬프트 재사용.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tezftxakuwhsclarprlz.supabase.co';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!SERVICE_ROLE || !ANTHROPIC_KEY) { console.error('❌ env missing'); process.exit(1); }

const SUBMIT = process.argv.includes('--submit');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '500', 10);
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const PROMPT = (ctx) => `[절대 팩트 고정 — 이 숫자/이름만 쓰고 새로 만들지 마세요]
단지명: ${ctx.name}
지역: ${ctx.region} ${ctx.sigungu}
준공년도: ${ctx.built_year || 'N/A'}
총세대수: ${ctx.total_units || 'N/A'}
연간 실거래: ${ctx.sale_count_1y}건 (평균 ${ctx.avg_price_1y || 'N/A'}만원)
전세가율: ${ctx.jeonse_ratio ? (ctx.jeonse_ratio * 100).toFixed(0) + '%' : 'N/A'}
인접 단지 3곳: ${(ctx.neighbors || []).join(', ')}

위 팩트로 600~1,000자 한국어 서사를 작성하세요.
- 단지 위치·연식·세대수를 자연문으로 1문단
- 실거래 흐름과 가격 트렌드 1문단
- 인접 단지 비교 및 지역 특성 1문단
- 투자자 관점 요약 1문단 (50자 내외)
- 팩트 조작 금지, 숫자 추측 금지
- 응답은 JSON: {"narrative": "..."}`;

async function main() {
  const { data: profiles } = await sb
    .from('apt_complex_profiles')
    .select('id, apt_name, region_nm, sigungu, built_year, total_units, sale_count_1y, avg_price_1y, jeonse_ratio')
    .gte('sale_count_1y', 50)
    .is('narrative_text', null)
    .order('sale_count_1y', { ascending: false })
    .limit(LIMIT);

  if (!profiles || profiles.length === 0) {
    console.log('대상 없음');
    return;
  }

  console.log(`대상: ${profiles.length} 단지`);

  const requests = profiles.map(p => ({
    custom_id: `narrative_${p.id}`,
    params: {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: PROMPT({
        name: p.apt_name,
        region: p.region_nm,
        sigungu: p.sigungu,
        built_year: p.built_year,
        total_units: p.total_units,
        sale_count_1y: p.sale_count_1y,
        avg_price_1y: p.avg_price_1y,
        jeonse_ratio: p.jeonse_ratio,
        neighbors: [],
      }) }],
    },
  }));

  if (!SUBMIT) { console.log('--submit 없음'); return; }

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
  console.log(`batch_id: ${body.id}, status: ${body.processing_status}`);
  await sb.from('blog_batch_jobs').insert({
    batch_id: body.id,
    job_type: 'apt_narrative',
    status: body.processing_status || 'submitted',
    target_count: profiles.length,
  });
}

main().catch(e => { console.error(e); process.exit(1); });
