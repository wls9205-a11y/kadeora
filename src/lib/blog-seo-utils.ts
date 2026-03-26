export function generateImageAlt(category: string, title: string): string {
  const prefixes: Record<string, string> = {
    stock: '카더라 주식 시황',
    finance: '카더라 재테크',
    apt: '카더라 청약 정보',
    unsold: '카더라 미분양 현황',
    general: '카더라',
  };
  return `${prefixes[category] || '카더라'} — ${title}`;
}

export function generateMetaDesc(content: string): string {
  const cleaned = content
    .replace(/[#*\[\]|`>\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 155) + (cleaned.length > 155 ? '...' : '');
}

export function generateMetaKeywords(category: string, tags?: string[]): string {
  const base: Record<string, string> = {
    stock: '주식,시황,코스피,코스닥,증시',
    finance: '재테크,투자,절약,자산관리',
    apt: '청약,분양,아파트,부동산,청약일정',
    unsold: '미분양,미분양현황,부동산,아파트',
    general: '커뮤니티,정보,소식',
  };
  const tagStr = tags?.length ? ',' + tags.join(',') : '';
  return (base[category] || '정보,커뮤니티') + ',카더라' + tagStr;
}
