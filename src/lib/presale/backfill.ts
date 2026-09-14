/**
 * CV-B 백필 — 문서 근거 목록을 «크롤과 같은 문» 으로 통과시킨다 (2026-09-02).
 *
 * ⛔ apt_sites 에 손으로 INSERT 하지 않는다. 이 목록도 크롤 카드와 똑같이
 *    presale_candidates(스테이징) → seedGate → seedSite 를 지난다.
 *    그래야 「이 행이 왜 생겼나」가 한 곳에서 읽힌다.
 *
 * ── 근거 등급 ──────────────────────────────────────────────────────────────
 *   시드 후보 : apt_permits 의 «미매칭 인허가 행» 또는 지역·세대수가 명기된 보도.
 *               sourceUrl 은 그 «행 하나» 로 돌아가는 주소다(#pk 는 관리대장 PK).
 *   보류(queued) : 근거가 대행 사이트 단독이거나, 원문을 아직 못 찾은 것.
 *               holdReason 이 있으면 게이트를 통과해도 «앉히지 않는다».
 *
 * ⚠️ 문서(A-2b)의 「결측 31」을 그대로 옮기지 않았다. 실측으로 갈렸다:
 *      · permits 근거가 서는 것은 8이 아니라 **7** 이다 — 밀양 나노융합 유승한내들(745)은
 *        apt_permits 에 없다(밀양 행 0). 대신 「울산다운2지구 B-1BL 유승한내들 507」이
 *        잡히는데 그건 다른 현장이다. 밀양은 보류로 내린다.
 *      · 「리치벨트」는 **현장이 아니다** — 언론 4건 교차로 「광안리 리치벨트」가 광안대교
 *        조망 부촌을 부르는 «지역 용어» 로 판명됐다. 목록에서 뺀다.
 *      · 사천 엘크루·부암2차 비스타동원 등은 이미 DB 에 있다 — 카드로 넣어 두면
 *        matched 로 기록되어 「없다고 적힌 문서」가 스스로 정정된다.
 */
import type { PresaleSource } from '@/lib/builder-sites/presale-registry';
import type { ExtractedCard } from '@/lib/presale/extract';

/**
 * 문서 카드. holdReason 이 있으면 시드하지 않고 큐에 남긴다.
 * siteType·lifecycleStage 는 NW-3(2026-09-14) — 정비구역을 «분양예정» 으로 앉히지 않으려고 둔다.
 * ⚠️ 값은 원문 근거의 단계만. 모르면 비워 두지 말고 가장 낮은 확인 단계를 쓴다.
 */
export type DocStage = 'union_established' | 'constructor_selected' | 'plan_approved' | 'mgmt_approved'
  | 'construction' | 'pre_announcement';
export type DocCard = ExtractedCard & {
  holdReason?: string;
  siteType?: 'subscription' | 'redevelopment';
  lifecycleStage?: DocStage;
  /** confidence_note 에 덧붙일 한 줄 — 수치 상충 시 «이설» 보존용(최신 공적 계획 채택 규칙). */
  noteExtra?: string;
};

/**
 * ⚠️ 이 소스는 fetch 하지 않는다. listUrl 은 «근거 문서» 를 가리키는 표식이다.
 *    라우트가 `key` 로 doc 소스를 알아보고 아래 카드를 그대로 쓴다.
 */
export const BACKFILL_SOURCE: PresaleSource = {
  key: 'doc:PV_20260829',
  builder: '',
  brand: '',
  label: 'CV-B 백필 — PV_INSTRUCTION_20260829 A-2b/A-2c',
  listUrl: 'https://github.com/wls9205-a11y/kadeora/blob/main/docs/PV_INSTRUCTION_20260829.md',
  kind: 'presale',
  robotsCheckedAt: '2026-09-02',
};

const permitUrl = (path: string) => `https://apis.data.go.kr/1613000/HsPmsHubService/getHpBasisOulnInfo?${path}`;

const card = (c: Omit<DocCard, 'statusRaw' | 'kind'> & { kind?: DocCard['kind'] }): DocCard => ({
  statusRaw: null, kind: 'presale', ...c,
});

