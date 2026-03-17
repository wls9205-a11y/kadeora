import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
const API_KEY = Deno.env.get('APT_DATA_API_KEY') ?? ''

Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10)

  const { data: apts } = await supabase
    .from('apt_subscriptions')
    .select('house_manage_no, house_nm, rcept_endde')
    .lt('rcept_endde', today)
    .is('competition_rate_1st', null)
    .not('house_manage_no', 'like', 'MANUAL_%')
    .limit(30)

  let updated = 0
  const errors: string[] = []
  const debugFields: string[] = []

  for (const apt of (apts ?? [])) {
    try {
      // 경쟁률 전용 API (15098905)
      const url = `https://api.odcloud.kr/api/ApplyhomeSpcltySvc/v1/getAPTLttotPblancCmpttRtAndSpcltySttus` +
        `?serviceKey=${encodeURIComponent(API_KEY)}` +
        `&page=1&perPage=10` +
        `&cond%5BHOUSE_MANAGE_NO%3A%3AEQ%5D=${apt.house_manage_no}`

      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) {
        // 두 번째 엔드포인트 시도
        const url2 = `https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancCmpttRt` +
          `?serviceKey=${encodeURIComponent(API_KEY)}` +
          `&page=1&perPage=10` +
          `&cond%5BHOUSE_MANAGE_NO%3A%3AEQ%5D=${apt.house_manage_no}`
        const res2 = await fetch(url2, { headers: { 'Accept': 'application/json' } })
        if (!res2.ok) {
          errors.push(`${apt.house_nm}: HTTP ${res2.status}`)
          continue
        }
        const d2 = await res2.json()
        if (d2?.data?.[0] && debugFields.length < 2) {
          debugFields.push(JSON.stringify({ house: apt.house_nm, fields: Object.keys(d2.data[0]), sample: d2.data[0] }))
        }
        continue
      }

      const data = await res.json()
      const items = data?.data ?? []

      if (debugFields.length === 0 && items[0]) {
        debugFields.push(JSON.stringify({ house: apt.house_nm, fields: Object.keys(items[0]), sample: items[0] }))
      }

      if (items.length > 0) {
        const validItems = items.filter((i: Record<string, string>) =>
          parseFloat(i.CMPTT_RATE ?? i.RCRIT_RATE ?? i.RNKG1_CMPTT_RATE ?? '0') > 0
        )
        if (validItems.length > 0) {
          const avgRate1st = validItems.reduce((s: number, i: Record<string, string>) =>
            s + parseFloat(i.CMPTT_RATE ?? i.RCRIT_RATE ?? i.RNKG1_CMPTT_RATE ?? '0'), 0) / validItems.length
          const avgRate2nd = validItems.reduce((s: number, i: Record<string, string>) =>
            s + parseFloat(i.RNKG2_CMPTT_RATE ?? '0'), 0) / validItems.length
          const totalSpecial = items.reduce((s: number, i: Record<string, string>) =>
            s + parseInt(i.SPSPLY_RCEPT_CNT ?? i.SPSPLY_APL_CNT ?? '0'), 0)
          const totalGeneral = items.reduce((s: number, i: Record<string, string>) =>
            s + parseInt(i.GNRL_RCEPT_CNT ?? i.GNRL_APL_CNT ?? i.APL_CNT ?? '0'), 0)
          const totalSupply = items.reduce((s: number, i: Record<string, string>) =>
            s + parseInt(i.TOT_SUPLY_HSHLDCO ?? i.SUPLY_HSHLDCO ?? i.HSHLD_CO ?? '0'), 0)

          await supabase.from('apt_subscriptions').update({
            competition_rate_1st: parseFloat(avgRate1st.toFixed(2)),
            competition_rate_2nd: avgRate2nd > 0 ? parseFloat(avgRate2nd.toFixed(2)) : null,
            special_supply_total: totalSpecial > 0 ? totalSpecial : null,
            general_supply_total: totalGeneral > 0 ? totalGeneral : null,
            ...(totalSupply > 0 ? { tot_supply_hshld_co: totalSupply } : {}),
            competition_updated_at: new Date().toISOString(),
          }).eq('house_manage_no', apt.house_manage_no)
          updated++
        } else {
          await supabase.from('apt_subscriptions').update({
            competition_rate_1st: 0,
            competition_updated_at: new Date().toISOString(),
          }).eq('house_manage_no', apt.house_manage_no)
          updated++
        }
      }
      await new Promise(r => setTimeout(r, 300))
    } catch (e) {
      errors.push(`${apt.house_nm}: ${String(e)}`)
    }
  }

  return new Response(JSON.stringify({
    success: true,
    processed: apts?.length ?? 0,
    updated,
    errors: errors.slice(0, 5),
    debugFields: debugFields.slice(0, 2),
    timestamp: new Date().toISOString(),
  }, null, 2), { headers: { 'Content-Type': 'application/json' } })
})
