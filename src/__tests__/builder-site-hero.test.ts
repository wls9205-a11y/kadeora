// V17 G — 조감도 후보 선정 규칙 테스트.
//
// 별칭·세대수는 틀리면 고치면 되지만 **이미지는 저작물**이라 성격이 다르다.
// 여기 케이스는 전부 "확실하지 않으면 건너뛴다" 쪽을 고정한다.

import { describe, expect, it } from 'vitest';
import { MIN_HERO_WIDTH, pickHeroCandidates, verifyBrandFooter } from '@/lib/builder-sites/hero';

const BASE = 'https://www.ihanulche.co.kr/sale/view/1083';

describe('조감도 후보 선정', () => {
  it('업로드 경로의 사진만 후보로 본다', () => {
    const html = `
      <img src="/resources/images/brand/main/brand-logo-800x400.gif">
      <img src="/resources/upload/bd/2088/sale/20260202/2b8f1c0e.jpg">
      <img src="/resources/images/common/icon-tel.png">
    `;
    expect(pickHeroCandidates(html, BASE)).toEqual([
      'https://www.ihanulche.co.kr/resources/upload/bd/2088/sale/20260202/2b8f1c0e.jpg',
    ]);
  });

  it('og:image 를 후보로 쓰지 않는다', () => {
    // 실측: 상세 페이지의 og:image 는 브랜드 로고(800×400 gif)였다.
    const html = `
      <meta property="og:image" content="https://www.ihanulche.co.kr/resources/images/brand/main/brand-logo-800x400.gif">
      <img src="/resources/upload/a/b.jpg">
    `;
    const got = pickHeroCandidates(html, BASE);
    expect(got.some((u) => u.includes('brand-logo'))).toBe(false);
    expect(got).toHaveLength(1);
  });

  it('gif·svg 는 조감도가 아니다', () => {
    const html = '<img src="/resources/upload/x/logo.gif"><img src="/resources/upload/x/mark.svg">';
    expect(pickHeroCandidates(html, BASE)).toEqual([]);
  });

  it('상대경로를 절대경로로 바꾼다', () => {
    expect(pickHeroCandidates('<img src="/resources/upload/a.jpg">', BASE)[0]).toBe(
      'https://www.ihanulche.co.kr/resources/upload/a.jpg',
    );
  });

  it('같은 이미지가 두 번 나와도 한 번만 센다', () => {
    const html = '<img src="/resources/upload/a.jpg"><img src="/resources/upload/a.jpg">';
    expect(pickHeroCandidates(html, BASE)).toHaveLength(1);
  });

  it('최소 폭 기준은 1200이다 — apt-cover 가 1600으로 재인코딩해도 확대되지 않는다', () => {
    expect(MIN_HERO_WIDTH).toBe(1200);
  });
});

describe('④ 전용 홈페이지 A등급 판정', () => {
  const footer = '시공 코오롱글로벌 주식회사 사업자등록번호 120-81-50012 대표 안병덕';

  it('시공사명 + 사업자등록번호가 함께 있어야 통과', () => {
    expect(verifyBrandFooter(footer, '코오롱글로벌')).toBe(true);
  });

  it('사업자등록번호만 있으면 안 된다 — 분양대행이 남의 번호를 적었을 수 있다', () => {
    expect(verifyBrandFooter('사업자등록번호 123-45-67890 분양문의', '코오롱글로벌')).toBe(false);
  });

  it('시공사명만 있으면 안 된다 — 분양대행 사이트가 시공사명을 적어 둔 것일 수 있다', () => {
    expect(verifyBrandFooter('코오롱글로벌 시공 예정 · 분양대행 ○○', '코오롱글로벌')).toBe(false);
  });

  it('번호 형식이 아니면 통과시키지 않는다', () => {
    expect(verifyBrandFooter('코오롱글로벌 사업자등록번호 준비중', '코오롱글로벌')).toBe(false);
  });

  it('다른 시공사 사이트는 통과하지 않는다', () => {
    expect(verifyBrandFooter(footer, '포스코이앤씨')).toBe(false);
  });
});
