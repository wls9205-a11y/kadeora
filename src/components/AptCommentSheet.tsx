'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import BottomSheet from '@/components/BottomSheet';
import { timeAgo } from '@/lib/format';

interface Props { houseKey: string; houseNm: string; houseType: 'sub' | 'unsold' | 'redev'; open: boolean; onClose: () => void; }

export default function AptCommentSheet({ houseKey, houseNm, houseType, open, onClose }: Props) {
  const pathname = usePathname();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const { userId } = useAuth();



  useEffect(() => {
    if (!open) return;
    fetch(`/api/apt/comments?house_key=${encodeURIComponent(houseKey)}`).then(r => r.json()).then(d => setComments(d.comments || []));
  }, [open, houseKey]);

  useEffect(() => {
    if (!open) return;
    const sb = createSupabaseBrowser();
    const ch = sb.channel(`apt-${houseKey}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'apt_comments', filter: `house_key=eq.${houseKey}` }, (payload: { new: Record<string, any> }) => {
      setComments(p => [{ ...payload.new, nickname: '새 댓글' }, ...p]);
    }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [open, houseKey]);

  useEffect(() => { if (open) document.body.style.overflow = 'hidden'; else document.body.style.overflow = ''; return () => { document.body.style.overflow = ''; }; }, [open]);

  const submit = async () => {
    if (!text.trim() || !userId) return;
    setSending(true);
    const res = await fetch('/api/apt/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ house_key: houseKey, house_nm: houseNm, house_type: houseType, content: text.trim() }) });
    if (res.ok) { const d = await res.json(); setComments(p => [d.comment, ...p]); setText(''); }
    setSending(false);
  };

  if (!open) return null;
  return (
    <BottomSheet open={open} onClose={onClose} title={`✏️ ${houseNm} 한줄평`}>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
          {comments.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>
              <div style={{ fontSize: 'var(--fs-base)', marginBottom: 12 }}>첫 한줄평을 남겨보세요! 👋</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(houseType === 'sub' ? [
                  '💬 모델하우스 다녀오셨나요?',
                  '🏗️ 시공사 평판은 어떤가요?',
                  '🚇 교통/학군 어떤 것 같으세요?',
                  '💰 분양가 적당한가요?',
                ] : houseType === 'unsold' ? [
                  '🤔 미분양인 이유가 뭘까요?',
                  '📉 추가 할인 소식 있나요?',
                  '🏠 실거주 vs 투자 어떤 목적?',
                ] : [
                  '📋 사업 진행 상황은 어떤가요?',
                  '🏗️ 주민 의견은 어떤가요?',
                ]).map((q, i) => (
                  <button key={i} onClick={() => setText(q.replace(/^.{2}/, ''))} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', cursor: 'pointer', textAlign: 'left' }}>{q}</button>
                ))}
              </div>
            </div>
          )}
          {comments.map((c: Record<string, any>) => (
            <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--brand)' }}>{c.nickname}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{timeAgo(c.created_at)}</span>
              </div>
              <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', lineHeight: 1.5 }}>{c.content}</div>
            </div>
          ))}
        </div>
        {userId ? (
          <div>
            <div style={{ position: 'relative' }}>
              <textarea value={text} onChange={e => setText(e.target.value.slice(0, 200))} rows={2} maxLength={200} placeholder={houseType === 'sub' ? '이 단지 분양가 어때요? 주변 환경은?' : houseType === 'unsold' ? '미분양 이유가 뭘까요? 할인 소식?' : '사업 진행 상황이나 주변 분위기는?'}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 'var(--fs-base)', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <span style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{text.length}/200</span>
            </div>
            <button onClick={submit} disabled={sending || !text.trim()} style={{ marginTop: 8, width: '100%', padding: '10px 0', background: 'var(--brand)', color: 'var(--text-inverse)', border: 'none', borderRadius: 8, fontSize: 'var(--fs-base)', fontWeight: 700, cursor: 'pointer', opacity: !text.trim() ? 0.5 : 1 }}>
              {sending ? '등록 중...' : '등록'}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textAlign: 'center', padding: 12 }}>
            <a href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{ color: 'var(--brand)' }}>로그인</a> 후 한줄평을 남길 수 있어요
          </div>
        )}
    </BottomSheet>
  );
}
