'use client';
import { useState } from 'react';
import Link from 'next/link';
import SectionShareButton from '@/components/SectionShareButton';

const CUTLINES: { region: string; avg: number; min: number; max: number }[] = [
  { region: '서울', avg: 62, min: 55, max: 72 },
  { region: '경기', avg: 56, min: 48, max: 67 },
  { region: '인천', avg: 50, min: 40, max: 60 },
  { region: '부산', avg: 48, min: 38, max: 58 },
  { region: '대구', avg: 45, min: 35, max: 55 },
  { region: '대전', avg: 44, min: 34, max: 54 },
  { region: '광주', avg: 42, min: 32, max: 52 },
  { region: '울산', avg: 40, min: 30, max: 50 },
  { region: '세종', avg: 52, min: 42, max: 62 },
  { region: '강원', avg: 35, min: 25, max: 45 },
  { region: '충북', avg: 36, min: 26, max: 46 },
  { region: '충남', avg: 38, min: 28, max: 48 },
  { region: '전북', avg: 34, min: 24, max: 44 },
  { region: '전남', avg: 32, min: 22, max: 42 },
  { region: '경북', avg: 36, min: 26, max: 46 },
  { region: '경남', avg: 38, min: 28, max: 48 },
  { region: '제주', avg: 40, min: 30, max: 50 },
];

