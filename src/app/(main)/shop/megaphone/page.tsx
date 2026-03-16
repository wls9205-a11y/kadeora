import type { Metadata } from 'next';
import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_PRODUCTS } from '@/lib/constants';
import ShopClient from './ShopClient';

export const metadata: Metadata = { title: '샵 | 카더라', description: '카더라 아이템 샵' };

export default async function ShopPage() {
  let products = DEMO_PRODUCTS;
  let isDemo = true;

  try {
    const sb = await createSupabaseServer();
    const { data } = await sb.from('shop_products').select('*').order('is_popular', { ascending: false });
    if (data && data.length > 0) { products = data; isDemo = false; }
  } catch {}

  return <ShopClient products={products} isDemo={isDemo} />;
}
