// 조감도 후보 고르기 가드.
//
// ⚠️ 이미지는 저작물이고 화면에 「대우건설」credit 을 달고 나간다. 틀리면 되돌리는 걸로 끝나지 않는다.
//    아래 케이스는 전부 2026-08-25 prugio-riverfront.com 실측에서 나온 것이다.

import { describe, it, expect } from 'vitest';
import { pickHeroCandidates } from '@/lib/builder-sites/hero';

const BASE = 'https://prugio-riverfront.com/';

const HTML = `
<img src="https://www.facebook.com/tr?id=2138935763746985&ev=PageView&noscript=1" />
<img src="item.img" />
<img src='/resources/img/common/popup_closeBtn.v100.png' />
<img src="/resources/img/main/main_calendar_bg.jpg" />
<img src="/resources/img/main/main_visual_copy.svg" />
<img src="/resources/img/main/landscape/ls_intro_feature.webp" />
<img src="/resources/img/main/detail/detail_panel_unit.jpg" />
<img src="/upload/prj/hero.jpg" />
`;

describe('pickHeroCandidates — 기본(하늘채): /upload/ 경로만', () => {
  it('업로드 경로만 남는다', () => {
    expect(pickHeroCandidates(HTML, BASE)).toEqual(['https://prugio-riverfront.com/upload/prj/hero.jpg']);
  });
});

describe('pickHeroCandidates — 전용 홈페이지(경로 강제 해제)', () => {
  const got = pickHeroCandidates(HTML, BASE, { requireUploadPath: false });

  it('남의 도메인 이미지를 쓰지 않는다 — 추적 픽셀이 후보로 잡혔다', () => {
    // 남의 도메인 이미지를 「시공사 공식 사이트」credit 으로 올리면 출처가 거짓이 된다.
    expect(got.some((u) => u.includes('facebook.com'))).toBe(false);
  });

  it('템플릿 자리표시자를 주소로 착각하지 않는다', () => {
    // `item.img` — 점이 있다고 주소가 아니다.
    expect(got.some((u) => u.endsWith('/item.img'))).toBe(false);
  });

  it('🔴 화면 자산을 뺀다 — 크기 게이트를 통과해 버린다', () => {
    // main_calendar_bg.jpg 는 1920x950 이라 1200px 하한을 넘는다.
    // measureFirstUsable 이 첫 통과분을 쓰므로 이름을 안 보면 달력 배경이 조감도로 나간다.
    expect(got.some((u) => u.includes('main_calendar_bg'))).toBe(false);
    expect(got.some((u) => u.includes('popup_closeBtn'))).toBe(false);
  });

  it('svg 는 후보가 아니다', () => {
    expect(got.some((u) => u.endsWith('.svg'))).toBe(false);
  });

  it('🔴 조경·커뮤니티 렌더를 조감도로 쓰지 않는다', () => {
    // ls_intro_feature.webp 는 1851x1234 로 크기 게이트를 통과하지만 조경 인트로다.
    // 현장 페이지 히어로에 「단지 조감도」처럼 올라가면 사실과 다르다.
    expect(got.some((u) => u.includes('ls_intro_feature'))).toBe(false);
    expect(got.some((u) => u.includes('detail_panel_interior'))).toBe(false);
  });

  it('이름으로 확신할 수 없으면 그 사이트는 이미지 없이 둔다', () => {
    // prugio-riverfront.com · arkone-prugio.com 둘 다 실측 후보 0건이다.
    // 빈 손으로 두는 쪽이 틀린 사진을 올리는 것보다 낫다.
    expect(got).toHaveLength(0);
  });

  it('조감도 힌트가 있으면 받는다', () => {
    const ok = pickHeroCandidates(
      '<img src="/resources/img/main/main_visual_01.jpg" /><img src="/img/bird_eye_view.jpg" />',
      BASE,
      { requireUploadPath: false },
    );
    expect(ok).toEqual([
      'https://prugio-riverfront.com/resources/img/main/main_visual_01.jpg',
      'https://prugio-riverfront.com/img/bird_eye_view.jpg',
    ]);
  });

  it('힌트가 있어도 화면 자산이면 버린다', () => {
    // main_visual_deco_img_01 은 힌트(main_visual)를 갖지만 deco 다 — 순서가 중요하다.
    const out = pickHeroCandidates('<img src="/img/main_visual_deco_img_01.jpg" />', BASE, {
      requireUploadPath: false,
    });
    expect(out).toHaveLength(0);
  });

  it('후보 수에 상한이 있다 — 전용 홈페이지는 이미지가 수십 장이다', () => {
    const many = Array.from({ length: 40 }, (_, i) => `<img src="/resources/img/view_${i}.jpg" />`).join('');
    expect(pickHeroCandidates(many, BASE, { requireUploadPath: false }).length).toBeLessThanOrEqual(12);
  });
});
