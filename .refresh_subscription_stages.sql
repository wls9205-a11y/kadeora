CREATE OR REPLACE FUNCTION public.refresh_subscription_stages(p_today date DEFAULT CURRENT_DATE)
 RETURNS TABLE(site_id uuid, from_stage text, to_stage text)
 LANGUAGE sql
AS $function$
  with latest as (
    select distinct on (s.id)
           s.id, s.lifecycle_stage as cur,
           a.rcept_bgnde, a.rcept_endde, a.przwner_presnatn_de,
           a.cntrct_cncls_bgnde, a.cntrct_cncls_endde,
           case
             when s.move_in_date ~ '^\d{4}-\d{2}-\d{2}$' then s.move_in_date::date
             when s.move_in_date ~ '^\d{4}-\d{2}$'       then (s.move_in_date || '-01')::date
             when a.mvn_prearnge_ym ~ '^\d{6}$'
               then (substr(a.mvn_prearnge_ym,1,4) || '-' || substr(a.mvn_prearnge_ym,5,2) || '-01')::date
             else null
           end as move_in
      from apt_sites s
      join apt_subscriptions a on btrim(a.house_nm) = s.name
     where s.site_type = 'subscription'
       and (s.stage_source is null or s.stage_source = 'derived_subscription')
     order by s.id, a.rcept_bgnde desc nulls last
  ),
  calc as (
    select id, cur,
           derive_subscription_stage(rcept_bgnde, rcept_endde, przwner_presnatn_de,
                                     cntrct_cncls_bgnde, cntrct_cncls_endde, move_in, p_today) as nxt
      from latest
  ),
  upd as (
    update apt_sites s
       set lifecycle_stage  = c.nxt,
           previous_stage   = c.cur,
           stage_source     = 'derived_subscription',
           stage_updated_at = now()
      from calc c
     where c.id = s.id and c.nxt is not null and c.nxt is distinct from c.cur
     returning s.id, c.cur, c.nxt
  )
  select id, cur, nxt from upd
$function$
