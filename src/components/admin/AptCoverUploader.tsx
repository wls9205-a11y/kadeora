'use client';

/**
 * v5-V4 — 어드민 조감도 업로드 화면.
 *
 * 흐름: 현장 검색 → 선택 → 허락 출처 입력(필수) → 이미지 선택 → 저장.
 * 저장 시 hero_image_url · hero_image_source='developer' · hero_image_credit 3필드가
 * API 에서 함께 채워진다 (/api/admin/apt-cover).
 *
 * ⚠️ 허락 출처는 여기서도 막고 API 에서도 막는다. 누구에게 어떤 형태로 받았는지가
 *    안 남으면 그게 리스크다. 화면만 막으면 우회된다.
 * ⚠️ 웹 검색 이미지·뉴스 사진·생성 AI 조감도는 넣지 않는다.
 *    (오매칭 실증 — 온천장 엘리시움 페이지에 구미 단지 조감도가 들어간 사고가 있었다.)
 *
 * Rule #14 — 훅은 전부 조기 반환보다 위에서 무조건 호출한다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type Site = {
  id: number;
  slug: string;
  name: string;
  region: string | null;
  sigungu: string | null;
  hero_image_url: string | null;
  hero_image_source: string | null;
  hero_image_credit: string | null;
  satellite_image_url: string | null;
};

const PANEL: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 14,
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  marginBottom: 4,
};

const INPUT: React.CSSProperties = {
  width: '100%',
  minHeight: 40,
  padding: '0 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-base)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
};

export default function AptCoverUploader() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Site[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Site | null>(null);
  const [credit, setCredit] = useState('');
  // M4 §B-2a — 출처 페이지 URL. 크레딧이 '누구' 라면 이건 '어느 페이지' 다.
  // apt_sites.official_url 에 함께 저장한다 — 시공사 페이지 연결이 1건뿐인 게
  // 조감도 수집을 막고 있는 병목이라, 올릴 때 같이 채워 둔다.
  const [officialUrl, setOfficialUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 검색 — 2글자 이상, 300ms 디바운스
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/apt-cover?q=${encodeURIComponent(q.trim())}`);
        const json = await res.json();
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch {
        setItems([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  // 미리보기 objectURL 은 반드시 해제한다 (교체·언마운트 시 누수).
  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = useCallback((s: Site) => {
    setSelected(s);
    setCredit(s.hero_image_credit || '');
    setOfficialUrl((s as { official_url?: string | null }).official_url || '');
    setMsg(null);
    setItems([]);
    setQ('');
  }, []);

  const submit = useCallback(async () => {
    if (!selected) return;
    if (!credit.trim()) {
      setMsg({ kind: 'err', text: '허락 출처를 입력하세요 (필수)' });
      return;
    }
    if (!file) {
      setMsg({ kind: 'err', text: '이미지를 선택하세요' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('slug', selected.slug);
      fd.append('credit', credit.trim());
      if (officialUrl.trim()) fd.append('officialUrl', officialUrl.trim());
      fd.append('file', file);
      const res = await fetch('/api/admin/apt-cover', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: json?.error || '저장 실패' });
        return;
      }
      setMsg({ kind: 'ok', text: `저장 완료 · ${Math.round((json.bytes || 0) / 1024)}KB webp` });
      setSelected({
        ...selected,
        hero_image_url: json.hero_image_url,
        hero_image_source: 'developer',
        hero_image_credit: json.hero_image_credit,
      });
      setFile(null);
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message || '네트워크 오류' });
    } finally {
      setBusy(false);
    }
  }, [selected, credit, officialUrl, file]);

  const removeCover = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/apt-cover', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: selected.slug }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: json?.error || '삭제 실패' });
        return;
      }
      setMsg({ kind: 'ok', text: '조감도를 내렸습니다' });
      setSelected({ ...selected, hero_image_url: null, hero_image_source: null, hero_image_credit: null });
      setCredit('');
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message || '네트워크 오류' });
    } finally {
      setBusy(false);
    }
  }, [selected]);

  return (
    <section style={{ ...PANEL, marginTop: 16 }} aria-label="조감도 업로드">
      <h2 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
        조감도 업로드
      </h2>
      <p style={{ margin: '0 0 12px', fontSize: 11.5, lineHeight: 1.6, color: 'var(--text-tertiary)' }}>
        시행사·시공사에게 받은 조감도만 올립니다. 저장하면 상세 히어로 1순위와 큐레이션 캐러셀
        대형 노출에 바로 쓰입니다 (2순위 위성 · 3순위 이니셜 블록).
        <br />
        웹 검색 이미지 · 뉴스 사진 · 생성 AI 조감도는 올리지 마세요.
      </p>

      {/* 검색 */}
      <label style={LABEL} htmlFor="kd-cover-q">현장 검색 (단지명 또는 slug)</label>
      <input
        id="kd-cover-q"
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="예: 엄궁역 트라비스"
        style={INPUT}
      />
      {searching && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '6px 0 0' }}>검색 중…</p>}

      {items.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', maxHeight: 260, overflowY: 'auto' }}>
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  minHeight: 44, padding: '6px 10px', border: 'none',
                  borderBottom: '1px solid var(--border)', background: 'transparent',
                  textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </span>
                  <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[s.region, s.sigungu].filter(Boolean).join(' ')} · {s.slug}
                  </span>
                </span>
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: s.hero_image_url ? 'var(--accent-green)' : 'var(--text-tertiary)' }}>
                  {s.hero_image_url ? '조감도 있음' : s.satellite_image_url ? '위성만' : '이미지 없음'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 선택된 현장 */}
      {selected && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {selected.name}
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>{selected.slug}</span>
          </p>

          {selected.hero_image_url && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ ...LABEL, marginBottom: 6 }}>현재 조감도</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.hero_image_url}
                alt=""
                style={{ width: '100%', maxWidth: 360, borderRadius: 'var(--radius-sm)', display: 'block' }}
              />
              <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                출처: {selected.hero_image_credit || '(없음)'}
              </p>
              <button
                type="button"
                onClick={removeCover}
                disabled={busy}
                style={{
                  marginTop: 8, minHeight: 36, padding: '0 12px',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                  background: 'var(--bg-base)', color: 'var(--accent-red)',
                  fontSize: 12, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                조감도 내리기
              </button>
            </div>
          )}

          <label style={LABEL} htmlFor="kd-cover-credit">
            허락 출처 (필수) — 누구에게 어떤 형태로 받았는지
          </label>
          <input
            id="kd-cover-credit"
            type="text"
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            placeholder="예: 대우건설 분양홍보팀 · 2026-08-20 메일 서면 허락"
            style={INPUT}
          />
          <p style={{ margin: '4px 0 12px', fontSize: 10.5, color: 'var(--text-tertiary)' }}>
            이 문구가 상세 페이지 이미지 하단에 출처로 표시됩니다.
          </p>

          <label style={LABEL} htmlFor="kd-cover-official">
            출처 페이지 URL (선택) — 어디서 받았는지
          </label>
          <input
            id="kd-cover-official"
            type="url"
            value={officialUrl}
            onChange={(e) => setOfficialUrl(e.target.value)}
            placeholder="예: https://www.ihanulche.co.kr/sale/view/1083"
            style={INPUT}
          />
          <p style={{ margin: '4px 0 12px', fontSize: 10.5, color: 'var(--text-tertiary)' }}>
            apt_sites.official_url 에 함께 저장됩니다. 나중에 「이 사진 어디서 왔냐」에 답할 근거입니다.
          </p>

          <label style={LABEL} htmlFor="kd-cover-file">이미지 (JPG · PNG · WEBP)</label>
          <input
            id="kd-cover-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ ...INPUT, paddingTop: 8 }}
          />
          <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--text-tertiary)' }}>
            원본 그대로 올리세요. 서버가 1600px webp 로 변환해 저장합니다 (버킷 한도 2MB).
          </p>

          {preview && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={preview}
              alt=""
              style={{ width: '100%', maxWidth: 360, marginTop: 10, borderRadius: 'var(--radius-sm)', display: 'block' }}
            />
          )}

          <button
            type="button"
            onClick={submit}
            disabled={busy || !credit.trim() || !file}
            style={{
              marginTop: 12, minHeight: 44, padding: '0 18px',
              borderRadius: 'var(--radius-sm)', border: 'none',
              background: busy || !credit.trim() || !file ? 'var(--bg-sunken)' : 'var(--brand)',
              color: busy || !credit.trim() || !file ? 'var(--text-tertiary)' : '#FFFFFF',
              fontSize: 13.5, fontWeight: 700,
              cursor: busy || !credit.trim() || !file ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? '저장 중…' : '조감도 저장'}
          </button>
        </div>
      )}

      {msg && (
        <p
          role="status"
          style={{
            margin: '10px 0 0',
            fontSize: 12,
            fontWeight: 600,
            color: msg.kind === 'ok' ? 'var(--accent-green)' : 'var(--accent-red)',
          }}
        >
          {msg.text}
        </p>
      )}
    </section>
  );
}
