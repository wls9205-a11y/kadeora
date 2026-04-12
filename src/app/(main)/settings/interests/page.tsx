'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';

const INTERESTS = [
  { key: 'stock', label: '📈 주식', desc: '실시간 시세·AI 분석' },
  { key: 'apt', label: '🏠 청약/부동산', desc: '청약일정·시세변동' },
  { key: 'redev', label: '🏗️ 재개발', desc: '사업진행·조합현황' },
  { key: 'etf', label: '💰 ETF', desc: '해외 ETF·배당' },
  { key: 'overseas', label: '🌍 해외주식', desc: '미국·글로벌 시장' },
  { key: 'crypto', label: '₿ 암호화폐', desc: '시세·뉴스' },
  { key: 'news', label: '📰 경제뉴스', desc: '매일 핵심 요약' },
  { key: 'tax', label: '🧾 세금/절세', desc: '절세 팁·세법변경' },
  { key: 'free', label: '☕ 자유/잡담', desc: '투자 외 이야기' },
];

export default function InterestsSettingsPage() {
  const router = useRouter();
  const { userId } = useAuth();
  const { success, error: showError } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const sb = createSupabaseBrowser();
    sb.from('profiles').select('interests').eq('id', userId).single()
      .then(({ data }) => {
        if (data?.interests?.length) setSelected(data.interests);
        setLoaded(true);
      });
  }, [userId]);

  const toggle = (key: string) =>
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleSave = async () => {
    if (selected.length === 0 || !userId) { showError('최소 1개 선택하세요'); return; }
    setSaving(true);
    try {
      const sb = createSupabaseBrowser();
      await sb.from('profiles').update({
        interests: selected,
        updated_at: new Date().toISOString(),
      }).eq('id', userId);
      success('관심사 저장 완료!');
    } catch {
      showError('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>💡</div>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>로그인이 필요합니다</div>
        <a href="/login?redirect=/settings/interests" style={{ color: 'var(--brand)', fontWeight: 600 }}>로그인하기</a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14, marginBottom: 16, padding: 0 }}>
        ← 뒤로
      </button>

      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>💡 관심사 설정</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
        관심사를 선택하면 맞춤 피드와 콘텐츠를 받아볼 수 있어요 (최소 1개)
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 24 }}>
        {INTERESTS.map(item => {
          const isSelected = selected.includes(item.key);
          return (
            <button key={item.key} onClick={() => toggle(item.key)} style={{
              padding: '14px 12px', borderRadius: 'var(--radius-card)', textAlign: 'left',
              background: isSelected ? 'rgba(59,123,246,0.06)' : 'var(--bg-surface)',
              border: isSelected ? '2px solid var(--brand)' : '1px solid var(--border)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 15, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{item.desc}</div>
              {isSelected && <div style={{ fontSize: 10, color: 'var(--brand)', fontWeight: 700, marginTop: 4 }}>✓ 선택됨</div>}
            </button>
          );
        })}
      </div>

      <button onClick={handleSave} disabled={selected.length === 0 || saving} style={{
        width: '100%', padding: '14px 0', borderRadius: 'var(--radius-md)',
        background: selected.length > 0 ? 'var(--brand)' : 'var(--bg-hover)',
        color: selected.length > 0 ? '#fff' : 'var(--text-tertiary)',
        border: 'none', fontSize: 15, fontWeight: 700, cursor: selected.length > 0 ? 'pointer' : 'default',
        opacity: saving ? 0.6 : 1,
      }}>
        {saving ? '저장 중...' : `저장하기 (${selected.length}개 선택)`}
      </button>
    </div>
  );
}
