'use client';
import { useState, useEffect } from 'react';

type DateFilter = 'today' | 'week' | 'month';
const dateFilterLabel: Record<DateFilter, string> = { today: '오늘', week: '이번주', month: '이번달' };

const sectionHeader: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 };
const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 };

function DateFilterButtons({ value, onChange }: { value: DateFilter; onChange: (v: DateFilter) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {(['today', 'week', 'month'] as DateFilter[]).map(f => (
        <button key={f} onClick={() => onChange(f)} style={{
          padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          background: value === f ? 'var(--brand)' : 'var(--bg-hover)',
          color: value === f ? '#fff' : 'var(--text-secondary)',
        }}>{dateFilterLabel[f]}</button>
      ))}
    </div>
  );
}

// ============ SEED DATA MANAGER ============
function SeedSection() {
  const [stats, setStats] = useState<{ users: number; posts: number; comments: number; likes: number } | null>(null);
  const [deleting, setDeleting] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const [result, setResult] = useState('');
  const [showHistory, setShowHistory] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');

  const load = () => {
    fetch('/api/admin/seed-stats').then(r => r.json()).then(setStats).catch(() => {});
  };
  useEffect(load, []);

  const handleDelete = async (target: string) => {
    setDeleting(target); setResult('');
    try {
      const res = await fetch(`/api/admin/seed-delete?target=${target}`, { method: 'DELETE' });
      const data = await res.json();
      setResult(res.ok ? `${target} 삭제 완료` : data.error || '삭제 실패');
      load();
    } catch { setResult('삭제 실패'); }
    setDeleting(''); setConfirmAll(false);
    setTimeout(() => setResult(''), 3000);
  };

  const btn = (target: string, label: string, color: string) => (
    <button key={target} onClick={() => handleDelete(target)} disabled={!!deleting}
      style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${color}`, background: 'transparent', color, fontSize: 12, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting === target ? 0.5 : 1 }}>
      {deleting === target ? '삭제중...' : label}
    </button>
  );

  if (!stats) return <div style={{ ...card }}><div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 16 }}>로딩 중...</div></div>;

  return (
    <div style={card}>
      <h2 style={sectionHeader}>🧪 시드 데이터 관리</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: '시드 유저', value: stats.users, icon: '👤' },
          { label: '시드 게시글', value: stats.posts, icon: '📝' },
          { label: '시드 댓글', value: stats.comments, icon: '💬' },
          { label: '시드 좋아요', value: stats.likes, icon: '❤️' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 16 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {btn('likes', '좋아요 삭제', 'var(--warning)')}
        {btn('comments', '댓글 삭제', 'var(--warning)')}
        {btn('posts', '게시글 삭제', 'var(--error)')}
        {btn('users', '유저 삭제', 'var(--error)')}
      </div>
      {!confirmAll ? (
        <button onClick={() => setConfirmAll(true)} style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: '2px solid var(--error)', background: 'transparent', color: 'var(--error)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          전체 일괄 삭제
        </button>
      ) : (
        <button onClick={() => handleDelete('all')} disabled={!!deleting} style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--error)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {deleting === 'all' ? '삭제 중...' : '정말 전체 삭제합니다 (되돌릴 수 없음)'}
        </button>
      )}
      {result && <div style={{ fontSize: 12, color: result.includes('실패') ? 'var(--error)' : 'var(--success)', marginTop: 6 }}>{result}</div>}

      {/* History Toggle */}
      <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <button onClick={() => setShowHistory(p => !p)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, padding: 0,
        }}>
          시드 자동발행 내역 {showHistory ? '▲' : '▼'}
        </button>
        {showHistory && (
          <div style={{ marginTop: 8 }}>
            <DateFilterButtons value={dateFilter} onChange={setDateFilter} />
            <div style={{ marginTop: 8, padding: 16, background: 'var(--bg-hover)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div><strong>시드 게시글 자동 발행 크론:</strong></div>
              <div>주기: 30분 마다 (vercel.json cron 설정)</div>
              <div>엔드포인트: /api/cron/seed-posts</div>
              <div>시드 유저 10명 중 랜덤 선택</div>
              <div>ANTHROPIC_API_KEY 있으면 Claude Haiku로 생성, 없으면 템플릿 사용</div>
              <div style={{ marginTop: 8, color: 'var(--text-tertiary)' }}>
                * 크론 로그는 Vercel Dashboard &gt; Functions &gt; Cron 에서 확인 가능
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ CRON MANUAL TRIGGER ============
function CronSection() {
  const [triggering, setTriggering] = useState('');
  const [result, setResult] = useState('');

  const triggerCron = async (endpoint: string, label: string) => {
    setTriggering(endpoint); setResult('');
    try {
      const res = await fetch('/api/admin/trigger-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`${label} 실행 완료: ${JSON.stringify(data).slice(0, 100)}`);
      } else {
        setResult(`${label} 실행 실패: ${data.error || 'Unknown error'}`);
      }
    } catch { setResult(`${label} 요청 실패`); }
    setTriggering('');
    setTimeout(() => setResult(''), 3000);
  };

  const crons = [
    { endpoint: '/api/cron/seed-posts', label: '시드 게시글 생성', desc: '랜덤 시드 유저로 게시글 1개 자동 생성' },
    { endpoint: '/api/cron/seed-comments', label: '시드 댓글 생성', desc: '랜덤 게시글에 시드 유저 댓글 생성' },
    { endpoint: '/api/cron/seed-chat', label: '시드 채팅 생성', desc: '카더라 라운지에 시드 유저 대화 생성' },
    { endpoint: '/api/stock-refresh', label: '주식 데이터 갱신', desc: '주식 관련 데이터 캐시 갱신' },
  ];

  return (
    <div style={card}>
      <h2 style={sectionHeader}>🔧 크론 수동 실행</h2>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
        Vercel 크론으로 자동 실행되는 작업을 수동으로 트리거합니다
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {crons.map(c => (
          <div key={c.endpoint} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.desc}</div>
            </div>
            <button onClick={() => triggerCron(c.endpoint, c.label)} disabled={!!triggering} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700, cursor: triggering ? 'not-allowed' : 'pointer',
              background: triggering === c.endpoint ? 'var(--bg-hover)' : 'var(--brand)',
              color: triggering === c.endpoint ? 'var(--text-tertiary)' : '#fff',
            }}>
              {triggering === c.endpoint ? '실행 중...' : '실행'}
            </button>
          </div>
        ))}
      </div>
      {result && <div style={{ fontSize: 12, marginTop: 8, color: result.includes('실패') ? 'var(--error)' : 'var(--success)' }}>{result}</div>}
    </div>
  );
}

// ============ MANUAL CONTROL ============
function ManualControlSection() {
  const [triggering, setTriggering] = useState('');
  const [result, setResult] = useState('');

  const actions = [
    { endpoint: '/api/admin/refresh-apt-cache', label: '부동산 캐시 갱신' },
    { endpoint: '/api/admin/fetch-unsold', label: '미분양 데이터 수집' },
  ];

  const trigger = async (endpoint: string, label: string) => {
    setTriggering(endpoint); setResult('');
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setResult(`${label} 완료: ${JSON.stringify(data).slice(0, 100)}`);
      } else {
        setResult(`${label} 실패: ${data.error || 'Unknown error'}`);
      }
    } catch { setResult(`${label} 요청 실패`); }
    setTriggering('');
    setTimeout(() => setResult(''), 3000);
  };

  return (
    <div style={card}>
      <h2 style={sectionHeader}>🎛️ 수동 실행 컨트롤</h2>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
        관리자 전용 수동 실행 작업
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {actions.map(a => (
          <div key={a.endpoint} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</div>
            </div>
            <button onClick={() => trigger(a.endpoint, a.label)} disabled={!!triggering} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700, cursor: triggering ? 'not-allowed' : 'pointer',
              background: triggering === a.endpoint ? 'var(--bg-hover)' : 'var(--brand)',
              color: triggering === a.endpoint ? 'var(--text-tertiary)' : '#fff',
            }}>
              {triggering === a.endpoint ? '실행 중...' : '실행'}
            </button>
          </div>
        ))}
      </div>
      {result && <div style={{ fontSize: 12, marginTop: 8, color: result.includes('실패') ? 'var(--error)' : 'var(--success)' }}>{result}</div>}
    </div>
  );
}

// ============ MAIN PAGE ============
export default function AdminSystemPage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>⚙️ 시스템</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SeedSection />
        <CronSection />
        <ManualControlSection />
      </div>
    </div>
  );
}
