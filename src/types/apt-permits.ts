/**
 * apt_permits(인허가 스테이징) 타입 — supabase gen types 전까지 임시 사용 (PV-1).
 *
 * ⚠️ 정규화 컬럼은 «전부 nullable» 이다. 어느 API 를 쓸지는 PV-2 에서 확정되고,
 *    필드가 없는 것과 값이 0 인 것을 섞으면 커버율 실측이 그대로 거짓말이 된다.
 */

/** 매칭 상태. DB 의 apt_permits_match_status_chk 와 «같은 목록» 을 유지할 것. */
export type PermitMatchStatus = 'pending' | 'matched' | 'review' | 'rejected' | 'no_target';

/** 확신도 4단계. apt_sites.confidence 와 같은 어휘다 — 두 벌을 만들지 않는다. */
export type PermitMatchConfidence = 'rumor' | 'estimated' | 'confirmed' | 'verified';

export interface AptPermit {
  id: number;

  /** 출처. (source, source_key) 가 «같은 인허가건» 의 정의이자 재수집 멱등키다. */
  source: string;
  source_key: string;
  source_url: string | null;
  /** API 응답 원문. 정규화가 틀렸을 때 되돌릴 유일한 근거이므로 지우지 않는다. */
  raw: Record<string, unknown>;
  fetched_at: string;

  sido: string | null;
  sigungu: string | null;
  dong: string | null;
  /** 시군구 5자리. «응답에 실린» 코드를 넣는다 — 요청한 코드가 아니다. */
  lawd_cd: string | null;
  /** 법정동 10자리. */
  bjd_cd: string | null;
  address: string | null;
  road_address: string | null;

  /** 사업명이다. 브랜드명이 아니다(「명륜2구역 주택재개발」). */
  project_name: string | null;
  builder: string | null;
  developer: string | null;
  total_units: number | null;
  building_count: number | null;
  main_purpose: string | null;

  permit_kind: string | null;
  permit_date: string | null;
  /** 착공예정일. 수명 규칙(경과 +180일 강등)의 기준이 되는 날짜다. */
  construct_start_expected: string | null;
  use_approval_expected: string | null;

  match_status: PermitMatchStatus;
  matched_site_id: string | null;
  match_method: string | null;
  match_confidence: PermitMatchConfidence | null;
  match_note: string | null;
  matched_at: string | null;

  created_at: string;
  updated_at: string;
}

/** 수집기가 넣는 것. 매칭 컬럼은 «수집 단계에서 채우지 않는다»(D1·D4). */
export type AptPermitInsert = Pick<AptPermit, 'source' | 'source_key' | 'raw'> &
  Partial<
    Pick<
      AptPermit,
      | 'source_url' | 'sido' | 'sigungu' | 'dong' | 'lawd_cd' | 'bjd_cd'
      | 'address' | 'road_address' | 'project_name' | 'builder' | 'developer'
      | 'total_units' | 'building_count' | 'main_purpose'
      | 'permit_kind' | 'permit_date' | 'construct_start_expected' | 'use_approval_expected'
    >
  >;