/** 시드 후보 — 근거가 «행 하나» 로 특정되는 것들. */
const SEEDABLE: DocCard[] = [
  // 인허가 2022-09-29. A-2b 「구역명만 4」 — 그랑자이 더 비치로 이미 있을 수 있다(matched 기대)
  card({ rawName: '남천2구역(비치아파트)', region: '부산', sigungu: '수영구',
    addrRaw: '부산광역시 수영구 남천동 148-4번지',
    totalUnits: 3060, sourceUrl: permitUrl('sigunguCd=26500&bjdongCd=10500&platGbCd=0&bun=0148&ji=0004#pk=1041100008963') }),
  // 인허가 2019-06-28. 그랑라크 에일린의 뜰 — 이미 DB 에 있다(matched 기대)
  card({ rawName: '울산 남구 B-14 주택재개발 정비사업', region: '울산', sigungu: '남구',
    addrRaw: '울산광역시 남구 야음동 350-5번지',
    totalUnits: 1521, sourceUrl: permitUrl('sigunguCd=31140&bjdongCd=10800&platGbCd=0&bun=0350&ji=0005#pk=1078100011767') }),
  // 인허가 2025-06-27. 택지 블록이라 지번이 0000 — #pk 로 행을 특정한다
  card({ rawName: '울산KTX역세권복합특화단지 A3블록 공동주택', region: '울산', sigungu: '울주군',
    addrRaw: '울산광역시 울주군 삼남읍 신화리 블록',
    totalUnits: 1320, sourceUrl: permitUrl('sigunguCd=31710&bjdongCd=26523&platGbCd=2&bun=0000&ji=0000#pk=1000000000000000311521') }),
  // 인허가 2022-10-25
  card({ rawName: '울산 남구 야음동 공동주택', region: '울산', sigungu: '남구',
    addrRaw: '울산광역시 남구 야음동 363-2번지',
    totalUnits: 803, sourceUrl: permitUrl('sigunguCd=31140&bjdongCd=10800&platGbCd=0&bun=0363&ji=0002#pk=1076100004976') }),
  // 인허가 2023-09-14. 다운2지구의 «다른» 블록들은 이미 있다 — C-1 만 없다
  card({ rawName: '울산 다운2지구 C-1BL 공동주택', region: '울산', sigungu: '중구',
    addrRaw: '울산광역시 중구 다운동 블록',
    totalUnits: 644, sourceUrl: permitUrl('sigunguCd=31110&bjdongCd=11200&platGbCd=2&bun=0000&ji=0000#pk=1000000000000000142576') }),
  // 인허가 2023-08-02
  card({ rawName: '울산시 동구 화정동 638-3 주거복합단지 신축공사', region: '울산', sigungu: '동구',
    addrRaw: '울산광역시 동구 화정동 638-3번지',
    totalUnits: 356, sourceUrl: permitUrl('sigunguCd=31170&bjdongCd=10200&platGbCd=0&bun=0638&ji=0003#pk=1000000000000000133943') }),
  // 인허가 2023-12-28
  card({ rawName: '울산 옥교동 224번지 일원 주거복합 신축공사', region: '울산', sigungu: '중구',
    addrRaw: '울산광역시 중구 옥교동 224번지',
    totalUnits: 300, sourceUrl: permitUrl('sigunguCd=31110&bjdongCd=10500&platGbCd=0&bun=0224&ji=0000#pk=1000000000000000167547') }),

  // 부동산114 9월 집계 보도 — 지역·세대수 명기(채팅 실측 출처)
  card({ rawName: '거제 옥포 공동주택', region: '경남', sigungu: '거제시',
    totalUnits: 1963, sourceUrl: 'https://biz.heraldcorp.com/article/10858462' }),
  // ⚠️ 공공택지 블록으로 «추정» 된다 — judgeSupplyType 이 민영으로 보면 검수 큐에서
  //    supply_type 을 다시 본다. 공공이면 ad_blocked 가 붙는다(R2).
  card({ rawName: '부산 명지A5 공동주택', region: '부산', sigungu: '강서구',
    totalUnits: 876, sourceUrl: 'https://www.sedaily.com/article/20085734' }),
];

