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

/** 문서 카드. holdReason 이 있으면 시드하지 않고 큐에 남긴다. */
export type DocCard = ExtractedCard & { holdReason?: string };

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
