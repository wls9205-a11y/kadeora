'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

type Category = 'bug' | 'ux' | 'feature' | 'content' | 'performance' | 'other';
const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: 'bug', label: '버그/오류', emoji: '🐛' },
  { value: 'ux', label: 'UI/UX', emoji: '🎨' },
  { value: 'feature', label: '기능 요청', emoji: '💡' },
  { value: 'content', label: '콘텐츠', emoji: '📝' },
  { value: 'performance', label: '속도/성능', emoji: '⚡' },
  { value: 'other', label: '기타', emoji: '💬' },
];

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'category' | 'rating' | 'message' | 'done'>('category');
  const [category, setCategory] = useState<Category>('bug');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setOpen(false); setStep('category'); setMessage(''); setRating(0); };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setLoading(true);
    const sb = createSupabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    await sb.from('user_feedback').insert({
      user_id: user?.id ?? null, page: window.location.pathname,
      category, rating: rating || null, message: message.trim(),
      device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    });
    setLoading(false);
    setStep('done');
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} aria-label="피드백" style={{
      position:'fixed', bottom:80, right:16, zIndex:999,
      width:48, height:48, borderRadius:'50%',
      background:'var(--brand)', color:'var(--text-inverse)',
      border:'none', cursor:'pointer', fontSize:20,
      boxShadow:'0 4px 12px rgba(0,0,0,0.4)',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>💬</button>
  );

  return (
    <div style={{
      position:'fixed', bottom:80, right:16, zIndex:1000,
      background:'var(--bg-surface)', border:'1px solid var(--border)',
      borderRadius:16, padding:20, width:300, boxShadow:'0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
        <span style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>💬 피드백</span>
        <button onClick={reset} aria-label="닫기" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', fontSize:18 }}>✕</button>
      </div>
      {step === 'done' ? (
        <div style={{ textAlign:'center', padding:'20px 0' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🙏</div>
          <p style={{ color:'var(--text-primary)', fontWeight:700 }}>감사합니다!</p>
          <button onClick={reset} style={{ marginTop:16, background:'var(--brand)', color:'var(--text-inverse)', border:'none', borderRadius:20, padding:'8px 20px', cursor:'pointer', fontWeight:700 }}>닫기</button>
        </div>
      ) : step === 'category' ? (
        <div>
          <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:12 }}>어떤 피드백인가요?</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {CATEGORIES.map(c => (
              <button key={c.value} onClick={() => { setCategory(c.value); setStep('rating'); }}
                style={{ background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 8px', cursor:'pointer', color:'var(--text-primary)', fontSize:12, textAlign:'center' }}>
                <div style={{ fontSize:20, marginBottom:4 }}>{c.emoji}</div>{c.label}
              </button>
            ))}
          </div>
        </div>
      ) : step === 'rating' ? (
        <div>
          <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:12 }}>만족도</p>
          <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:20 }}>
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setRating(n)} style={{ fontSize:28, background:'none', border:'none', cursor:'pointer', opacity:rating>=n?1:0.3 }}>⭐</button>
            ))}
          </div>
          <button onClick={() => setStep('message')} style={{ width:'100%', background:rating?'var(--brand)':'var(--bg-hover)', color:rating?'var(--text-inverse)':'var(--text-secondary)', border:'none', borderRadius:20, padding:10, cursor:'pointer', fontWeight:700 }}>다음</button>
        </div>
      ) : (
        <div>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="자세히 알려주세요" maxLength={500}
            style={{ width:'100%', minHeight:80, padding:10, background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, resize:'vertical', boxSizing:'border-box' }} />
          <div style={{ fontSize:11, color:'var(--text-tertiary)', textAlign:'right', marginBottom:8 }}>{message.length}/500</div>
          <button onClick={handleSubmit} disabled={loading||!message.trim()} style={{ width:'100%', background:message.trim()?'var(--brand)':'var(--bg-hover)', color:message.trim()?'var(--text-inverse)':'var(--text-secondary)', border:'none', borderRadius:20, padding:10, cursor:'pointer', fontWeight:700 }}>
            {loading ? '전송 중...' : '보내기'}
          </button>
        </div>
      )}
    </div>
  );
}
