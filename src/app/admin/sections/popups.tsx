'use client';
import { useState, useEffect, useCallback } from 'react';
import { C, Spinner } from '../admin-shared';

interface PopupAd {
  id: number;
  title: string;
  content: string | null;
  image_url: string | null;
  link_url: string | null;
  link_label: string | null;
  position: string;
  display_type: string;
  target_pages: string[];
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  priority: number;
  dismiss_duration_hours: number;
  max_impressions: number | null;
  current_impressions: number;
  click_count: number;
  created_at: string;
  updated_at: string;
}

const EMPTY: Omit<PopupAd, 'id' | 'current_impressions' | 'click_count' | 'created_at' | 'updated_at'> = {
  title: '',
  content: '',
  image_url: '',
  link_url: '',
  link_label: '자세히 보기',
  position: 'center',
  display_type: 'modal',
  target_pages: ['/feed'],
  start_date: new Date().toISOString().slice(0, 16),
  end_date: null,
  is_active: true,
  priority: 0,
  dismiss_duration_hours: 24,
  max_impressions: null,
};

const fmt = (n: number) => n.toLocaleString();
const ago = (d: string) => {
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 3600000) return `${Math.floor(ms / 60000)}분 전`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}시간 전`;
  return `${Math.floor(ms / 86400000)}일 전`;
};

export default function PopupsSection() {
  const [popups, setPopups] = useState<PopupAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<PopupAd> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/popup-ads');
      if (r.ok) {
        const d = await r.json();
        setPopups(d.popups || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing?.title) { setMsg('제목을 입력하세요'); return; }
    setSaving(true);
    try {
      const isNew = !editing.id;
      const body: Record<string, unknown> = {
        action: isNew ? 'create' : 'update',
        ...(isNew ? {} : { id: editing.id }),
        title: editing.title,
        content: editing.content || null,
        image_url: editing.image_url || null,
        link_url: editing.link_url || null,
        link_label: editing.link_label || '자세히 보기',
        position: editing.position || 'center',
        display_type: editing.display_type || 'modal',
        target_pages: editing.target_pages?.length ? editing.target_pages : ['/feed'],
        start_date: editing.start_date ? new Date(editing.start_date).toISOString() : new Date().toISOString(),
        end_date: editing.end_date ? new Date(editing.end_date).toISOString() : null,
        is_active: editing.is_active ?? true,
        priority: editing.priority ?? 0,
        dismiss_duration_hours: editing.dismiss_duration_hours ?? 24,
        max_impressions: editing.max_impressions || null,
      };
      const r = await fetch('/api/admin/popup-ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) {
        setEditing(null);
        setMsg(isNew ? '팝업 생성 완료' : '팝업 수정 완료');
        load();
      } else {
        const d = await r.json();
        setMsg(`오류: ${d.error}`);
      }
    } catch (e: any) { setMsg(`오류: ${e.message}`); }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleToggle = async (id: number) => {
    await fetch('/api/admin/popup-ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle', id }) });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    await fetch('/api/admin/popup-ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) });
    load();
  };

  if (loading) return <Spinner />;

  const typeIcon = (t: string) => t === 'modal' ? '📋' : t === 'banner' ? '🔔' : '💬';
  const typeLabel = (t: string) => t === 'modal' ? '모달' : t === 'banner' ? '배너' : '토스트';

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-md)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>📢 팝업 광고 관리</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textDim }}>모달·배너·토스트 형태의 팝업을 관리합니다</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} style={{
          padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: C.brand, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>+ 새 팝업</button>
      </div>

      {msg && <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: msg.startsWith('오류') ? C.redBg : C.greenBg, color: msg.startsWith('오류') ? C.red : C.green, fontSize: 12, fontWeight: 600, marginBottom: 'var(--sp-sm)' }}>{msg}</div>}

      {/* 편집 폼 */}
      {editing && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 'var(--sp-md)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>{editing.id ? '팝업 수정' : '새 팝업 만들기'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={lbl}>제목 *</label>
              <input value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} style={inp} placeholder="팝업 제목" />
            </div>
            <div>
              <label style={lbl}>링크 URL</label>
              <input value={editing.link_url || ''} onChange={e => setEditing({ ...editing, link_url: e.target.value })} style={inp} placeholder="https:// 또는 /path" />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>내용</label>
            <textarea value={editing.content || ''} onChange={e => setEditing({ ...editing, content: e.target.value })} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="팝업 본문 텍스트" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={lbl}>이미지 URL</label>
              <input value={editing.image_url || ''} onChange={e => setEditing({ ...editing, image_url: e.target.value })} style={inp} placeholder="https://..." />
            </div>
            <div>
              <label style={lbl}>버튼 텍스트</label>
              <input value={editing.link_label || ''} onChange={e => setEditing({ ...editing, link_label: e.target.value })} style={inp} placeholder="자세히 보기" />
            </div>
            <div>
              <label style={lbl}>우선순위</label>
              <input type="number" value={editing.priority ?? 0} onChange={e => setEditing({ ...editing, priority: Number(e.target.value) })} style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={lbl}>유형</label>
              <select value={editing.display_type || 'modal'} onChange={e => setEditing({ ...editing, display_type: e.target.value })} style={inp}>
                <option value="modal">📋 모달 (중앙)</option>
                <option value="banner">🔔 배너 (상단)</option>
                <option value="toast">💬 토스트 (하단)</option>
              </select>
            </div>
            <div>
              <label style={lbl}>닫기 후 재표시 (시간)</label>
              <input type="number" value={editing.dismiss_duration_hours ?? 24} onChange={e => setEditing({ ...editing, dismiss_duration_hours: Number(e.target.value) })} style={inp} />
            </div>
            <div>
              <label style={lbl}>시작일</label>
              <input type="datetime-local" value={(editing.start_date || '').slice(0, 16)} onChange={e => setEditing({ ...editing, start_date: e.target.value })} style={inp} />
            </div>
            <div>
              <label style={lbl}>종료일 (빈칸=무기한)</label>
              <input type="datetime-local" value={(editing.end_date || '').slice(0, 16)} onChange={e => setEditing({ ...editing, end_date: e.target.value || null })} style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={lbl}>대상 페이지 (쉼표 구분)</label>
              <input value={(editing.target_pages || []).join(', ')} onChange={e => setEditing({ ...editing, target_pages: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={inp} placeholder="/feed, /stock, /apt" />
            </div>
            <div>
              <label style={lbl}>최대 노출 수 (빈칸=무제한)</label>
              <input type="number" value={editing.max_impressions ?? ''} onChange={e => setEditing({ ...editing, max_impressions: e.target.value ? Number(e.target.value) : null })} style={inp} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: C.brand, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? '저장 중...' : editing.id ? '수정' : '생성'}
            </button>
            <button onClick={() => setEditing(null)} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, fontSize: 13, cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}

      {/* 팝업 목록 */}
      {popups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.textDim }}>등록된 팝업이 없습니다</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {popups.map(p => {
            const isExpired = p.end_date && new Date(p.end_date) < new Date();
            const isScheduled = new Date(p.start_date) > new Date();
            const ctr = p.current_impressions > 0 ? ((p.click_count / p.current_impressions) * 100).toFixed(1) : '0.0';
            return (
              <div key={p.id} style={{
                background: C.card, border: `1px solid ${p.is_active && !isExpired ? C.brand + '40' : C.border}`,
                borderRadius: 'var(--radius-md)', padding: '14px 16px',
                opacity: isExpired ? 0.5 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{typeIcon(p.display_type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.title}</span>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: p.is_active ? C.greenBg : C.redBg, color: p.is_active ? C.green : C.red, fontWeight: 700 }}>
                        {isExpired ? '만료' : isScheduled ? '예약' : p.is_active ? '활성' : '비활성'}
                      </span>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: C.brandBg, color: C.brand, fontWeight: 600 }}>
                        {typeLabel(p.display_type)}
                      </span>
                    </div>
                    {p.content && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.content}</div>}
                  </div>
                </div>

                {/* KPI */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 8 }}>
                  {[
                    { l: '노출', v: fmt(p.current_impressions), c: C.cyan },
                    { l: '클릭', v: fmt(p.click_count), c: C.green },
                    { l: 'CTR', v: `${ctr}%`, c: Number(ctr) > 2 ? C.green : C.textDim },
                    { l: '대상', v: (p.target_pages || []).join(', ') || '전체', c: C.textSec },
                    { l: '기간', v: isExpired ? '만료' : isScheduled ? `D-${Math.ceil((new Date(p.start_date).getTime() - Date.now()) / 86400000)}` : p.end_date ? `D-${Math.ceil((new Date(p.end_date).getTime() - Date.now()) / 86400000)}` : '무기한', c: C.textSec },
                  ].map(k => (
                    <div key={k.l} style={{ background: C.bg, borderRadius: 'var(--radius-xs)', padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: k.c }}>{k.v}</div>
                      <div style={{ fontSize: 9, color: C.textDim }}>{k.l}</div>
                    </div>
                  ))}
                </div>

                {/* 액션 */}
                <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                  <button onClick={() => setEditing(p)} style={actionBtn}>✏️ 수정</button>
                  <button onClick={() => handleToggle(p.id)} style={actionBtn}>{p.is_active ? '⏸️ 비활성' : '▶️ 활성'}</button>
                  <button onClick={() => handleDelete(p.id)} style={{ ...actionBtn, color: C.red }}>🗑️ 삭제</button>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: C.textDim, alignSelf: 'center' }}>생성: {ago(p.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: C.textDim, marginBottom: 3 };
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-xs)', border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, boxSizing: 'border-box' };
const actionBtn: React.CSSProperties = { padding: '4px 10px', borderRadius: 'var(--radius-xs)', border: `1px solid ${C.border}`, background: 'transparent', color: C.textSec, cursor: 'pointer', fontSize: 11, fontWeight: 600 };
