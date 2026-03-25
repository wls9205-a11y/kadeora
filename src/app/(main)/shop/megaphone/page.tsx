import type { Metadata } from 'next';
import ShopClient from './ShopClient';

export const revalidate = 3600;

export const metadata: Metadata = { title: '확성기 | 카더라', description: '카더라 아이템 샵 — 확성기로 내 글을 돋보이게 하세요.', alternates: { canonical: 'https://kadeora.app/shop/megaphone' } };

export default function ShopPage() {
  return <ShopClient />;
}
