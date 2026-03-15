'use client';
import Link from 'next/link';
export default function PaymentClient() {
  return (
    <div style={{maxWidth:480,margin:'60px auto',padding:'0 20px',textAlign:'center'}}>
      <div style={{background:'#111827',border:'1px solid #1E293B',borderRadius:16,padding:'40px 32px'}}>
        <div style={{fontSize:48,marginBottom:16}}>🔒</div>
        <h1 style={{color:'#F1F5F9',fontSize:22,fontWeight:800,margin:'0 0 12px'}}>결제 준비 중</h1>
        <p style={{color:'#94A3B8',fontSize:14,lineHeight:1.6,margin:'0 0 24px'}}>토스페이먼츠 결제 연동이 곧 완료됩니다.</p>
        <Link href="/shop/megaphone" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'12px 24px',borderRadius:10,background:'#3B82F6',color:'white',textDecoration:'none',fontWeight:700}}>🛒 상점 바로가기</Link>
      </div>
    </div>
  );
}