export default function DiagnosePage() {
  const [years, setYears] = useState(5);
  const [family, setFamily] = useState(2);
  const [bankYears, setBankYears] = useState(5);

  const housingScore = Math.min(32, years * 2);
  const familyScore = Math.min(35, family * 5);
  const bankScore = Math.min(17, bankYears <= 0 ? 0 : bankYears < 1 ? 2 : bankYears < 2 ? 4 : bankYears < 3 ? 6 : bankYears < 4 ? 8 : bankYears < 5 ? 10 : bankYears < 6 ? 11 : bankYears < 7 ? 12 : bankYears < 8 ? 13 : bankYears < 9 ? 14 : bankYears < 10 ? 15 : bankYears < 11 ? 16 : 17);
  const total = housingScore + familyScore + bankScore;
  const pct = Math.round((total / 84) * 100);
  const grade = total >= 51 ? { label: '높음', color: 'var(--accent-green)', emoji: '🟢' }
    : total >= 31 ? { label: '보통', color: 'var(--accent-yellow)', emoji: '🟡' }
    : { label: '낮음', color: 'var(--accent-red)', emoji: '🔴' };

  const strategy = total >= 55
    ? { type: '가점제', desc: '서울·수도권 인기 단지에서도 가점제로 당첨 가능성이 높습니다. 1순위 가점제에 집중하세요.' }
    : total >= 40
    ? { type: '가점+추첨 병행', desc: '수도권 외곽이나 지방 광역시에서는 가점제, 인기 단지에서는 추첨제(85㎡ 초과)를 노려보세요.' }
    : total >= 25
    ? { type: '추첨제 위주', desc: '가점이 낮아 가점제 당첨은 어렵습니다. 85㎡ 초과 추첨제나 신혼특공·생애최초특공을 추천합니다.' }
    : { type: '특별공급 집중', desc: '신혼부부·생애최초·다자녀 특별공급 자격을 먼저 확인하세요. 일반공급보다 유리할 수 있습니다.' };

  const possibleRegions = CUTLINES.filter(c => total >= c.min).sort((a, b) => a.avg - b.avg);
  const hardRegions = CUTLINES.filter(c => total < c.min);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <div style={{ marginBottom: 'var(--sp-xl)' }}>
        <Link href="/apt" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 청약 목록</Link>
        <h1 style={{ margin: '8px 0 0', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>🎯 청약 가점 진단</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>내 가점을 계산하고 당첨 전략을 확인하세요 (만점 84점)</p>
        <div style={{ marginTop: 8 }}><SectionShareButton section="apt-diagnose" label="청약 가점 진단 — 내 가점은 몇 점?" pagePath="/apt/diagnose" /></div>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, marginBottom: 'var(--sp-lg)' }}>
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-sm)' }}>무주택기간 (만점 32점)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
            <input type="range" min={0} max={15} value={years} onChange={e => setYears(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--brand)' }} />
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', minWidth: 50 }}>{years}년</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--brand)', fontWeight: 600 }}>{housingScore}점</span>
          </div>
        </div>
        <div style={{ marginBottom: 'var(--sp-xl)' }}>
          <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-sm)' }}>부양가족 수 (만점 35점)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2, 3, 4, 5, 6].map(n => (
              <button key={n} onClick={() => setFamily(n)} style={{
                flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                background: family === n ? 'var(--brand)' : 'var(--bg-hover)',
                color: family === n ? 'var(--text-inverse)' : 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600,
              }}>{n}명</button>
            ))}
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--brand)', fontWeight: 600, textAlign: 'right', marginTop: 'var(--sp-xs)' }}>{familyScore}점</div>
        </div>
        <div>
          <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-sm)' }}>청약통장 가입기간 (만점 17점)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
            <input type="range" min={0} max={15} value={bankYears} onChange={e => setBankYears(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--brand)' }} />
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', minWidth: 50 }}>{bankYears}년</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--brand)', fontWeight: 600 }}>{bankScore}점</span>
          </div>
        </div>
      </div>

      {/* 결과 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 24, textAlign: 'center', marginBottom: 'var(--sp-lg)' }}>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-sm)' }}>내 청약 가점</div>
        <div style={{ fontSize: 48, fontWeight: 900, color: grade.color }}>{total}<span style={{ fontSize: 'var(--fs-xl)' }}>점</span></div>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: grade.color, marginBottom: 14 }}>{grade.emoji} {grade.label} (상위 {Math.max(1, 100 - pct)}%)</div>
        <div style={{ position: 'relative', height: 12, background: 'var(--bg-hover)', borderRadius: 'var(--radius-xs)', overflow: 'hidden', marginBottom: 'var(--sp-lg)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, var(--accent-blue), ${grade.color})`, borderRadius: 'var(--radius-xs)', transition: 'width 0.3s' }} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>무주택 {housingScore}/32</div>
          <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>부양가족 {familyScore}/35</div>
          <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>통장 {bankScore}/17</div>
        </div>
      </div>

      {/* 전략 추천 */}
      <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-card)', padding: 20, marginBottom: 'var(--sp-lg)' }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>📋 추천 전략: {strategy.type}</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{strategy.desc}</div>
      </div>

      {/* 지역별 커트라인 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, marginBottom: 'var(--sp-lg)' }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-xs)' }}>📊 지역별 커트라인 비교</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}>최근 청약 실적 기반 추정치 · 단지별로 차이가 클 수 있습니다</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
          {CUTLINES.map(c => {
            const canWin = total >= c.avg;
            const possible = total >= c.min;
            return (
              <div key={c.region} style={{
                padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                background: canWin ? 'rgba(52,211,153,0.06)' : possible ? 'rgba(251,191,36,0.06)' : 'var(--bg-hover)',
                border: `1px solid ${canWin ? 'rgba(52,211,153,0.2)' : possible ? 'rgba(251,191,36,0.2)' : 'var(--border)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-xs)' }}>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{c.region}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: canWin ? 'var(--accent-green)' : possible ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
                    {canWin ? '✅ 유리' : possible ? '⚠️ 가능' : '❌ 어려움'}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>평균 {c.avg}점 ({c.min}~{c.max})</div>
                <div style={{ position: 'relative', height: 4, background: 'var(--bg-hover)', borderRadius: 2, marginTop: 6 }}>
                  <div style={{ position: 'absolute', left: `${Math.min(100, Math.max(0, ((total - c.min) / (c.max - c.min)) * 100))}%`, top: -2, width: 8, height: 8, borderRadius: '50%', background: canWin ? 'var(--accent-green)' : 'var(--accent-red)', transform: 'translateX(-50%)' }} />
                </div>
              </div>
            );
          })}
        </div>
        {possibleRegions.length > 0 && (
          <div style={{ marginTop: 'var(--sp-md)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
            🎯 당첨 가능 지역: <strong style={{ color: 'var(--text-primary)' }}>{possibleRegions.map(r => r.region).join(', ')}</strong>
            {hardRegions.length > 0 && <span> · 도전 필요: {hardRegions.map(r => r.region).join(', ')}</span>}
          </div>
        )}
      </div>

      {/* 노릴 수 있는 청약 */}
      {total > 0 && (
        <div style={{ marginTop: 'var(--sp-lg)', padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', marginBottom: 'var(--sp-lg)' }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🎯 내 가점으로 노릴 수 있는 청약</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CUTLINES.filter(c => total >= c.avg).map(c => (
              <Link key={c.region} href={`/apt?tab=sub`} style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: 12, fontWeight: 600,
                background: total >= c.max ? 'rgba(52,211,153,0.1)' : total >= c.avg ? 'rgba(96,165,250,0.1)' : 'var(--bg-hover)',
                color: total >= c.max ? 'var(--accent-green)' : total >= c.avg ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                border: `1px solid ${total >= c.max ? 'rgba(52,211,153,0.3)' : total >= c.avg ? 'rgba(96,165,250,0.3)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)',
              }}>
                {c.region}
                <span style={{ fontSize: 10, opacity: 0.7 }}>{total >= c.max ? '높음' : '보통'}</span>
              </Link>
            ))}
          </div>
          {CUTLINES.filter(c => total >= c.avg).length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 8 }}>가점을 더 쌓으면 더 많은 지역에 도전할 수 있어요</div>
          )}
        </div>
      )}

      {/* 팁 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, marginBottom: 'var(--sp-lg)' }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-md)' }}>💡 가점 올리는 팁</div>
        {[
          { condition: housingScore < 32, tip: `무주택기간을 늘리세요. 현재 ${years}년 → ${Math.min(15, years + 3)}년이면 +${Math.min(32, (years + 3) * 2) - housingScore}점 추가` },
          { condition: familyScore < 35, tip: '부양가족 등록을 확인하세요. 배우자 포함 직계 존비속이 모두 무주택이면 가족 수에 포함됩니다' },
          { condition: bankScore < 17, tip: `청약통장은 유지만 하면 기간이 늘어납니다. ${15 - bankYears}년 후 만점(17점)` },
          { condition: total < 40, tip: '85㎡ 초과 주택은 추첨제 40%가 적용되므로 가점 낮아도 당첨 가능성이 있습니다' },
          { condition: true, tip: '신혼부부·생애최초 특별공급은 가점과 무관하게 소득·자산 기준으로 선정됩니다' },
        ].filter(t => t.condition).slice(0, 4).map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-sm)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <span style={{ flexShrink: 0 }}>•</span>
            <span>{t.tip}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-2xl)' }}>
        <Link href="/apt" style={{ flex: 1, display: 'block', textAlign: 'center', padding: '12px 0', background: 'var(--brand)', color: 'var(--text-inverse)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)', fontWeight: 700, textDecoration: 'none' }}>
          청약 일정 보러가기 →
        </Link>
        <Link href="/apt?tab=ongoing" style={{ flex: 1, display: 'block', textAlign: 'center', padding: '12px 0', background: 'var(--bg-surface)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)', fontWeight: 700, textDecoration: 'none', border: '1px solid var(--border)' }}>
          분양중 현장 보기
        </Link>
      </div>
    </div>
  );
}
