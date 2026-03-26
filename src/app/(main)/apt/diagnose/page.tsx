'use client';
import { useState } from 'react';
import Link from 'next/link';


export default function DiagnosePage() {
  const [years, setYears] = useState(5);
  const [family, setFamily] = useState(2);
  const [bankYears, setBankYears] = useState(5);

  const housingScore = Math.min(32, years * 2);
  const familyScore = Math.min(35, family * 5);
  const bankScore = Math.min(17, bankYears <= 0 ? 0 : bankYears < 1 ? 2 : bankYears < 2 ? 4 : bankYears < 3 ? 6 : bankYears < 4 ? 8 : bankYears < 5 ? 10 : bankYears < 6 ? 11 : bankYears < 7 ? 12 : bankYears < 8 ? 13 : bankYears < 9 ? 14 : bankYears < 10 ? 15 : bankYears < 11 ? 16 : 17);
  const total = housingScore + familyScore + bankScore;
  const grade = total >= 51 ? { label: '높음', color: 'var(--success)' } : total >= 31 ? { label: '보통', color: 'var(--warning)' } : { label: '낮음', color: 'var(--error)' };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/apt" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 청약 목록</Link>
        <h1 style={{ margin: '8px 0 0', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>🎯 청약 가점 진단</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>내 가점을 계산해보세요 (만점 84점)</p>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>무주택기간 (만점 32점)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="range" min={0} max={15} value={years} onChange={e => setYears(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--brand)' }} />
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', minWidth: 50 }}>{years}년</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--brand)', fontWeight: 600 }}>{housingScore}점</span>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>부양가족 수 (만점 35점)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 1, 2, 3, 4, 5, 6].map(n => (
              <button key={n} onClick={() => setFamily(n)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: family === n ? 'var(--brand)' : 'var(--bg-hover)',
                color: family === n ? 'var(--text-inverse)' : 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600,
              }}>{n}명</button>
            ))}
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--brand)', fontWeight: 600, textAlign: 'right', marginTop: 4 }}>{familyScore}점</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>청약통장 가입기간 (만점 17점)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="range" min={0} max={15} value={bankYears} onChange={e => setBankYears(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--brand)' }} />
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', minWidth: 50 }}>{bankYears}년</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--brand)', fontWeight: 600 }}>{bankScore}점</span>
          </div>
        </div>
      </div>

      {/* 결과 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 8 }}>내 청약 가점</div>
        <div style={{ fontSize: 48, fontWeight: 900, color: grade.color }}>{total}<span style={{ fontSize: 'var(--fs-xl)' }}>점</span></div>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: grade.color, marginBottom: 16 }}>{grade.label}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 16px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>무주택 {housingScore}점</div>
          <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 16px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>부양가족 {familyScore}점</div>
          <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 16px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>통장 {bankScore}점</div>
        </div>
        <Link href="/apt" style={{ display: 'inline-block', marginTop: 16, padding: '10px 24px', background: 'var(--brand)', color: 'var(--text-inverse)', borderRadius: 10, fontSize: 'var(--fs-base)', fontWeight: 700, textDecoration: 'none' }}>
          청약 일정 보러가기 →
        </Link>
      </div>
    </div>
  );
}
