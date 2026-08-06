#!/usr/bin/env node
/**
 * s273 — blog_posts.metadata.apt_id 소급 기입 (backfill)
 *
 * 규약: metadata.apt_id (number) = apt_subscriptions.id
 *       /apt 하단 '관련 청약 분석' 이 이 키로 글을 찾는다.
 *
 * 매칭은 DB 함수 fn_blog_assign_apt_id(post_id) 에 위임한다.
 * 제목이 공고명을 통째로 포함하는 strict 매칭만 인정하고, 못 찾으면 NULL 로 남긴다.
 * (느슨한 매칭은 '힐스테이트 아이코닉' → 무관한 힐스테이트 140건 같은 오매핑을 만든다)
 *
 * 안전장치 (Architecture Rule #76 — blog_posts DELETE 금지):
 *   - metadata 키 추가(병합)만 한다. content/title/slug/is_published/published_at 불변.
 *   - 이미 apt_id 가 있는 글은 건너뛴다 (수동 교정 보호).
 *   - --dry 로 무엇이 바뀔지 먼저 확인할 수 있다.
 *
 * 사용:
 *   node scripts/backfill-blog-apt-id.mjs --dry            # 미리보기
 *   node scripts/backfill-blog-apt-id.mjs                  # 기본 범위(110742~110755) 실행
 *   node scripts/backfill-blog-apt-id.mjs --from 1 --to 999999
 *   node scripts/backfill-blog-apt-id.mjs --ids 110744,110751
 *
 * 필요 env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const DRY = flag('dry');
// 기본 범위 = 작업지시서가 지정한 '부울경 핫현장' 시리즈 14편
const FROM = Number(opt('from', 110742));
const TO = Number(opt('to', 110755));
const IDS = opt('ids', null)
  ? String(opt('ids', ''))
      .split(',')
      .map((s) => Number(s.trim()))
      .filter(Boolean)
  : null;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('[backfill] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  let q = sb.from('blog_posts').select('id, title, metadata, is_published').order('id');
  q = IDS ? q.in('id', IDS) : q.gte('id', FROM).lte('id', TO);

  const { data: posts, error } = await q;
  if (error) {
    console.error('[backfill] 조회 실패:', error.message);
    process.exit(1);
  }
  if (!posts?.length) {
    console.log('[backfill] 대상 글 없음');
    return;
  }

  console.log(`[backfill] 대상 ${posts.length}건${DRY ? ' (dry-run)' : ''}`);

  let assigned = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const p of posts) {
    const existing = p.metadata?.apt_id;
    if (existing !== undefined && existing !== null) {
      skipped++;
      console.log(`  = ${p.id} 이미 apt_id=${existing} — 건너뜀`);
      continue;
    }

    if (DRY) {
      // dry-run 은 쓰지 않는 매처만 호출
      const { data: matched, error: mErr } = await sb.rpc('fn_blog_match_apt_id', {
        p_title: p.title,
      });
      if (mErr) {
        console.error(`  ! ${p.id} 매칭 실패: ${mErr.message}`);
        continue;
      }
      if (matched) {
        assigned++;
        console.log(`  + ${p.id} → apt_id=${matched}  "${p.title.slice(0, 40)}"`);
      } else {
        unmatched++;
        console.log(`  - ${p.id} 매칭 없음      "${p.title.slice(0, 40)}"`);
      }
      continue;
    }

    const { data: aptId, error: aErr } = await sb.rpc('fn_blog_assign_apt_id', {
      p_post_id: p.id,
    });
    if (aErr) {
      console.error(`  ! ${p.id} 기입 실패: ${aErr.message}`);
      continue;
    }
    if (aptId) {
      assigned++;
      console.log(`  + ${p.id} → apt_id=${aptId}  "${p.title.slice(0, 40)}"`);
    } else {
      unmatched++;
      console.log(`  - ${p.id} 매칭 없음      "${p.title.slice(0, 40)}"`);
    }
  }

  console.log(
    `[backfill] 완료 — 기입 ${assigned} / 매칭없음 ${unmatched} / 기존보존 ${skipped}` +
      (DRY ? ' (dry-run, 실제 변경 없음)' : ''),
  );
}

main().catch((e) => {
  console.error('[backfill] 예외:', e?.message ?? e);
  process.exit(1);
});
