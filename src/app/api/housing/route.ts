import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = await createClient()
  const apiKey = process.env.APT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'APT_API_KEY not configured' }, { status: 500 })
  }
  try {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const url = 'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail'
    const params = new URLSearchParams()
    params.append('serviceKey', apiKey)
    params.append('pageNo', '1')
    params.append('numOfRows', '100')
    params.append('cond[RCEPT_BGNDE_FROM]', today)
    params.append('type', 'json')
    const res = await fetch(`${url}?${params}`)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const json = await res.json()
    const items = json?.data ?? []
    if (items.length > 0) {
      const records = items.map((item: Record<string, string>) => ({
        house_manage_no: item.HOUSE_MANAGE_NO,
        house_nm: item.HOUSE_NM,
        region_cd: item.SUBSCRPT_AREA_CODE,
        region_nm: item.SUBSCRPT_AREA_CODE_NM,
        supply_addr: item.HSSPLY_ADRES,
        tot_supply_hshld_co: parseInt(item.TOT_SUPLY_HSHLDCO ?? '0'),
        rcept_bgnde: item.RCEPT_BGNDE ? `${item.RCEPT_BGNDE.slice(0,4)}-${item.RCEPT_BGNDE.slice(4,6)}-${item.RCEPT_BGNDE.slice(6,8)}` : null,
        rcept_endde: item.RCEPT_ENDDE ? `${item.RCEPT_ENDDE.slice(0,4)}-${item.RCEPT_ENDDE.slice(4,6)}-${item.RCEPT_ENDDE.slice(6,8)}` : null,
        mvn_prearnge_ym: item.MVN_PREARNGE_YM,
        pblanc_url: item.PBLANC_URL,
        updated_at: new Date().toISOString(),
      }))
      const { error } = await supabase.from('apt_subscriptions').upsert(records, { onConflict: 'house_manage_no' })
      if (error) throw error
      await supabase.from('sync_log').upsert({ target: 'apt_subscriptions', synced_at: new Date().toISOString(), row_count: records.length }, { onConflict: 'target' })
      return NextResponse.json({ success: true, synced: records.length })
    }
    return NextResponse.json({ success: true, synced: 0 })
  } catch (error) {
    console.error('Housing sync error:', error)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const region = searchParams.get('region')
  let query = supabase.from('apt_subscriptions').select('*').order('rcept_bgnde', { ascending: false }).limit(30)
  if (region) query = query.ilike('region_nm', `%${region}%`)
  const { data } = await query
  return NextResponse.json({ apts: data ?? [] })
}
