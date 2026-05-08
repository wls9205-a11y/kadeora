// lib/blog-templates/station-apt.ts — s258
// sql-seed-longtail "역세권 apt" 본문 강화
// validate_blog_post 의 NO_MAP 게이트 충족 + 본문 깊이 보강

export type StationAptContext = {
  station_name: string;       // "사상역"
  region_sido: string;        // "부산광역시"
  region_sigungu: string;     // "부산광역시 사상구"
  lat?: number;
  lng?: number;
  nearby_complexes?: Array<{
    name: string;
    slug: string;
    distance_m?: number;
    households?: number;
    avg_price_84?: number; // 만원
  }>;
  region_avg_price_pyeong?: number;
};

export function buildStationAptMapBlock(ctx: StationAptContext): string {
  const q = encodeURIComponent(`${ctx.station_name} 아파트`);
  const kakaoUrl =
    ctx.lat && ctx.lng
      ? `https://map.kakao.com/?map_type=TYPE_MAP&q=${q}&urlX=${ctx.lng}&urlY=${ctx.lat}`
      : `https://map.kakao.com/?q=${q}`;
  const naverUrl =
    ctx.lat && ctx.lng
      ? `https://map.naver.com/p?c=${ctx.lng},${ctx.lat},14,0,0,0,dh`
      : `https://map.naver.com/p/search/${q}`;
  return `## 📍 ${ctx.station_name} 위치 및 인근 지도

${ctx.station_name}은 ${ctx.region_sigungu}에 위치합니다. 아래 지도에서 인근 아파트 단지와 교통 인프라를 확인할 수 있습니다.

- [📍 카카오맵에서 ${ctx.station_name} 보기](${kakaoUrl})
- [📍 네이버 지도에서 ${ctx.station_name} 보기](${naverUrl})

> 💡 카카오맵·네이버 지도에서 정확한 도보 거리와 주변 시설을 확인하세요.
`;
}

export function buildNearbyComplexTable(ctx: StationAptContext): string {
  if (!ctx.nearby_complexes || ctx.nearby_complexes.length === 0) return "";
  const rows = ctx.nearby_complexes.slice(0, 8).map(
    (c) =>
      `| [${c.name}](/apt/complex/${c.slug}) | ${
        c.distance_m ? `${c.distance_m}m` : "-"
      } | ${c.households ? `${c.households.toLocaleString()}세대` : "-"} | ${
        c.avg_price_84 ? `${c.avg_price_84.toLocaleString()}만원` : "-"
      } |`,
  );
  return `## 🏢 ${ctx.station_name} 인근 주요 아파트 단지 비교

| 단지명 | 도보거리 | 세대수 | 84㎡ 평균가 |
|---|---|---|---|
${rows.join("\n")}

> 위 데이터는 카더라 부동산 DB(국토교통부 실거래가 공개시스템 기반)를 매일 자동 업데이트합니다.
[📊 ${ctx.region_sigungu} 전체 단지 보기 →](/apt?region=${encodeURIComponent(
    ctx.region_sigungu,
  )})
`;
}

export function buildStationAptFullBoilerplate(ctx: StationAptContext): {
  map_block: string;
  nearby_table: string;
  faq_block: string;
  external_sources_block: string;
} {
  const map_block = buildStationAptMapBlock(ctx);
  const nearby_table = buildNearbyComplexTable(ctx);
  const faq_block = `## ❓ ${ctx.station_name} 역세권 자주 묻는 질문 (FAQ)

**Q1. ${ctx.station_name} 역세권의 정의는?**
A. 일반적으로 지하철역 도보 10분(약 750m) 이내를 1차 역세권으로 봅니다. ${ctx.station_name} 인근 아파트 중 도보 5분(350m) 이내 단지가 가장 높은 시세를 형성합니다.

**Q2. ${ctx.station_name} 역세권 84㎡ 평균 매매가는?**
A. 2026년 5월 기준 ${
    ctx.region_avg_price_pyeong
      ? `평당 약 ${ctx.region_avg_price_pyeong.toLocaleString()}만원`
      : "단지별 편차가 큽니다"
  }. 정확한 단지별 시세는 [카더라 실거래가 페이지](/apt)에서 확인하세요.

**Q3. ${ctx.station_name} 역세권 청약 일정이 있나요?**
A. 신규 분양 일정은 [카더라 청약 페이지](/apt)에서 D-day로 확인할 수 있습니다.
`;
  const external_sources_block = `## 📚 데이터 출처

- [국토교통부 실거래가 공개시스템](https://rt.molit.go.kr/)
- [한국부동산원 부동산통계정보](https://www.reb.or.kr/r-one/)
- [통계청 KOSIS 주거환경통계](https://kosis.kr/)

> ※ 본 콘텐츠는 공공 데이터 기반 정보 제공 목적이며, 투자 권유나 법률 자문이 아닙니다.
`;
  return { map_block, nearby_table, faq_block, external_sources_block };
}
