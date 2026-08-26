'use client';

// V16 D — 어드민 한 줄 입력 화면.
//
// 총회장에서 폰으로 30초 안에 끝나야 한다: 현장 검색 → 단계 → 한 줄 메모 → 등급 → 저장.
// 그래서 한 화면에 전부 둔다. 단계를 고르는 순간 저장 버튼이 살아난다.
//
// ⚠️ 터치 타깃은 44px 이상. 한 손으로 서서 누른다.
// ⚠️ 등급은 기본값을 주지 않는다 — 아무거나 눌러 넘어가면 전부 '확정' 이 된다.

import { useCallback, useEffect, useRef, useState } from 'react';

type Site = {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  sigungu: string | null;
  dong: string | null;
  builder: string | null;
  lifecycle_stage: string | null;
  stage_label: string | null;
  stage_locked: boolean | null;
  confidence: string | null;
};

const STAGES: Array<{ key: string; label: string }> = [
  { key: 'union_established', label: '조합설립' },
  { key: 'constructor_selected', label: '시공사 선정' },
  { key: 'plan_approved', label: '사업시행인가' },
  { key: 'mgmt_approved', label: '관리처분인가' },
  { key: 'construction', label: '착공' },
  { key: 'site_planning', label: '부지계획' },
  { key: 'pre_announcement', label: '분양 예고' },
];

const CONFIDENCES: Array<{ key: string; label: string; hint: string }> = [
  { key: 'confirmed', label: '확정', hint: '고시·공시 원문을 봤다' },
  { key: 'estimated', label: '추정', hint: '복수 언론' },
  { key: 'rumor', label: '카더라', hint: '업계·조합 전언' },
];

const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

