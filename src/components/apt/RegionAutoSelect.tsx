'use client';

// v4-C3: 자동 전환 → 제안으로 강등.
//
// 이전에는 localStorage 값으로 router.replace('/apt?region=…') 를 실행했다.
// 사용자가 아무것도 고르지 않았는데 목록이 바뀌고 URL 까지 바뀐다 —
// URL 을 말없이 바꾸는 것과 제안하는 것은 체감이 완전히 다르다.
// 이제 칩 줄 위에 한 줄 배너만 내고, 전환은 사용자가 누를 때만 일어난다.
//
// ⚠️ Rule #14 — 훅은 조기 반환보다 위에서 무조건 호출한다.
//    localStorage 는 마운트 뒤에 읽는다 (SSR 과 값이 달라 hydration 이 깨진다).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getStoredRegion } from '@/lib/region-storage';
import { isValidKrRegion } from '@/lib/region-detection';

/**
 * 한글 조사 선택. 시·도 17개가 받침 유무로 갈린다 —
 * '경기으로 보기' 나 '서울으로 보기' 가 나오면 안 된다.
 * 종성 인덱스 0 = 받침 없음, 8 = ㄹ (ㄹ 받침은 '로' 를 쓴다).
 */
function jongseong(word: string): number | null {
  const c = word.charCodeAt(word.length - 1);
  if (Number.isNaN(c) || c < 0xac00 || c > 0xd7a3) return null;
  return (c - 0xac00) % 28;
}
function eulReul(word: string): string {
  const j = jongseong(word);
  return j === null || j === 0 ? '를' : '을';
}
function euroRo(word: string): string {
  const j = jongseong(word);
  return j === null || j === 0 || j === 8 ? '로' : '으로';
}

export default function RegionAutoSelect() {
  const sp = useSearchParams();
  const [suggested, setSuggested] = useState<string | null>(null);

  useEffect(() => {
    if (sp.get('region')) {
      setSuggested(null);
      return;
    }
    const region = getStoredRegion()?.region ?? null;
    if (!region || !isValidKrRegion(region) || region === '전국') {
      setSuggested(null);
      return;
    }
    setSuggested(region);
  }, [sp]);

  if (!suggested) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '0 6px 8px',
        padding: '7px 10px',
        borderRadius: 8,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
        이전에 {suggested}{eulReul(suggested)} 보셨습니다
      </span>
      <Link
        href={`/apt?region=${encodeURIComponent(suggested)}`}
        scroll={false}
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: 32,
          padding: '0 12px',
          borderRadius: 'var(--radius-pill)',
          background: 'var(--brand)',
          color: '#FFFFFF',
          fontSize: 'var(--fs-xs)',
          fontWeight: 500,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {suggested}{euroRo(suggested)} 보기
      </Link>
    </div>
  );
}
