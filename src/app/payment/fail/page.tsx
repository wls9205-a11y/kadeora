import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: '결제 실패', robots: { index: false } };

export default function PaymentFail() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:16, padding:24, textAlign:'center' }}>
      <span style={{ fontSize:64 }}>❌</span>
      <h1 style={{ color:'var(--text-primary)', fontWeight:800, margin:0 }}>결제 실패</h1>
      <p style={{ color:'var(--text-secondary)', margin:0 }}>결제 중 문제가 발생했습니다. 다시 시도해주세요.</p>
      <Link href="/shop/megaphone" style={{ backgroundColor:'var(--brand)', color:'var(--text-inverse)', borderRadius:9999, padding:'12px 32px', fontWeight:700, textDecoration:'none', display:'inline-block' }}>다시 시도</Link>
    </div>
  );
}