const chip = (active: boolean): React.CSSProperties => ({
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 999,
  border: `1px solid ${active ? 'var(--brand)' : 'var(--border)'}`,
  background: active ? 'var(--brand)' : 'var(--bg-surface)',
  color: active ? '#FFFFFF' : 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: active ? 600 : 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

const field: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontSize: 15,
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '.02em',
  color: 'var(--text-tertiary)',
  margin: '0 0 6px',
};

export default function StageInputClient() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Site[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Site | null>(null);

  // 신규 생성 입력
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [region, setRegion] = useState('부산');
  const [sigungu, setSigungu] = useState('');

  const [stage, setStage] = useState('');
  const [confidence, setConfidence] = useState('');
  const [note, setNote] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [locked, setLocked] = useState(true);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/admin/apt-stage?q=${encodeURIComponent(q.trim())}`);
        const j = await r.json();
        setResults(Array.isArray(j.items) ? j.items : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  const reset = useCallback(() => {
    setPicked(null);
    setCreating(false);
    setNewName('');
    setSigungu('');
    setStage('');
    setConfidence('');
    setNote('');
    setSourceUrl('');
    setLocked(true);
    setQ('');
    setResults([]);
  }, []);

  const canSave = !!stage && !!confidence && (picked || (creating && newName.trim().length >= 2));

  async function save() {
    if (!canSave || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        stage,
        confidence,
        note: note.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        stageLocked: locked,
      };
      if (picked) body.slug = picked.slug;
      else {
        body.name = newName.trim();
        body.region = region;
        if (sigungu.trim()) body.sigungu = sigungu.trim();
      }

      const r = await fetch('/api/admin/apt-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setMsg({ tone: 'err', text: `저장 실패 — ${j.error ?? r.status}${j.hint ? ` (${j.hint})` : ''}` });
        return;
      }
      setMsg({
        tone: 'ok',
        text: `${j.created ? '생성' : '갱신'} 완료 — ${j.site?.name ?? ''}${j.stageChanged === false ? ' (단계 동일, 메모만)' : ''}`,
      });
      reset();
    } catch (e: any) {
      setMsg({ tone: 'err', text: `저장 실패 — ${e?.message ?? '네트워크'}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 14px 64px' }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary)' }}>
        현장 단계 한 줄 입력
      </h1>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-tertiary)', margin: '0 0 18px' }}>
        저장하면 진행 이력에 자동으로 남고 색인 핑이 나갑니다. 등급은 화면에 그대로 표시됩니다.
      </p>

      {msg && (
        <p
          role="status"
          style={{
            margin: '0 0 14px',
            padding: '10px 12px',
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.5,
            background: msg.tone === 'ok' ? 'var(--accent-green-bg)' : 'var(--accent-red-bg)',
            color: msg.tone === 'ok' ? 'var(--accent-green)' : 'var(--accent-red)',
          }}
        >
          {msg.text}
        </p>
      )}

      {/* ① 현장 */}
      <section style={{ marginBottom: 18 }}>
        <span style={label}>① 현장</span>

        {picked ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--brand)',
              background: 'var(--brand-bg)',
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {picked.name}
              </span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {[picked.region, picked.sigungu, picked.dong].filter(Boolean).join(' ')}
                {picked.stage_label ? ` · 현재 ${picked.stage_label}` : ''}
                {picked.stage_locked ? ' · 잠금' : ''}
              </span>
            </span>
            <button type="button" onClick={reset} style={{ ...chip(false), minHeight: 36, padding: '0 10px' }}>
              변경
            </button>
          </div>
        ) : creating ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="현장 이름 (예: 거제역 동원로얄듀크)"
              style={field}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={region} onChange={(e) => setRegion(e.target.value)} style={{ ...field, width: 110 }}>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <input
                value={sigungu}
                onChange={(e) => setSigungu(e.target.value)}
                placeholder="시군구 (선택)"
                style={field}
              />
            </div>
            <button type="button" onClick={() => setCreating(false)} style={{ ...chip(false), alignSelf: 'start' }}>
              ← 기존 현장 검색으로
            </button>
          </div>
        ) : (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="현장 이름 또는 slug (2자 이상)"
              style={field}
              autoComplete="off"
            />
            <div style={{ marginTop: 8 }}>
              {searching && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>검색 중…</p>}
              {!searching && q.trim().length >= 2 && results.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>결과 없음</p>
              )}
              {results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setPicked(s);
                    setResults([]);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    minHeight: 48,
                    padding: '8px 10px',
                    border: 0,
                    borderBottom: '1px solid var(--border)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {s.name}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {[s.region, s.sigungu].filter(Boolean).join(' ')}
                    {s.stage_label ? ` · ${s.stage_label}` : ''}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setNewName(q.trim());
                }}
                style={{ ...chip(false), marginTop: 10 }}
              >
                + 없는 현장이면 새로 만들기
              </button>
            </div>
          </>
        )}
      </section>

      {/* ② 단계 */}
      <section style={{ marginBottom: 18 }}>
        <span style={label}>② 단계</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STAGES.map((s) => (
            <button key={s.key} type="button" onClick={() => setStage(s.key)} style={chip(stage === s.key)}>
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* ③ 한 줄 메모 */}
      <section style={{ marginBottom: 18 }}>
        <span style={label}>③ 한 줄 메모 (선택)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="예: 총회에서 시공사 코오롱글로벌 선정, 세대수 2,600 → 2,480"
          style={field}
        />
        <input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="출처 링크 (선택)"
          style={{ ...field, marginTop: 8 }}
        />
      </section>

      {/* ④ 등급 */}
      <section style={{ marginBottom: 18 }}>
        <span style={label}>④ 등급 (필수)</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CONFIDENCES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setConfidence(c.key)}
              title={c.hint}
              style={chip(confidence === c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-tertiary)', margin: '6px 0 0' }}>
          {confidence
            ? CONFIDENCES.find((c) => c.key === confidence)?.hint
            : '확정은 고시·공시 원문, 추정은 복수 언론, 카더라는 업계·조합 전언입니다.'}
        </p>
      </section>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 13, color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} style={{ width: 18, height: 18 }} />
        단계 잠금 — 크론이 덮어쓰지 않습니다
      </label>

      <button
        type="button"
        onClick={save}
        disabled={!canSave || busy}
        style={{
          width: '100%',
          minHeight: 52,
          marginTop: 12,
          borderRadius: 10,
          border: 0,
          background: canSave && !busy ? 'var(--brand)' : 'var(--bg-elevated)',
          color: canSave && !busy ? '#FFFFFF' : 'var(--text-tertiary)',
          fontSize: 15,
          fontWeight: 500,
          cursor: canSave && !busy ? 'pointer' : 'not-allowed',
        }}
      >
        {busy ? '저장 중…' : picked ? '갱신' : '생성'}
      </button>
    </div>
  );
}
