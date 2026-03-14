import { createClient } from '@/lib/supabase/server'
import { StockList } from '@/components/features/StockList'
import { StockPostFeed } from '@/components/features/StockPostFeed'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '주식' }

interface StocksPageProps {
  searchParams: Promise<{ q?: string; market?: string }>
}

export default async function StocksPage({ searchParams }: StocksPageProps) {
  const params = await searchParams
  const query = params.q ?? ''
  const market = params.market ?? 'all'
  const supabase = await createClient()

  // 주식 시세
  let stockQuery = supabase.from('stock_quotes').select('*').order('volume', { ascending: false })
  if (market !== 'all') stockQuery = stockQuery.eq('market', market)
  if (query) stockQuery = stockQuery.ilike('name', `%${query}%`)
  const { data: stocks } = await stockQuery.limit(50)

  // 주식 관련 게시글
  let postQuery = supabase
    .from('posts')
    .select(`*, profiles:author_id(id, nickname, avatar_url, grade, grade_title, is_premium)`)
    .eq('category', 'stock')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(20)
  if (query) postQuery = postQuery.contains('stock_tags', [query.toUpperCase()])
  const { data: posts } = await postQuery

  return (
    <div className="min-h-screen">
      <StockList stocks={stocks ?? []} currentMarket={market} query={query} />
      <StockPostFeed posts={(posts ?? []) as any} query={query} />
    </div>
  )
}
