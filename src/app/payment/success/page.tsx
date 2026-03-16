import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: '결제 완료 | 카더라', robots: { index: false } };

export default function PaymentSuccess() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:16, padding:24, textAlign:'center' }}>
      <span style={{ fontSize:64 }}>✅</span>
      <h1 style={{ color:'var(--text-primary)', fontWeight:800, margin:0 }}>결제 완료!</h1>
      <p style={{ color:'var(--text-secondary)', margin:0 }}>결제가 성공적으로 완료되었습니다.</p>
      <Link href="/feed" style={{ backgroundColor:'var(--brand)', color:'var(--text-inverse)', borderRadius:9999, padding:'12px 32px', fontWeight:700, textDecoration:'none', display:'inline-block' }}>홈으로 이동</Link>
    </div>
  );
}
