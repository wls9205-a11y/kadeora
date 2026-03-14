import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShopView } from '@/components/features/ShopView'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '상점' }

export default async function ShopPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/shop')

  const [{ data: products }, { data: profile }, { data: purchases }] = await Promise.all([
    supabase.from('shop_products').select('*').eq('is_active', true).order('price_krw'),
    supabase.from('profiles').select('points, is_premium, premium_expires_at, nickname_change_tickets').eq('id', user.id).single(),
    supabase.from('purchases').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
  ])

  return (
    <ShopView
      products={products ?? []}
      profile={profile}
      recentPurchases={purchases ?? []}
      userId={user.id}
    />
  )
}
