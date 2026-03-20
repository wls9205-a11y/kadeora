'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

type DateFilter = 'today' | 'week' | 'month';

function getDateRange(filter: DateFilter): string {
  const now = new Date();
  if (filter === 'today') return now.toISOString().slice(0, 10);
  if (filter === 'week') return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 600,
      background: active ? 'rgba(34,197,94,0.15)' : 'transparent',
      color: active ? 'var(--success)' : 'var(--text-tertiary)',
      border: `1px solid ${active ? 'var(--success)' : 'var(--border)'}`,
    }}>
      {active ? '활성' : '종료'}
    </span>
  );
}

// ============ NOTICE MANAGER ============
function NoticeSection() {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');
  const [preview, setPreview] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');

  const loadHistory = () => {
    createSupabaseBrowser().from('site_notices').select('*').order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setHistory(data || []));
  };
  useEffect(loadHistory, []);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true); setResult('');
    try {
      const sb = createSupabaseBrowser();
      await sb.from('site_notices').update({ is_active: false }).eq('is_active', true);
      await sb.from('site_notices').insert({ content: content.trim(), is_active: true });
      setResult('공지가 등록됐어요!'); setContent(''); setPreview(false); loadHistory();
      setTimeout(() => setResult(''), 3000);
    } catch { setResult('저장 실패'); setTimeout(() => setResult(''), 3000); }
    finally { setSaving(false); }
  };

  const reactivate = async (id: number) => {
    const sb = createSupabaseBrowser();
    await sb.from('site_notices').update({ is_active: false }).eq('is_active', true);
    await sb.from('site_notices').update({ is_active: true }).eq('id', id);
    loadHistory();
  };

  const filteredHistory = history.filter(n => {
    const date = getDateRange(dateFilter);
    return n.created_at >= date;
  });

  return (
    <div style={card}>
      <h2 style={sectionHeader}>📡 공지 전광판 관리</h2>
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="전광판에 표시할 공지 내용을 입력하세요..." rows={3}
        style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', padding: '10px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={() => setPreview(p => !p)} disabled={!content.trim()}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
          {preview ? '미리보기 닫기' : '미리보기'}
        </button>
        <button onClick={handleSave} disabled={saving || !content.trim()}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: saving ? 'var(--bg-hover)' : 'var(--brand)', color: saving ? 'var(--text-tertiary)' : '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '저장 중...' : '전광판 등록'}
        </button>
      </div>
      {preview && content.trim() && (
        <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #1a3a1a' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 10px', background: 'var(--bg-hover)' }}>미리보기</div>
          <div style={{ background: '#0a1a0a', height: 32, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <div style={{ whiteSpace: 'nowrap', animation: 'kd-notice-preview 20s linear infinite', paddingLeft: '100%', fontSize: 12, fontWeight: 600, color: '#4ade80' }}>
              📡&nbsp;{content}<span style={{ margin: '0 48px', color: '#166534' }}>◆</span>📡&nbsp;{content}
            </div>
          </div>
          <style>{`@keyframes kd-notice-preview { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }`}</style>
        </div>
      )}
      {result && <p style={{ marginTop: 8, fontSize: 13, color: result.includes('등록') ? 'var(--success)' : 'var(--error)' }}>{result}</p>}

      {/* History Toggle */}
      <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <button onClick={() => setShowHistory(p => !p)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, padding: 0,
        }}>
          공지사항 내역 {showHistory ? '▲' : '▼'}
        </button>
        {showHistory && (
          <div style={{ marginTop: 8 }}>
            <DateFilterButtons value={dateFilter} onChange={setDateFilter} />
            <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-sunken)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>내용</th>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>날짜</th>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>상태</th>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)' }}>해당 기간 내역 없음</td></tr>
                  ) : filteredHistory.map((n: any, i: number) => (
                    <tr key={n.id} style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-hover)' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.content?.slice(0, 40)}{n.content?.length > 40 ? '...' : ''}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)' }}>{new Date(n.created_at).toLocaleDateString('ko-KR')}</td>
                      <td style={{ padding: '8px 10px' }}><StatusBadge active={n.is_active} /></td>
                      <td style={{ padding: '8px 10px' }}>
                        {!n.is_active && (
                          <button onClick={() => reactivate(n.id)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>재활성</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ PUSH BROADCAST ============
function PushSection() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/feed');
  const [imageUrl, setImageUrl] = useState('');
  const [sendTarget, setSendTarget] = useState<'all'|'web'|'app'>('all');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');

  useEffect(() => {
    createSupabaseBrowser().from('push_logs').select('*').order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => setLogs(data || []));
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true); setResult('');
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), url, target: sendTarget, ...(imageUrl ? { image: imageUrl } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`앱내 ${data.app_notif}명, 푸시 ${data.push_sent}/${data.push_total}명 발송`);
        setTitle(''); setBody('');
        // Reload logs
        createSupabaseBrowser().from('push_logs').select('*').order('created_at', { ascending: false }).limit(30)
          .then(({ data: d }) => setLogs(d || []));
      } else { setResult(`발송 실패: ${data.error}`); }
    } catch { setResult('발송 실패'); }
    setSending(false);
    setTimeout(() => setResult(''), 3000);
  };

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' };

  const LogoSvg = ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#FF4500"/><circle cx="10" cy="16" r="4" fill="white"/><circle cx="16" cy="16" r="4" fill="white"/><circle cx="22" cy="16" r="4" fill="white"/></svg>
  );

  const filteredLogs = logs.filter(l => {
    const date = getDateRange(dateFilter);
    return l.created_at >= date;
  });

  return (
    <div style={card}>
      <h2 style={sectionHeader}>📣 푸시 알림 발송</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>발송 대상</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([{ key: 'all' as const, label: '전체' }, { key: 'web' as const, label: '웹' }, { key: 'app' as const, label: '앱' }]).map(t => (
              <button key={t.key} onClick={() => setSendTarget(t.key)} style={{
                flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                border: `1.5px solid ${sendTarget === t.key ? 'var(--brand)' : 'var(--border)'}`,
                background: sendTarget === t.key ? 'var(--brand)' : 'var(--bg-hover)',
                color: sendTarget === t.key ? '#fff' : 'var(--text-secondary)', cursor: 'pointer',
              }}>{t.label}</button>
            ))}
          </div>
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목" style={inp} />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="내용" rows={3} style={{ ...inp, resize: 'vertical' as const, fontFamily: 'inherit' }} />
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL (기본: /feed)" style={inp} />
        <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="이미지 URL (선택) - https://..." style={inp} />

        {/* Preview grid */}
        {(title.trim() || body.trim()) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
            <div style={{ background: '#1a1a2e', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Android</div>
              <div style={{ background: '#2a2a3e', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#FF4500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LogoSvg size={16} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{title || '제목'}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>{body || '내용'}</div>
                </div>
              </div>
            </div>
            <div style={{ background: '#1c1c1e', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>iPhone</div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: '#FF4500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LogoSvg size={12} /></div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>카더라</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{title || '제목'}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.3 }}>{body || '내용'}</div>
              </div>
            </div>
          </div>
        )}

        <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()}
          style={{ padding: '12px 0', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
          {sending ? '발송 중...' : `${sendTarget === 'all' ? '전체' : sendTarget === 'web' ? '웹' : '앱'} 발송`}
        </button>
        {result && <div style={{ fontSize: 13, color: result.includes('발송 실패') ? 'var(--error)' : 'var(--success)', padding: '4px 0' }}>{result}</div>}
      </div>

      {/* History Toggle */}
      <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <button onClick={() => setShowHistory(p => !p)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, padding: 0,
        }}>
          푸시 발송 내역 {showHistory ? '▲' : '▼'}
        </button>
        {showHistory && (
          <div style={{ marginTop: 8 }}>
            <DateFilterButtons value={dateFilter} onChange={setDateFilter} />
            <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-sunken)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>제목</th>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>날짜</th>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>발송</th>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>클릭</th>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)' }}>해당 기간 내역 없음</td></tr>
                  ) : filteredLogs.map((l: any, i: number) => {
                    const ctr = l.sent_count > 0 ? Math.round((l.click_count / l.sent_count) * 100) : 0;
                    return (
                      <tr key={l.id} style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-hover)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-primary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)' }}>{new Date(l.created_at).toLocaleDateString('ko-KR')}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{l.sent_count}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{l.click_count}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                            background: ctr >= 10 ? 'rgba(34,197,94,0.15)' : ctr >= 5 ? 'rgba(245,158,11,0.15)' : 'transparent',
                            color: ctr >= 10 ? 'var(--success)' : ctr >= 5 ? 'var(--warning)' : 'var(--text-tertiary)',
                          }}>{ctr}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ MAIN PAGE ============
export default function AdminNotificationsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>📢 알림·공지</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <NoticeSection />
        <PushSection />
      </div>
    </div>
  );
}