/**
 * 보류 — 근거가 서지 않는 것들. 「없다」가 아니라 «아직 앉히지 않는다» 를 기록한다.
 * ⚠️ 이 카드들도 presale_candidates 에는 남는다. 결측을 사람 기억이 아니라 표가 들고 있게 하는 것이
 *    이 트랙의 목적이다(CV-4 갭워치가 이 표를 읽는다).
 */
const HELD: DocCard[] = [
  card({ rawName: '에코델타시티 12BL', region: '부산', sigungu: '강서구', sourceUrl: '',
    holdReason: '근거가 분양대행 사이트뿐 — permits 대기' }),
  card({ rawName: '대구 금호워터폴리스 제일풍경채', region: '대구', sourceUrl: 'https://home-planner.co.kr/dg-jeil',
    holdReason: '분양대행 페이지 단독 근거 — 교차 근거 대기' }),
  card({ rawName: '목포 산정공원 서희스타힐스', region: '전남', sourceUrl: 'https://home-planner.co.kr/mp-starhills',
    holdReason: '분양대행 페이지 단독 근거 — 교차 근거 대기' }),
  card({ rawName: '전주 종광대2 센트레빌', region: '전북', sourceUrl: 'https://home-planner.co.kr/jj-centreville',
    holdReason: '분양대행 페이지 단독 근거 — 교차 근거 대기' }),
  card({ rawName: '목포 용당 대방엘리움', region: '전남', sourceUrl: 'https://home-planner.co.kr/mp-elium',
    holdReason: '분양대행 페이지 단독 근거 — 교차 근거 대기' }),

  // A-2c 「미검출 16」 — 원문을 못 찾은 것들. sourceUrl 이 비어 있어 seedGate 도 막지만,
  // «왜 안 앉혔는지» 를 남기려고 카드로 넣는다.
  card({ rawName: '용원하버시티 에일린의 뜰', region: '경남', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '사천 송지 엘크루', region: '경남', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '거제 장승포 서희스타힐스', region: '경남', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '다인로얄팰리스 부산신항 2차', region: '경남', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '통영 한림풀에버', region: '경남', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '밀양 나노융합 유승한내들', region: '경남', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '울산 남구 B-07 재개발', region: '울산', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '문수로 비스타 더파크', region: '울산', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '울산 달동 더리브', region: '울산', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '대상 웰라움 달동', region: '울산', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '화정1지구 서한이다음', region: '울산', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '청량읍 덕하리 공동주택', region: '울산', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '에코델타시티 29BL', region: '부산', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '남부민동 주상복합', region: '부산', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '다대동 구획지 공동주택', region: '부산', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '부산 명지2지구 B11 예미지', region: '부산', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
  card({ rawName: '부산 명지2지구 B12 예미지', region: '부산', sourceUrl: '',
    holdReason: 'A-2c 미검출 — 원문 부재. permits·보도 재수색 대상' }),
];

/** 라우트가 쓰는 카드 전량. 시드 후보 먼저, 보류 뒤. */
export const BACKFILL_CARDS: DocCard[] = [...SEEDABLE, ...HELD];

/* ══ NW-3 — 나무위키 경상권 대조 결측 11곳 (설계서_NW_20260913 v2.0) ═══════════════
 * 원문 근거는 언론·지자체만(나무위키·분양대행 제외). 조사일 2026-09-14.
 *
 * ⚠️ rawName 은 «구역명» 이다. 「더샵 엘리체」「힐스테이트 하이스트」 같은 이름은 대부분
 *    시공사 선정 때의 «제안명» 이라 확정명이 아니다(CV-N T-C 규약). 브랜드 별칭은
 *    cvn-name-watch 백필 모드가 뉴스로 붙인다 — 그 크론의 표적이 「브랜드 별칭 없는 정비」다.
 * ⚠️ 단계는 원문으로 확인된 가장 높은 단계. 정비구역을 pre_announcement 로 앉히지 않는다.
 * ⚠️ 설계서의 「중구 B-04 롯데×GS」는 구식이다 — 2022-06 해지, 2023-04 삼성물산·현대건설 선정.
 */
export const NW_20260914_SOURCE: PresaleSource = {
  key: 'doc:NW_20260914',
  builder: '',
  brand: '',
  label: 'NW-3 — 나무위키 경상권 대조 결측 정비구역 (설계서_NW_20260913)',
  listUrl: 'https://github.com/wls9205-a11y/kadeora/blob/main/STATUS.md',
  kind: 'presale',
  robotsCheckedAt: '2026-09-14',
};

const redev = (c: Omit<DocCard, 'statusRaw' | 'kind' | 'siteType'>): DocCard =>
  card({ siteType: 'redevelopment', ...c });

const NW_20260914_SEEDABLE: DocCard[] = [
  // 블로터 2025-08-20 — 공사비 협상·본PF 리파이낸싱. 헤럴드경제 2026-01 공급 목록에 「11월 분양 예정」
  redev({ rawName: '대구 노원2동 주택재개발', region: '대구', sigungu: '북구',
    addrRaw: '대구광역시 북구 노원동2가 319번지 일원', totalUnits: 1558, builderRaw: '포스코이앤씨',
    expectedPeriodRaw: '2026년 11월', lifecycleStage: 'pre_announcement',
    sourceUrl: 'https://www.bloter.net/news/articleView.html?idxno=642399' }),
  // 한국주택경제 2026-04-28 — 세입자 조사·정비기반시설 설계 용역 발주(인가 단계 미확인)
  redev({ rawName: '대구 반고개 재개발', region: '대구', sigungu: '달서구',
    addrRaw: '대구광역시 달서구 두류동 840번지 일대', totalUnits: 1254, builderRaw: '포스코이앤씨, 롯데건설',
    lifecycleStage: 'constructor_selected',
    sourceUrl: 'https://www.arunews.com/news/articleView.html?idxno=62132' }),
  // 한국주택경제 2024-12-04 — 사업시행인가 2024-11-20(임대 45 포함 818)
  redev({ rawName: '대구 서문지구 재개발', region: '대구', sigungu: '중구',
    addrRaw: '대구광역시 중구 대신동 1021번지 일원', totalUnits: 818, builderRaw: 'GS건설',
    lifecycleStage: 'plan_approved',
    sourceUrl: 'https://www.arunews.com/news/articleView.html?idxno=46628' }),
  // 한국경제 2022-03-02 수주(1,901) · 하우징헤럴드 2026-01-13 석면조사업체 선정
  redev({ rawName: '대구 수성1지구 재개발', region: '대구', sigungu: '수성구',
    addrRaw: '대구광역시 수성구 신천동로 306 일대', totalUnits: 1901, builderRaw: 'DL이앤씨',
    lifecycleStage: 'constructor_selected',
    sourceUrl: 'https://www.housingherald.co.kr/news/articleView.html?idxno=60547' }),
  // 영남일보 2025-05-06 — 건축심의 조건부 통과(1,112)
  redev({ rawName: '대구 신암4 재정비촉진구역', region: '대구', sigungu: '동구',
    addrRaw: '대구광역시 동구 신암동 628-10번지 일대', totalUnits: 1112, builderRaw: 'GS건설',
    lifecycleStage: 'constructor_selected',
    sourceUrl: 'https://www.yeongnam.com/web/view.php?key=20250506025084905' }),
  // 대한경제 2019-12-09 — 현대건설 선정(1,226). ⚠️ 이후 단계 원문 미확인 — 근거가 오래됐다
  redev({ rawName: '대구 신암9구역 재개발', region: '대구', sigungu: '동구',
    addrRaw: '대구광역시 동구 신암동 642-1번지 일원', totalUnits: 1226, builderRaw: '현대건설',
    lifecycleStage: 'constructor_selected',
    noteExtra: '근거 단건 — 2019-12 수주 기사뿐, 이후 단계 원문 미확인',
    sourceUrl: 'https://www.dnews.co.kr/uhtml/view.jsp?idxno=201912072051030490972' }),
  // 대구 남구청 정비사업 현황(1,065·13개동 — 현대건설 2022 발표 1,107보다 최신 계획) · 통합심의 가결 2024-12
  redev({ rawName: '대구 봉덕1동 우리주택 재개발', region: '대구', sigungu: '남구',
    addrRaw: '대구광역시 남구 봉덕동 976-2', totalUnits: 1065, builderRaw: '현대건설',
    lifecycleStage: 'constructor_selected',
    noteExtra: '세대수 이설 — 남구청 최신 계획 1,065(13개동) 채택 · 현대건설 발표(2022-01) 1,107(12개동)',
    sourceUrl: 'https://www.hdec.kr/kr/newsroom/news_view.aspx?NewsSeq=484&NewsType=LATEST&NewsListType=news_clist' }),
  // 대한경제 2021-05-24 수주(737·49층) · 한국주택경제 2026-08-27 사업시행 변경인가 준비·2027 관리처분 목표
  redev({ rawName: '구미 원평구역 도시정비형 재개발', region: '경북', sigungu: '구미시',
    addrRaw: '경상북도 구미시 원평동 24번지 일대', totalUnits: 737, builderRaw: '포스코이앤씨',
    lifecycleStage: 'plan_approved',
    sourceUrl: 'https://www.arunews.com/news/articleView.html?idxno=66424' }),
  // 한국주택경제 2024-04-02 통합심의 조건부 통과(1,304) · 울산MBC 2026-07-06 사업시행인가 준비(HDC 유지)
  redev({ rawName: '울산 남구 B-07 재개발', region: '울산', sigungu: '남구',
    addrRaw: '울산광역시 남구 신정동 872번지 일원', totalUnits: 1304, builderRaw: 'HDC현대산업개발',
    lifecycleStage: 'constructor_selected',
    sourceUrl: 'https://www.usmbc.co.kr/NewsArticle/849470' }),
  // 뉴시스 2026-07-21 — 관리처분인가(2024)·이주 약 96%·수용재결 지연(4,080). 시공 삼성물산·현대건설(2023-04)
  redev({ rawName: '울산 중구 B-04 재개발', region: '울산', sigungu: '중구',
    addrRaw: '울산광역시 중구 북정동·교동 일대', totalUnits: 4080, builderRaw: '삼성물산, 현대건설',
    lifecycleStage: 'mgmt_approved',
    sourceUrl: 'https://www.newsis.com/view/NISX20260721_0003717393' }),
];

const NW_20260914_HELD: DocCard[] = [
  // 월요신문 2026-07-22 변경계약 2,023세대 vs 한국주택경제 2026-08-27 「29층 770세대」 — 세대수 상충
  redev({ rawName: '구미 원평2동 주택재개발', region: '경북', sigungu: '구미시',
    addrRaw: '경상북도 구미시 원평동 7-43번지 일대', totalUnits: 2023, builderRaw: 'GS건설',
    lifecycleStage: 'mgmt_approved',
    sourceUrl: 'https://www.wolyo.co.kr/news/articleView.html?idxno=315366',
    holdReason: '세대수 상충(2,023 vs 770) — 정본 확인 후 해제' }),
];

export const NW_20260914_CARDS: DocCard[] = [...NW_20260914_SEEDABLE, ...NW_20260914_HELD];

/**
 * 문서 소스 레지스트리 — 라우트가 key 로 알아본다.
 * ⛔ 「문이 하나여야 규칙이 하나다」. 문서 배치가 늘어도 뒤 문(matchSite·seedGate·seedSite·
 *    upsertCandidate)은 그대로 하나다. 문서 소스는 `?source=` 로 부를 때만 돈다.
 */
export const DOC_SOURCES: Array<{ source: PresaleSource; cards: DocCard[] }> = [
  { source: BACKFILL_SOURCE, cards: BACKFILL_CARDS },
  { source: NW_20260914_SOURCE, cards: NW_20260914_CARDS },
];

export const docSourceFor = (key: string) =>
  DOC_SOURCES.find((d) => d.source.key === key) ?? null;
