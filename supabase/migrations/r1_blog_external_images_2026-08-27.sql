-- R1 — 블로그 본문의 «남의 이미지» 를 걷어낸다 (2026-08-27)
--
-- ── 실측 ────────────────────────────────────────────────────────────────────
-- 발행 글 4,339편에 외부 이미지 «22,653장». 상위 도메인:
--   imgnews.naver.net 8,325 · t1.daumcdn.net 2,827 · blog.kakaocdn.net 1,699
--   www.neonet.co.kr 1,021 · landthumb-phinf.pstatic.net 770 · scs-phinf 592 …
-- 언론사·개인 블로그 사진을 «핫링크» 하고 있었다.
--
-- ⚠️⚠️ 지시서의 「시행사 official_url 도메인 이미지만 유지」는 «0장을 남긴다».
--      official_url 을 가진 현장이 «1곳» 뿐이고 그 도메인에서 온 본문 이미지는 0장이다.
--      즉 이 정책의 실제 결과는 「외부 이미지 전량 제거」다. 규모가 다르므로 명시한다.
--
-- ⛔ 텍스트는 «한 글자도» 바꾸지 않는다. 이미지 마크다운 토큰만 건드린다.
-- ⚠️ 되돌릴 수 있게 blog_body_backup_r1 에 원본을 통째로 떠 뒀다(4,339편 · 28.5MB).
-- ⚠️ pg_cron 125 replace_blog_body_og 를 «껐다». 그 크론은 본문의 /api/og? 를
--    «실사로» 되돌리는 방향이라 이 작업과 정면으로 충돌한다.
--
-- ⚠️ 첫 구현은 replace(content, token, '') 였는데 «틀렸다». 한 글에 같은 이미지가
--    6번 반복되는 경우가 흔해, 첫 토큰을 OG 카드로 바꾸는 순간 나머지 5개도 «한꺼번에»
--    카드가 됐다(미리보기에서 잡았다). regexp_replace 단일 패스로 다시 썼다 —
--    「첫 매치만」(g 없음)과 「전부」(g)를 나눠 쓰면 반복 토큰도 정확히 처리된다.

create or replace function public.strip_external_body_images(
  p_blog_id bigint,
  p_og_url  text default null
)
returns jsonb
language plpgsql as $fn$
declare
  v_content  text;
  v_new      text;
  v_pattern  text;
  v_excl     text;
  v_before   int;
  v_after    int;
  v_inserted int := 0;
begin
  select content into v_content from blog_posts where id = p_blog_id;
  if v_content is null then return jsonb_build_object('error','not_found'); end if;

  -- 남길 도메인: 우리 것 + 시행사 공식 URL 도메인(실사 정책).
  -- ⚠️ 실측상 official 도메인은 1개고 본문에 0장이지만, 규칙은 코드에 남긴다 —
  --    나중에 official_url 이 채워지면 «고치지 않아도» 그 이미지는 살아남는다.
  select 'kadeora|supabase' || coalesce(string_agg('|' || replace(d, '.', '\.'), ''), '')
    into v_excl
    from (
      select distinct substring(official_url from '^https?://([^/]+)') as d
        from apt_sites where official_url like 'http%'
    ) t;

  -- 이미지 토큰 중 «호스트에 위 도메인이 없는» 것만 고른다(부정 전방탐색).
  v_pattern := '!\[[^\]]*\]\(https?://(?![^)/[:space:]]*(?:' || v_excl || '))[^)]*\)';

  select count(*) into v_before from regexp_matches(v_content, v_pattern, 'g');
  if v_before = 0 then
    return jsonb_build_object('removed',0,'inserted',0,'skip','no_external');
  end if;

  v_new := v_content;

  -- ① «이미지 토큰 찌꺼기» 를 «먼저» 정리한다. 내 편집 «이전부터» 1,240편에 있던 것이다 —
  --    예전 치환이 `/api/og?title=…&category=apt&design=6)` 의 앞부분만 사진 URL 로
  --    바꾸고 쿼리스트링 꼬리를 본문에 남겼다. 눈에 보이는 쓰레기 문자열이다.
  --    ⛔ 이건 «텍스트가 아니라 URL 조각» 이다. 그래서 R1 범위 안이다.
  --       사람이 쓴 문장을 이 패턴으로 지울 가능성은 없다(&category= + &design=숫자 + 닫는 괄호).
  --    ⚠️⚠️ 순서가 중요하다. OG 카드를 «먼저» 넣으면 그 URL 끝(&category=apt&design=2)이
  --         이 패턴에 걸려 «내가 방금 넣은 주소가 잘린다». 미리보기에서 실제로 잘렸다.
  --         정리 → 삽입 → 제거 순이어야 한다.
  --    ⚠️⚠️ 패턴에 «앞의 닫는 괄호» 를 반드시 넣는다. `&category=…&design=N\)` 만으로는
  --         «정상 kadeora OG 주소의 꼬리» 도 걸린다 — 실제로 그렇게 돌려서 133편의
  --         멀쩡한 OG 이미지 주소를 잘랐다(백업에서 전량 복구했다).
  --         찌꺼기는 «이미 닫힌 토큰 뒤» 에만 붙는다: `](…jpg)&category=apt&design=6)`
  v_new := regexp_replace(v_new, '\)&category=[a-z_]+&design=[0-9]+\)', ')', 'g');

  -- ② 첫 매치 «하나만» OG 카드로. g 플래그 없음 = 첫 것만 바뀐다.
  --    ⚠️ 모든 이미지를 카드로 치환하지 않는다 — 같은 카드가 스무 번 반복된다.
  if p_og_url is not null then
    v_new := regexp_replace(v_new, v_pattern, '![](' || p_og_url || ')');
    v_inserted := 1;
  end if;

  -- ③ 나머지 전부 제거. ①이 넣은 카드는 kadeora 도메인이라 이 패턴에 안 걸린다.
  v_new := regexp_replace(v_new, v_pattern, '', 'g');

  -- 이미지가 빠지며 생긴 «빈 줄 3개 이상» 만 정리한다. 텍스트는 그대로다.
  v_new := regexp_replace(v_new, E'\n{3,}', E'\n\n', 'g');

  select count(*) into v_after from regexp_matches(v_new, v_pattern, 'g');

  update blog_posts set content = v_new where id = p_blog_id;

  return jsonb_build_object(
    'removed', v_before - v_after, 'inserted', v_inserted, 'left', v_after,
    'len_before', length(v_content), 'len_after', length(v_new),
    'len_diff', length(v_new) - length(v_content)
  );
end
$fn$;
