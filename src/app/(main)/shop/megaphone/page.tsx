import type { Metadata } from 'next';
import ShopClient from './ShopClient';

export const metadata: Metadata = { title: '샵 | 카더라', description: '카더라 아이템 샵' };

export default function ShopPage() {
  return <ShopClient />;
}
