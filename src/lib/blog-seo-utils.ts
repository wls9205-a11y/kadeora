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
  // 1순위: 첫 번째 h2 이후 첫 문단에서 추출
  const afterH2 = content.match(/##\s+.+\n+([^#\n][^\n]+)/);
  if (afterH2?.[1]) {
    const cleaned = afterH2[1].replace(/[#*\[\]|`>\-]/g, '').replace(/\s+/g, ' ').trim();
    if (cleaned.length >= 40) {
      return cleaned.slice(0, 155) + (cleaned.length > 155 ? '' : '');
    }
  }
  // 2순위: 전체 본문에서 추출
  const cleaned = content
    .replace(/##?\s+.+/g, '') // 제목 제거
    .replace(/[#*\[\]|`>\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const suffix = category === 'stock' ? ' 카더라에서 확인하세요.' : category === 'apt' ? ' 카더라 부동산에서 확인하세요.' : '';
  const desc = cleaned.slice(0, 145 - suffix.length);
  return desc + suffix;
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
