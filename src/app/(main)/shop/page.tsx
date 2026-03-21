import type { Metadata } from 'next';
import ShopMain from './ShopMain';

export const metadata: Metadata = { title: '상점', description: '포인트로 아이템을 교환하세요' };

export default function ShopPage() {
  return <ShopMain />;
}
