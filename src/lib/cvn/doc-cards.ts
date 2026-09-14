/**
 * CV-N 문서 카드 — 사람이 조사한 예정명을 «뉴스 워처와 같은 문» 으로 통과시킨다 (BP70 · 2026-09-14).
 *
 * presale 의 DOC_SOURCES(backfill.ts) 와 같은 결이다. 목록은 사람이 만들지만,
 * 쓰기는 applyCandidate 한 곳이 한다 — 매칭·티어·유일성 게이트·autoapply 스위치·쓰기 대장이 전부 그대로다.
 *
 * ⛔ apt_sites.name_variants·display_name 에 SQL 로 직접 넣지 않는다(BP70 §1-6).
 *    직접 넣으면 site_name_candidates 에 행이 없어 야간 대사(heal_realias)의 보호 밖이고,
 *    같은 이름이 다른 현장에 이미 있는지(유일성)를 아무도 보지 않는다.
 * ⛔ 출처 수가 곧 티어다. name_confirm·win 은 «서로 다른 출처 2건 이상» 이어야 T-B 로 쓴다
 *    (crossRefs = sources − 1). 1건이면 pending 으로 큐에만 남는다 — 억지로 채우지 않는다.
 * ⚠️ bid(수주전 제안명)는 T-C held 로만 남는다. 확정명과 섞지 않는다.
 */
import type { EventType, NameCandidateInput } from './decide';

export interface CvnDocCard {
  proposedName: string;
  eventType: EventType;
  /** 사업명(=apt_sites.name). 매칭 1차 키. */
  projectName: string;
  region: string;
  sigungu: string;
  /** 서로 «다른» 출처만. 같은 기사의 전재본은 1건으로 센다. */
  sources: string[];
  builderRaw?: string | null;
  totalUnits?: number | null;
  /** 조사 메모 — 판정 근거. 쓰기에는 쓰이지 않는다. */
  note?: string;
}

export interface CvnDocSource {
  key: string;
  label: string;
  cards: CvnDocCard[];
}

export function toCandidateInput(src: CvnDocSource, c: CvnDocCard): NameCandidateInput {
  return {
    proposedName: c.proposedName,
    eventType: c.eventType,
    source: `doc:${src.key}`,
    sourceUrl: c.sources[0] ?? null,
    projectName: c.projectName,
    region: c.region,
    sigungu: c.sigungu,
    builderRaw: c.builderRaw ?? null,
    totalUnits: c.totalUnits ?? null,
    crossRefs: Math.max(0, new Set(c.sources).size - 1),
  };
}

/**
 * BP70 §1 — 조사일 2026-09-14.
 * ⚠️ 지시서가 「확정 펫네임」이라 적은 것도 출처로 다시 갈랐다:
 *    · 드메인 데시앙 — 부산일보(2024-05-30) 단건. 김해시 승인 목록엔 없다 → 1출처라 pending 으로만 남는다.
 *    · 두산위브 더제니스 팔라티움 — 부산일보 「들어선다」 보도뿐, 조합 명칭 의결 보도 없음 → bid(T-C held).
 *    · 래미안 엘리미엄 울산 — 삼성물산 수주전 제안명 → bid(T-C held).
 *    · 울산 복산동 ↔ 대광로제비앙 — 입찰·선정·명명 근거 «없음»(대광건영 복산동 675 은 별개 사업). 카드 안 넣는다.
 */
export const CVN_DOC_SOURCES: CvnDocSource[] = [
  {
    key: 'BP70_20260914',
    label: 'BP70 §1 — 부울경 분양예정 예정명 부착',
    cards: [
      {
        proposedName: '힐스테이트 거제시그니처', eventType: 'name_confirm',
        projectName: '거제 옥포 공동주택', region: '경남', sigungu: '거제시',
        builderRaw: '현대엔지니어링', totalUnits: 1963,
        sources: [
          'https://www.geojejournal.co.kr/news/articleView.html?idxno=207751',
          'https://www.hankyung.com/article/202609107261i',
        ],
        note: '옥포동 1670(구 옥포아파트) · 1,963세대 · 2026-10 분양예정 · 민간(거제저널·한국경제 2026-09-10)',
      },
      {
        proposedName: '진주 판문지구 레이크써밋 웰가', eventType: 'name_confirm',
        projectName: '판문지구 공동주택 1단지', region: '경남', sigungu: '진주시',
        totalUnits: 690,
        sources: [
          'https://biz.heraldcorp.com/article/10866010',
          'https://www.gnnews24.kr/news/articleView.html?idxno=34045',
        ],
        note: '판문동 241-1 · 690세대 · 2026-09 분양 · 시행 익상(헤럴드경제·경남뉴스 2026-09-08). 시공사 원문 명시 없음',
      },
      {
        proposedName: '김해 드메인 데시앙', eventType: 'name_confirm',
        projectName: '김해 외동 재건축사업', region: '경남', sigungu: '김해시',
        sources: ['https://www.busan.com/view/busan/view.php?code=2024053012042103267'],
        note: '단건 출처 — 교차 1건 도착 전까지 pending',
      },
      {
        proposedName: '두산위브 더제니스 팔라티움', eventType: 'bid',
        projectName: '시민공원주변재정비촉진4구역 재개발', region: '부산', sigungu: '부산진구',
        sources: [
          'https://www.busan.com/view/busan/view.php?code=2026031618391576193',
          'https://www.housingherald.co.kr/news/articleView.html?idxno=62666',
        ],
        note: '두산건설 시공(2025-09 선정) · 849세대 · 관리처분 2026-02-27 — 단지명 의결 보도 없음',
      },
      {
        proposedName: '래미안 엘리미엄 울산', eventType: 'bid',
        projectName: '울산 남구 B-04 재개발', region: '울산', sigungu: '남구',
        sources: ['https://www.hankyung.com/article/2025062965976'],
        note: '삼성물산 수주 제안명(2025-06-28 총회)',
      },
    ],
  },
];

export const cvnDocSourceFor = (key: string): CvnDocSource | null =>
  CVN_DOC_SOURCES.find((s) => s.key === key) ?? null;
