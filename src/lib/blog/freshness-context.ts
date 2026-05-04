export function getFreshnessContext(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  const dateKst = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: 'Asia/Seoul' }).format(now);
  const expires90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

  return `[현재 시점 컨텍스트]
- 오늘 날짜: ${dateKst}
- 현재 연도: ${year}
- 현재 분기: ${year}년 ${quarter}분기
- 청약 일정/공고 등 시즌성 정보는 ${dateKst} 이후만 다루세요
- "${year - 1}년" 같은 과거 연도를 미래/현재형으로 절대 쓰지 마세요
- 분기 실적은 가장 최근 발표된 분기 기준
- 시장 동향은 최근 30일 내 데이터만 사용

[메타데이터 가이드]
- title 에 연도가 들어갈 경우 ${year} 만 사용 (필요시 "${year}~${year + 1}" 범위 OK)
- target_year: ${year}
- expires_at: 시즌성 글이면 ${expires90}, 영구 정보면 NULL
- is_seasonal: 청약일정/분기실적/마감/공고/D-day 류면 true`;
}

export function deriveFreshnessFields(opts: { isSeasonal: boolean; targetYear?: number }) {
  const year = new Date().getFullYear();
  return {
    target_year: opts.targetYear ?? year,
    expires_at: opts.isSeasonal ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() : null,
    is_seasonal: opts.isSeasonal,
  };
}
