import { redirect } from 'next/navigation';

/**
 * /premium → /shop 리디렉트
 * 올인원 상점 페이지로 통합됨 (2026-04-01)
 */
export default function PremiumRedirect() {
  redirect('/shop');
}
