'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const REGIONS = ['서울','부산','인천','대구','광주','대전','울산','경기','강원','충청','전라','경상','제주'];

export default function BetaPage() {
  const [form, setForm] = useState({ name:'', contact:'', region:'', age_group:'', referral:'', agreed_terms:false });
  const [status, setStatus] = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [count, setCount] = useState<number|null>(null);
  const supabase = createSupabaseBrowser();

  useEffect(() => {
    supabase.from('beta_testers').select('*', { count:'exact', head:true }).then(({ count:c }) => setCount(c ?? 0));
  }, []);

  const handleSubmit = async () => {
    if (!form.name || !form.contact || !form.agreed_terms) return;
    setStatus('loading');
    const { error } = await supabase.from('beta_testers').insert(form);
    setStatus(error ? 'error' : 'done');
  };

  if (status === 'done') return (
    <div style={{ maxWidth:480, margin:'60px auto', padding:'0 20px', textAlign:'center' }}>
      <div style={{ fontSize:64 }}>🎉</div>
      <h1 style={{ color:'var(--text-primary)', fontSize:24, fontWeight:800 }}>신청 완료!</h1>
      <p style={{ color:'var(--text-secondary)' }}>선정 시 연락드릴게요</p>
      <a href="/feed" style={{ display:'inline-block', marginTop:20, background:'var(--brand)', color:'var(--text-inverse)', padding:'10px 24px', borderRadius:20, textDecoration:'none', fontWeight:700 }}>피드 보러가기</a>
    </div>
  );

  return (
    <div style={{ maxWidth:480, margin:'0 auto', padding:'20px 20px 80px' }}>
      <div style={{ textAlign:'center', padding:'32px 0 24px' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🧪</div>
        <h1 style={{ fontSize:24, fontWeight:800, color:'var(--text-primary)', margin:'0 0 8px' }}>카더라 베타테스터 모집</h1>
        <p style={{ color:'var(--text-secondary)', fontSize:14 }}>먼저 경험하고 의견을 주세요</p>
        {count !== null && <div style={{ display:'inline-block', background:'var(--brand-light)', color:'var(--brand)', padding:'4px 14px', borderRadius:20, fontSize:13, fontWeight:700, marginTop:8 }}>현재 {count}명 신청</div>}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <label style={{ fontSize:13, color:'var(--text-secondary)', display:'block', marginBottom:6 }}>이름 *</label>
          <input value={form.name} onChange={e => setForm(p=>({...p, name:e.target.value}))} placeholder="홍길동" style={{ width:'100%', padding:'10px 14px', background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:14, boxSizing:'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize:13, color:'var(--text-secondary)', display:'block', marginBottom:6 }}>연락처 *</label>
          <input value={form.contact} onChange={e => setForm(p=>({...p, contact:e.target.value}))} placeholder="이메일 또는 전화번호" style={{ width:'100%', padding:'10px 14px', background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:14, boxSizing:'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize:13, color:'var(--text-secondary)', display:'block', marginBottom:6 }}>지역</label>
          <select value={form.region} onChange={e => setForm(p=>({...p, region:e.target.value}))} style={{ width:'100%', padding:'10px 14px', background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:14 }}>
            <option value="">선택</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', fontSize:13, color:'var(--text-secondary)' }}>
          <input type="checkbox" checked={form.agreed_terms} onChange={e => setForm(p=>({...p, agreed_terms:e.target.checked}))} style={{ marginTop:2, accentColor:'var(--brand)' }} />
          [필수] 베타 테스트 참여 및 피드백 수집에 동의합니다
        </label>
        <button onClick={handleSubmit} disabled={status==='loading'||!form.name||!form.contact||!form.agreed_terms}
          style={{ width:'100%', padding:14, background:'var(--brand)', color:'var(--text-inverse)', border:'none', borderRadius:20, cursor:'pointer', fontWeight:800, fontSize:16, opacity:(!form.name||!form.contact||!form.agreed_terms)?0.5:1 }}>
          {status === 'loading' ? '신청 중...' : '베타테스터 신청하기'}
        </button>
        {status === 'error' && <p style={{ color:'var(--error)', fontSize:13, textAlign:'center' }}>오류가 발생했어요</p>}
      </div>
    </div>
  );
}
