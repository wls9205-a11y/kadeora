import type { Metadata } from 'next';
import BannerShopClient from './BannerShopClient';

export const metadata: Metadata = {
  title: '전광판 노출권 | 카더라',
  description: '내 글을 전광판에 노출하세요',
};

export default function BannerShopPage() {
  return <BannerShopClient />;
}
