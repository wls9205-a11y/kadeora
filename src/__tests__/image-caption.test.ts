// I-3 자물쇠 — 이미지의 «성격» 을 거짓으로 말하지 않는다.
//
// ⚠️ 두 방향 모두 거짓이다: 조감도를 사진처럼 두는 것 · 사진을 조감도라 단정하는 것.
//    스키마에 종류 필드가 «없으므로» 종류를 단정하지 않고 면책만 붙인다.

import { describe, it, expect } from 'vitest';
import { heroImageCaption } from '@/lib/apt/image-caption';

const OPTS = { name: '대연 푸르지오', region: '부산' };

describe('성격 라벨', () => {
  it('위성사진은 「위성사진」이라 말하고 VWorld 출처를 유지한다', () => {
    const c = heroImageCaption('satellite', OPTS);
    expect(c.credit).toContain('위성사진');
    expect(c.credit).toContain('VWorld');
    expect(c.alt).toContain('위성사진');
  });

  it('시행사 이미지는 「제공」 + 면책이 «항상» 함께 간다', () => {
    const c = heroImageCaption('developer', OPTS);
    expect(c.credit).toContain('제공');
    expect(c.credit).toContain('실제와 다를 수 있음');
  });

  it('제공자 이름이 있으면 밝히고, 없으면 「시행사 제공」까지만', () => {
    expect(heroImageCaption('developer', { ...OPTS, developerCredit: '대우건설' }).credit).toContain('대우건설 제공');
    expect(heroImageCaption('developer', OPTS).credit).toContain('시행사 제공');
  });

  it('⛔ 종류를 «단정하지 않는다» — 조감도라 말할 근거가 스키마에 없다', () => {
    // 종류 필드가 생기기 전까지 「조감도」라고 쓰면 사진일 때 거짓이 된다.
    const c = heroImageCaption('developer', OPTS);
    expect(c.credit).not.toContain('조감도');
    expect(c.alt).not.toContain('조감도');
  });

  it('생성 카드는 출처 줄을 만들지 않는다 — 우리가 찍은 사진처럼 읽히면 안 된다', () => {
    const c = heroImageCaption('card', OPTS);
    expect(c.credit).toBeNull();
    expect(c.alt).toContain('분양 정보 카드');
  });
});

describe('alt 는 화면 라벨과 «같은 말» 이다 (I-3)', () => {
  it('위성사진·시행사 제공 모두 alt 에 성격이 들어간다', () => {
    expect(heroImageCaption('satellite', OPTS).alt).toContain('위성사진');
    expect(heroImageCaption('developer', OPTS).alt).toContain('제공');
  });

  it('alt 는 비지 않는다 — 빈 alt 는 스크린리더에서 «장식» 으로 읽힌다', () => {
    for (const k of ['satellite', 'developer', 'card', 'none'] as const) {
      expect(heroImageCaption(k, OPTS).alt.length).toBeGreaterThan(0);
    }
  });
});
