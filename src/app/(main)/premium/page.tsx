import type { Metadata } from 'next';
export const metadata: Metadata = { robots: { index: false, follow: false } };
import { redirect } from 'next/navigation';

/**
 * /premium → /shop 리디렉트
 * 올인원 상점 페이지로 통합됨 (2026-04-01)
 */
export default function PremiumRedirect() {
  redirect('/shop');
}
