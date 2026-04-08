export function generateImageAlt(category: string, title: string): string {
  const prefixes: Record<string, string> = {
    stock: '카더라 주식 시황 분석',
    finance: '카더라 재테크 가이드',
    apt: '카더라 청약·분양 정보',
    unsold: '카더라 미분양 현황 분석',
    general: '카더라 생활 정보',
  };
  return `${prefixes[category] || '카더라'} — ${title}`;
}

export function generateMetaDesc(content: string, title?: string, category?: string): string {
  // 마크다운/특수문자 정리
  const clean = (s: string) => s.replace(/[#*\[\]|`>\-_~()\n\r]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1순위: 첫 번째 h2 이후 문단 (본문 핵심 시작점)
  const afterH2 = content.match(/##\s+.+\n+([^#\n][^\n]{30,})/);
  if (afterH2?.[1]) {
    const c = clean(afterH2[1]);
    if (c.length >= 50) return c.slice(0, 155);
  }

  // 2순위: 숫자/데이터 줄 건너뛰고 서술형 문장 찾기
  const lines = content.split('\n').map(l => clean(l)).filter(l =>
    l.length >= 30 &&
    !/^\d+[\s,.]/.test(l) &&           // 숫자 시작 줄 제외
    !/^[|:]/.test(l) &&                 // 테이블 줄 제외
    l.split(' ').length >= 5 &&          // 단어 5개 이상 (서술문)
    !/^(위치|면적|세대|평형|시공|입주|분양)/.test(l)  // 데이터 라벨 제외
  );
  if (lines.length > 0) {
    return lines[0].slice(0, 155);
  }

  // 3순위: title 기반 생성 (마지막 폴백)
  if (title) {
    const catLabel = category === 'stock' ? '주식 투자'
      : category === 'apt' ? '부동산'
      : category === 'unsold' ? '미분양'
      : category === 'finance' ? '재테크' : '투자';
    return `${title} — 최신 ${catLabel} 데이터와 분석을 카더라에서 확인하세요.`.slice(0, 155);
  }

  // 최종 폴백: 전체 본문
  const allClean = clean(content);
  return allClean.slice(0, 145) + ' — 카더라';
}

export function generateMetaKeywords(category: string, tags?: string[]): string {
  const base: Record<string, string> = {
    stock: '주식,시황,코스피,코스닥,증시,종목분석,주가전망',
    finance: '재테크,투자,절약,자산관리,적금,ETF',
    apt: '청약,분양,아파트,부동산,청약일정,분양가,모델하우스',
    unsold: '미분양,미분양현황,부동산,아파트,할인분양',
    general: '커뮤니티,정보,소식,생활,가이드',
  };
  const tagStr = tags?.length ? ',' + tags.slice(0, 6).join(',') : '';
  return (base[category] || '정보,커뮤니티') + ',카더라,2026' + tagStr;
}
