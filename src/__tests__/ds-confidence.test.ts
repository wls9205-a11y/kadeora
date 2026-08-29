// DS-2 — 검증 뱃지 어휘 자물쇠.
//
// ⚠️ 이 파일이 지키는 것 셋:
//   1. 확신도 어휘가 «DB 제약과 같다» — rumor·estimated·confirmed·verified.
//      DB 원본: apt_permits_match_confidence_chk (PV-1 마이그레이션).
//      어휘가 갈리면 apt-permits.ts 가 경고한 「두 벌을 만들지 않는다」가 깨진다.
//   2. «모르는 값» 은 전부 「미확인」으로 떨어진다 — 확정처럼 보이지 않는다.
//      ⚠️ 단, `conflicting` 은 «모르는 값이 아니다» — D6 이 정의한 확신도다.
//         DS-2a 에서 그것을 「검수 큐 이름」으로 오판했고 U-1a 에서 정정했다.
//   3. null 을 확정으로 치지 않는다 — ad-safety.isConfirmed(null)=false 와 같은 선이다.

import { describe, it, expect } from 'vitest';
import { CONFIDENCE, CONFIDENCE_UNKNOWN, confidenceMeta, TONE } from '@/components/ds/tone';

// ⚠️ 설계(D6)와 구현(DB 제약)이 갈려 있어 «합집합» 을 지원한다 — tone.ts 주석 참조.
//    D6:  verified · estimated · conflicting · rumor
//    구현: verified · estimated · confirmed   · rumor
const DB_VOCAB = ['rumor', 'estimated', 'conflicting', 'confirmed', 'verified'] as const;

describe('D6 확신도 어휘', () => {
  it('설계(D6) ∪ 구현 의 5값을 전부 안다', () => {
    expect(Object.keys(CONFIDENCE).sort()).toEqual([...DB_VOCAB].sort());
  });

  it('네 값 모두 라벨과 설명을 가진다 — 색만으로 의미를 전달하지 않는다', () => {
    for (const c of DB_VOCAB) {
      expect(CONFIDENCE[c].label.length).toBeGreaterThan(0);
      expect(CONFIDENCE[c].hint.length).toBeGreaterThan(0);
    }
  });

  it('모든 톤이 TONE 표에 실재한다 — 없는 톤을 가리키면 배지가 무색으로 렌더된다', () => {
    for (const c of DB_VOCAB) expect(TONE[CONFIDENCE[c].tone]).toBeDefined();
    expect(TONE[CONFIDENCE_UNKNOWN.tone]).toBeDefined();
  });
});

describe('미지값 fallback', () => {
  it('null · undefined · 빈 문자열은 「미확인」이다', () => {
    for (const v of [null, undefined, '']) {
      expect(confidenceMeta(v)).toBe(CONFIDENCE_UNKNOWN);
    }
  });

  it('`conflicting` 은 «확신도가 맞다» — 「출처 충돌」로 뜬다', () => {
    // ⚠️ DS-2a 에서 「검수 큐 이름」으로 오판했다. PV_INSTRUCTION §D6 이 확신도로 정의한다.
    //    값이 없는 게 아니라 «서로 다른 값이 둘 이상» 이라 하나를 고르면 거짓이 된다.
    const m = confidenceMeta('conflicting');
    expect(m).not.toBe(CONFIDENCE_UNKNOWN);
    expect(m.label).toBe('출처 충돌');
    expect(m.tone).toBe('error');
  });

  it('모르는 값은 무엇이든 「미확인」이다 (확정처럼 보이지 않는다)', () => {
    for (const v of ['CONFIRMED', 'confirmed ', 'pending', 'matched', 'review', 'no_target', 'true', '1']) {
      expect(confidenceMeta(v)).toBe(CONFIDENCE_UNKNOWN);
    }
  });

  it('「미확인」은 확정 계열 톤을 쓰지 않는다', () => {
    // 등급을 모르는 것과 확인한 것은 다르다. 성공/정보 톤으로 칠하면 읽는 사람이 확정으로 읽는다.
    expect(['success', 'info']).not.toContain(CONFIDENCE_UNKNOWN.tone);
  });
});

describe('톤 표', () => {
  it('hex 를 직접 들지 않는다 — 토큰 이름만 있다', () => {
    for (const t of Object.values(TONE)) {
      for (const v of [t.fg, t.bg, t.on, t.border].filter(Boolean) as string[]) {
        expect(v.startsWith('--')).toBe(true);
        expect(v).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      }
    }
  });

  it('모든 톤이 «얹히는 바탕»(on)을 선언한다 — 합성 대비를 잴 수 없으면 판정도 못 한다', () => {
    for (const t of Object.values(TONE)) expect(t.on).toBeTruthy();
  });
});
