CREATE OR REPLACE FUNCTION public.derive_subscription_stage(p_rcept_bgnde date, p_rcept_endde date, p_presnatn_de date, p_cntrct_bgnde date, p_cntrct_endde date, p_move_in date, p_today date DEFAULT CURRENT_DATE)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    -- 접수 시작일조차 없으면 판정하지 않는다. 억지로 채우면 그게 곧 근거 없는 값이다.
    when p_rcept_bgnde is null then null

    -- 공고는 났고 접수 전
    when p_today < p_rcept_bgnde then 'pre_announcement'

    -- 접수 기간 (종료일이 없으면 시작일 하루로 본다)
    when p_today <= coalesce(p_rcept_endde, p_rcept_bgnde) then 'subscription_open'

    -- 접수는 끝났고 발표 전. ⚠️ 발표일이 «없으면» subscription_open 을 유지한다 —
    --    「발표를 기다린다」와 「발표일을 모른다」는 다르다.
    when p_presnatn_de is null then 'subscription_open'
    when p_today < p_presnatn_de then 'award_pending'

    -- 발표 후 30일까지는 발표 단계로 둔다(당첨자 확인·서류 기간)
    when p_today <= p_presnatn_de + 30 then 'award_announced'

    -- 계약 기간
    when p_cntrct_bgnde is not null and p_today >= p_cntrct_bgnde
     and p_today <= coalesce(p_cntrct_endde, p_cntrct_bgnde + 7) then 'contract_signing'

    -- 계약 후 ~ 입주 전
    when p_move_in is not null and p_today < p_move_in then 'construction'

    -- 입주 시작 후 180일까지
    when p_move_in is not null and p_today <= p_move_in + 180 then 'move_in_started'
    when p_move_in is not null then 'post_move_in'

    -- 입주일을 모르면 «계약 이후» 까지만 말하고 멈춘다. post_move_in 으로 밀면
    -- 지금 이 화면의 문제(근거 없는 「기축」)를 그대로 재생산한다.
    else 'construction'
  end
$function$
