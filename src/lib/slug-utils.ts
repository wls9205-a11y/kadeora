export function generateEnglishSlug(title: string, id?: string): string {
  const slugMap: Record<string, string> = {
    '청약': 'subscription', '미분양': 'unsold', '재개발': 'redevelopment',
    '재건축': 'reconstruction', '분양': 'sale', '아파트': 'apt',
    '시세': 'price', '투자': 'invest', '전세': 'jeonse',
    '매매': 'trade', '분석': 'analysis', '가이드': 'guide',
    '서울': 'seoul', '부산': 'busan', '경기': 'gyeonggi',
    '대구': 'daegu', '인천': 'incheon', '광주': 'gwangju',
    '대전': 'daejeon', '울산': 'ulsan', '세종': 'sejong',
    '강남': 'gangnam', '송파': 'songpa', '마포': 'mapo',
    '강서': 'gangseo', '영등포': 'yeongdeungpo', '용산': 'yongsan',
    '주식': 'stock', '코스피': 'kospi', '코스닥': 'kosdaq',
    '테마': 'theme', '배당': 'dividend', '실적': 'earnings',
    '금리': 'interest-rate', '환율': 'exchange-rate',
    '부동산': 'real-estate', '대장': 'landmark',
    '시장': 'market', '주간': 'weekly', '월간': 'monthly',
    '분기': 'quarterly', '리뷰': 'review', '전망': 'outlook',
    '총정리': 'summary', '완전': 'complete', '현황': 'status',
  };

  let slug = title;
  for (const [kr, en] of Object.entries(slugMap)) {
    slug = slug.replace(new RegExp(kr, 'g'), en);
  }

  slug = slug
    .replace(/[가-힣]+/g, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  if (slug.length < 5 && id) {
    slug = `${slug}-${id.substring(0, 8)}`;
  }

  return slug || `post-${Date.now()}`;
}
