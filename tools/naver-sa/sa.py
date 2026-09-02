#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
카더라 파워링크 전국 대량등록 도구

Supabase → 네이버 대량등록 CSV / SA API.
DB가 준 slug 를 그대로 URL 로 쓴다. 사람이 옮겨 적는 단계가 없으므로
슬러그 오타가 구조적으로 발생하지 않는다.

설치
    pip install psycopg2-binary requests
    export SUPABASE_DB_URL='postgresql://...'          # 읽기 전용 계정 권장
    export NAVER_SA_API_KEY=... NAVER_SA_SECRET_KEY=... NAVER_SA_CUSTOMER_ID=...   # api 모드만

사용
    python sa.py plan                              계획만 (DB 읽기, 파일 없음)
    python sa.py bids --only 수도권                 예상 입찰가 표본 → bids.csv
    python sa.py build --only 부울경                자리표시 CSV → out/ + groups.csv
    python sa.py build --only 부울경 --gid gid.csv   실제 그룹ID 채운 완성본
    python sa.py verify                            등록분 연결 URL 전수 대조 (api)
    python sa.py apply --only 부울경 --live         API 로 직접 생성

zone: 수도권 · 부울경 · 대경 · 충청 · 호남강원제주
"""

import argparse, base64, csv, datetime, hashlib, hmac, io, json, os, re, sys, time

# ⚠️ 윈도우 콘솔 기본 코드페이지가 cp949 라 «—» · «⚠️» 같은 문자에서 UnicodeEncodeError 로
#    죽는다. 출력만의 문제인데 실행 전체가 멈추므로 여기서 한 번 고정한다.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
from collections import Counter, OrderedDict
from urllib.parse import quote, unquote

# ─────────────────────────────────────────────── 상수

SITE = "https://kadeora.app"
ENC = "cp949"                 # 네이버 템플릿 인코딩. UTF-8 로 쓰면 한글이 전부 깨진다
KW_PER_GROUP = 900            # 네이버 한도 1,000
# 네이버 키워드 길이 한도. **공백을 제거한 뒤** 25자다.
# 실측(부울경 2,319건 업로드): '부산진구 시민공원주변재정비촉진2-2구역 재개발 시공사' 가
# 공백제거 26자라 «혼자 반려»됐다. 등록된 것 중 최장은 25자였다.
# ⚠️ 원문 길이(공백 포함)로 재면 이 한도를 못 잡는다 — 위 키워드는 원문 29자다.
MAX_KW_NOSPACE = 25
ROWS_PER_FILE = 9000          # 네이버 1회 업로드 한도 10,000
MAX_SINGLE = 5                # 그룹당 단일형 소재 한도
MAX_RSA = 3                   # 그룹당 반응형 소재 한도
TPL_DIR = "templates"
OUT = "out"
STATE = "sa_state.json"
BASE = "https://api.searchad.naver.com"

DB_URL   = os.environ.get("SUPABASE_DB_URL", "")
API_KEY  = os.environ.get("NAVER_SA_API_KEY", "")
SECRET   = os.environ.get("NAVER_SA_SECRET_KEY", "")
CUSTOMER = os.environ.get("NAVER_SA_CUSTOMER_ID", "")

# 이미 계정에 있는 광고그룹. 중복 제거 시 이 그룹들의 키워드를 미리 제외한다.
EXISTING_GROUPS = {
    "카더라":       "grp-a001-01-000000072288447",
    "A_분양":       "grp-a001-01-000000072353924",
    "B_입주예정":   "grp-a001-01-000000072353948",
    "C_정비사업":   "grp-a001-01-000000072353971",
    "D_기축":       "grp-a001-01-000000072353993",
    "E_대표":       "grp-a001-01-000000072363917",
    # ⚠️ PL-5 실측: 아래 6그룹이 «같은 캠페인» 에 이미 있다. 문서에는 없었다.
    #    빠뜨리면 확대 때 전량 중복 거부된다(README «하지 말 것» 9번).
    #    실제로 B_입주예정 ↔ 부울경_D_입주예정 사이에 중복 40건이 나 있었다.
    "부울경_A_분양중":     "grp-a001-01-000000072376797",
    "부울경_B_분양예정":   "grp-a001-01-000000072376804",
    "부울경_C_미분양":     "grp-a001-01-000000072376809",
    "부울경_D_입주예정":   "grp-a001-01-000000072376814",
    "부울경_E_정비사업_1": "grp-a001-01-000000072376823",
    "부울경_E_정비사업_2": "grp-a001-01-000000072376826",
}

ZONE = {
    "서울": "수도권", "경기": "수도권", "인천": "수도권",
    "부산": "부울경", "울산": "부울경", "경남": "부울경",
    "대구": "대경",   "경북": "대경",
    "대전": "충청",   "충남": "충청", "충북": "충청", "세종": "충청",
}

SUFFIX = {
 "A_분양중":   ["", "분양가","모델하우스","잔여세대","평면도","청약","견본주택","입주","분양","계약금"],
 "B_분양예정": ["", "분양가","모델하우스","분양일정","청약","견본주택","분양","입주","일반분양","조합원분양"],
 "C_미분양":   ["", "분양가","잔여세대","모델하우스","계약금","미분양"],
 "D_입주예정": ["", "분양권","입주","시세","실거래가","평면도","프리미엄","입주일"],
 "E_정비사업": ["", "조합","시공사","분양","분양가","일정"],
 "F_기축":     ["", "실거래가","시세","매매","전세","평형"],
}

STRIP_PREFIX = tuple(r + " " for r in list(ZONE) + ["광주","전남","전북","강원","제주"])

# 검색어로 어색한 이름 보정
ALIAS = {
 "부산 범천1-1구역 재개발": "범천1-1구역",
 "부산 에코델타 롯데캐슬": "에코델타 롯데캐슬",
 "부산 강서 에코델타 우미린": "에코델타 우미린",
 "울산 남구 달동 롯데캐슬": "울산 달동 롯데캐슬",
 "울산역 KTX 역세권 힐스테이트": "울산역 힐스테이트",
 "부산 서면 서희스타힐스": "서면 서희스타힐스",
 "에코델타시티 금강펜테리움 6BL": "에코델타시티 금강펜테리움",
}

SQL = """
SELECT slug, name, region, sigungu, total_units, content_score, builder, builder_normalized,
  CASE
    WHEN lifecycle_stage IN ('subscription_open','contract_signing','award_announced') THEN 'A_분양중'
    WHEN lifecycle_stage = 'pre_announcement'                                          THEN 'B_분양예정'
    WHEN lifecycle_stage = 'unsold_active'                                             THEN 'C_미분양'
    -- ⚠️ PL-A 판정 ③ — 'construction' 은 «입주예정» 이다. 정비사업이 아니다.
    --    공사중 단지를 정비사업으로 보내던 규칙이 그룹↔단계 역전 1,392건을 만들었다
    --    (PL-5 축1). 운영자가 손으로 B_입주예정 에 넣어 둔 쪽이 «맞았고» 규칙이 틀렸다.
    -- ⚠️ 단, «착공한 정비사업» 은 예외다. 단계만 보고 전부 입주예정으로 보내면
    --    「양정3 재개발」·「엄궁1 재개발」 같은 26현장 218키워드가 반대로 틀린다.
    --    판별자는 lifecycle_stage 가 아니라 site_type 이다 (실측: construction 757 중
    --    subscription 723 · redevelopment 34).
    WHEN lifecycle_stage = 'construction' AND site_type = 'redevelopment'              THEN 'E_정비사업'
    WHEN lifecycle_stage IN ('move_in_ready','move_in_started','construction')         THEN 'D_입주예정'
    WHEN lifecycle_stage IN ('union_established','site_planning','plan_approved',
                             'mgmt_approved','constructor_selected')                   THEN 'E_정비사업'
    ELSE 'F_기축'
  END AS cat,
  CASE WHEN jsonb_typeof(name_variants) = 'array'
       THEN ARRAY(SELECT jsonb_array_elements_text(name_variants))
       ELSE ARRAY[]::text[] END AS variants
FROM apt_sites
WHERE is_active
  AND content_score >= 40
  AND name NOT LIKE '%%미분양'
  AND name !~ '임대|행복주택|사전청약|모집|공공분양|희망타운|분양전환|리츠|^[0-9]'
  AND length(name) >= 6
  AND region IS NOT NULL
ORDER BY region, cat, content_score DESC, coalesce(total_units,0) DESC
"""


# ─────────────────────────────────────────────── 소재 문구

# 지역 + 단계 조합으로 그룹마다 다른 문구를 만든다.
# 문구가 그룹 수만큼 나오지 않으면 수도권과 호남이 같은 광고를 쓰게 된다.
ZONE_LABEL = {"수도권":"수도권","부울경":"부산 울산 경남","대경":"대구 경북",
              "충청":"대전 충청","호남강원제주":"호남 강원 제주"}
ZONE_SHORT = {"수도권":"수도권","부울경":"부울경","대경":"대구경북",
              "충청":"충청","호남강원제주":"호남권"}

INSERT_ALT = {"A_분양중":"분양 현장 정보","B_분양예정":"분양예정 현장","C_미분양":"미분양 잔여세대",
              "D_입주예정":"분양권 시세","E_정비사업":"재개발 재건축","F_기축":"아파트 실거래가"}

BASE_TITLES = {
 "A_분양중":  ["선착순 잔여세대","분양가 한눈에 비교","모델하우스 위치 안내","평면도 타입별 정리",
              "청약 자격 확인","견본주택 안내","입주 일정 정리","계약금 조건 확인",
              "동호수 지정 가능분","중도금 조건 확인","현장 담당자 상담","분양 정보 무료",
              "관심 현장 등록","분양 조건 비교"],
 "B_분양예정":["모집공고 전 선점","예상 분양가 확인","분양 일정 알림","견본주택 오픈 안내",
              "청약 자격 미리 확인","일반분양 물량","조합원 분양가","신규 분양 소식",
              "관심 단지 등록","입주 예정 시기","모델하우스 안내","분양예정 정리",
              "분양 정보 무료","가장 빠른 소식"],
 "C_미분양":  ["미분양 잔여세대","잔여 조건 확인","계약금 조건 확인","동호수 지정 가능",
              "지역별 미분양","남은 세대 확인","분양가 비교하기","입주 가능 물량",
              "모델하우스 안내","현장별 잔여 현황","무료 상담 신청","미분양 정보 무료",
              "계약 조건 정리","실시간 잔여 확인"],
 "D_입주예정":["분양권 시세 확인","입주 일정 한눈에","프리미엄 시세 정리","실거래가 바로 확인",
              "평면도 타입별","전매 조건 확인","입주장 시세 점검","단지별 비교하기",
              "최근 거래 내역","시세 그래프 확인","입주 예정 단지","분양권 정보 무료",
              "입주일 확인하기","프리미엄 비교"],
 "E_정비사업":["구역별 진행 상황","시공사 선정 현황","조합 진행 단계","예상 분양가 확인",
              "재건축 일정 정리","관리처분 단계","구역 정보 한눈에","조합원 분양 정보",
              "사업 단계별 정리","구역별 세대수","정비사업 소식","재개발 정보 무료",
              "진행 단계 비교","구역 검색하기"],
 "F_기축":    ["아파트 실거래가","단지 시세 확인","매매 시세 정리","전세 시세 확인",
              "평형별 시세 비교","실거래 흐름 확인","단지 정보 한곳에","최근 거래 내역",
              "시세 그래프 확인","호가 시세 점검","단지별 비교하기","아파트 정보 무료",
              "실거래가 무료 조회","시세 변동 확인"],
}

BASE_DESCS = {
 "A_분양중":  ["선착순 동호지정과 잔여세대 조건을 {Z} 현장별로 확인하세요",
              "분양가 평면도 모델하우스 위치까지 현장별로 정리해 드립니다",
              "청약 자격과 계약 조건을 한곳에서 비교해 보실 수 있습니다",
              "관심 현장을 등록하면 담당자가 직접 안내해 드립니다"],
 "B_분양예정":["모집공고 전 분양 일정과 예상 분양가를 {Z}에서 먼저 확인하세요",
              "견본주택 오픈과 청약 일정을 미리 받아보실 수 있습니다",
              "일반분양과 조합원 분양 물량을 함께 정리해 드립니다",
              "관심 단지를 등록하면 분양 소식을 놓치지 않습니다"],
 "C_미분양":  ["{Z} 미분양 잔여세대와 계약금 조건을 바로 확인하세요",
              "선착순 동호지정 가능한 물량을 실시간으로 정리해 드립니다",
              "남은 세대와 입주 가능 시기까지 현장별로 확인하세요",
              "미분양 현황을 한곳에서 비교해 보실 수 있습니다"],
 "D_입주예정":["{Z} 입주 예정 단지의 분양권 시세를 한번에 확인하세요",
              "프리미엄 흐름과 최근 실거래가를 단지별로 정리했습니다",
              "평면도와 전매 조건까지 단지별로 확인할 수 있습니다",
              "입주 일정과 시세를 한곳에서 비교해 보세요"],
 "E_정비사업":["{Z} 재개발 재건축 구역별 진행 단계를 확인하세요",
              "구역별 시공사와 예상 분양가를 한곳에서 비교해 보세요",
              "조합 설립부터 관리처분까지 무료로 정리해 드립니다",
              "조합원 분양과 일반분양 일정을 함께 확인하실 수 있습니다"],
 "F_기축":    ["{Z} 아파트 실거래가와 시세 흐름을 한번에 확인하세요",
              "매매와 전세 시세를 평형별로 정리해 보여 드립니다",
              "최근 거래 내역과 호가 흐름까지 확인할 수 있습니다",
              "단지 정보를 한곳에서 비교해 보실 수 있습니다"],
}


def titles_for(zone, cat):
    """제목 15개. 첫 자리는 키워드 삽입, 두 번째에 지역 라벨을 넣어 그룹마다 다르게."""
    zs = ZONE_SHORT[zone]
    head = "{키워드:%s %s}" % (zs, INSERT_ALT[cat])
    if len(zs + " " + INSERT_ALT[cat]) > 15:
        head = "{키워드:%s}" % INSERT_ALT[cat]
    zone_title = ("%s 분양정보" % zs) if cat in ("A_분양중","B_분양예정","C_미분양") else \
                 ("%s 아파트 시세" % zs)
    if len(zone_title) > 15:
        zone_title = "%s 정보" % zs
    return [head, zone_title] + BASE_TITLES[cat]


def descs_for(zone, cat):
    z = ZONE_LABEL[zone]
    out = []
    for d in BASE_DESCS[cat]:
        s = d.replace("{Z}", z)
        if len(s) > 45:                        # 지역명이 길어 넘치면 짧은 라벨로
            s = d.replace("{Z}", ZONE_SHORT[zone])
        if len(s) > 45:
            s = re.sub(r"\{Z\}\s*", "", d).strip()
        out.append(s)
    return out


def single_ads(zone, cat):
    T, D = titles_for(zone, cat), descs_for(zone, cat)
    return [(T[i], D[i % len(D)]) for i in range(MAX_SINGLE)]


def rsa_ads(zone, cat):
    T, D = titles_for(zone, cat), descs_for(zone, cat)
    out = []
    for i in range(MAX_RSA):
        rot = T[1:][i:] + T[1:][:i]
        out.append(((([T[0]] + rot) + [""] * 15)[:15], (D[i:] + D[:i] + [""] * 4)[:4]))
    return out


# ─────────────────────────────────────────────── DB

def fetch_sites():
    if not DB_URL:
        sys.exit("SUPABASE_DB_URL 이 없습니다. Supabase > Settings > Database > Connection string")
    try:
        import psycopg2, psycopg2.extras
    except ImportError:
        sys.exit("pip install psycopg2-binary")
    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(SQL)
            rows = [dict(r) for r in cur.fetchall()]
    for r in rows:
        r["zone"] = ZONE.get(r["region"], "호남강원제주")
    return rows


# ─────────────────────────────────────────────── 키워드

SLUG_KEYWORD = re.compile(r"[가-힣]-[가-힣]")

# 브랜드·등급 접미어. «단독» 으로는 어느 현장도 가리키지 못한다 (PL-A 판정 ①).
# PL-5 실측: 「시그니처」가 39현장 · 「아이파크」 53 · 「푸르지오」 128 · 「힐스테이트」 143 에
# 걸쳐 있었고, 부울경_D_입주예정 노출의 97%(116,000)를 CTR 0.006% 로 이 부류가 먹었다.
# ⚠️ 이 집합은 «보조» 다. 진짜 문지기는 아래 alias_is_fragment() 의 구조 규칙이다 —
#    집합에 없는 새 브랜드가 나와도 그쪽이 잡는다.
SUFFIX_ALONE = frozenset("""
프리미엄 리미티드 시그니처 플래티넘 포레스트 그랑블루 프리미어 아이파크 엘리시움
노르웨이숲 양우내안애 VIEW 뷰 아시아드 리버파크 리치먼드 푸르지오 한라비발디 메가시티
시에르네 아이유쉘 센트레빌 센트럴파크 한화포레나 오션포레 우미린 로제비앙 디에트르
그랑루체 에듀리버 센트럴스카이 한양립스 월드메르디앙 비스타동원 에듀포레 대광로제비앙
힐스테이트 롯데캐슬 에일린의 자이 아이원 더샵 e편한세상 이편한세상 위브 스위첸 하늘채 린 린스트라우스
""".split())


def alias_is_fragment(alias, main=None):
    """검색어가 «브랜드 접미어 단독» 이면 True — 채택하지 않는다 (PL-A 판정 ①).

    판정: 브랜드 접미어 단독 금지 · 「현장명+접미어」 결합만 허용.

    ⚠️ 판정은 «목록» 으로만 한다. 한때 「대표명의 토큰이면 조각」이라는 구조 규칙을 뒀는데
       그것이 「창원자이」(『창원자이 더 스카이』의 첫 토큰) 와 「경남아너스빌」 까지 죽였다 —
       둘 다 지역이 붙어 현장을 좁히는 «살려야 할» 결합형이다.
       test_name_pool.py ① 이 그 과잉 차단을 잡아 이 형태로 되돌렸다.

    ⚠️ 공백이 있으면 무조건 통과다. 「서면 롯데캐슬」 은 결합형이라 살린다.
    """
    if " " in (alias or ""):
        return False
    return alias in SUFFIX_ALONE


# 법인 표기. 「(주)일동」·「삼정건설 주식회사」·「제일건설 주식회사 외 1개업체」 처럼
# «회사 이름» 이 별칭 자리에 앉은 것들이다. 사람은 이렇게 검색하지 않는다.
CORP_MARK = re.compile(r"\(주\)|\(유\)|㈜|㈔|주식회사|유한회사|외\s*\d+\s*(개)?\s*(업체|사|개사)?|\s등$")
# 회사 이름의 «꼬리». 브랜드(롯데캐슬·자이)와 회사(롯데건설·GS건설)를 가르는 신호다.
# ⚠️ 「개발」·「공사」 단독을 넣으면 안 된다 — 「재개발」·「도시개발」이 걸린다.
#    실측: 「양정3 재개발」이 그 규칙에 걸려 죽었다. 회사 꼬리만 «명시» 로 적는다.
CORP_TAIL = re.compile(r"(건설|산업개발|이앤씨|종합건설|토건|건업|주택공사|도시공사|건설산업)$")


def alias_is_corp(raw, cleaned, main, builders=()):
    """별칭이 «시공사 법인명» 인가 — 채택하지 않는다 (CV-B ①-2).

    실측(2026-09-02): 부울경 광고 적격 275현장에서 이 부류가 짧은순 «2순위» 에 앉아 있었다.
    「사하구 두산건설(주)」 는 kw_name() 이 괄호를 지우면 「사하구 두산건설」 이 되어
    지역+시공사 일반 키워드로 나간다 — 그 현장을 가리키지 못하는 돈 새는 키워드다.

    ⚠️ 판정은 «법인 표기» 라는 신호로만 한다. 이름 구조 규칙이 아니다 —
       「창원자이」·「경남아너스빌」을 죽였던 그 규칙과 다른 축이다.
    ⚠️ 괄호는 kw_name() 이 지우므로 «원문» 도 함께 본다. 지운 뒤만 보면 「(주)」가 사라져
       통과한다.
    ⚠️ 대표명 자체가 그 문자열을 품고 있으면 건드리지 않는다 — 회사명이 곧 단지명인 경우다.
    """
    bare_main = (main or "").replace(" ", "")
    for text in (raw or "", cleaned or ""):
        if not text:
            continue
        if CORP_MARK.search(text) and not CORP_MARK.search(bare_main):
            return True
    words = (cleaned or "").split()
    if any(CORP_TAIL.search(w) for w in words) and not CORP_TAIL.search(bare_main):
        return True
    bare = (cleaned or "").replace(" ", "")
    for b in builders:
        b = re.sub(r"\(주\)|㈜|주식회사|\s", "", b or "")
        if len(b) >= 3 and b in bare and b not in bare_main:
            return True
    return False


def reject_slug_keywords(keywords):
    """slug 형태 키워드를 «생성 단계에서» 걸러 낸다. 뚫려도 나갈 수 없게 하는 마지막 문이다.

    kw_name() 이 이미 한글-한글 하이픈을 지우지만, ALIAS·name_variants 처럼 다른 경로로
    들어온 값이 있을 수 있다. R3 이전에는 그런 값 132건이 «그대로 업로드돼» 있었다.

    ⚠️ 판정은 한글-한글 경계만이다. 하이픈 전체로 걸면 정상 검색어 297건이 함께 죽는다
       (`금곡2-1구역재개발` · `에코델타시티16블록중흥S-클래스`).
    """
    ok, bad = [], []
    for k in keywords:
        (bad if SLUG_KEYWORD.search(k) else ok).append(k)
    return ok, bad


def kw_name(name):
    """검색어로 쓸 이름. ⚠️ slug 를 넣지 말 것 — name 을 넣는다.

    R3: 광고에 `동래-반도-유보라` 같은 «slug 형태» 키워드가 132건 나가 있었다.
    아무도 하이픈을 넣어 검색하지 않으므로 «노출이 날 수 없는» 키워드다.
    아래 첫 줄이 한글과 한글 사이의 하이픈을 공백으로 바꿔 그 경로를 끊는다.

    ⚠️ 하이픈을 «전부» 지우면 안 된다. `에코델타시티16블록중흥S-클래스` ·
       `금곡2-1구역재개발` 처럼 하이픈이 정상인 검색어가 297건 있다.
       한글-한글 경계만 건드린다.
    """
    n = re.sub(r"(?<=[가-힣])-(?=[가-힣])", " ", name or "")
    n = ALIAS.get(n, n)
    n = re.sub(r"\s*\([^)]*\)\s*", " ", n)            # 괄호 제거
    n = re.sub(r"[^0-9A-Za-z가-힣\s\-]", " ", n)      # 쉼표·중점 등 금지문자 제거
    n = re.sub(r"\s+", " ", n).strip()
    for p in STRIP_PREFIX:
        if n.startswith(p) and len(n) > len(p) + 5:
            n = n[len(p):]
    return n.strip()


def existing_keywords():
    """계정에 이미 등록된 키워드. 중복 거부를 막기 위해 미리 제외한다."""
    if not (API_KEY and SECRET and CUSTOMER):
        return set()
    out = set()
    for name, gid in EXISTING_GROUPS.items():
        try:
            for k in call("GET", "/ncc/keywords", params={"nccAdgroupId": gid}) or []:
                out.add((k.get("keyword") or "").replace(" ", ""))
        except Exception as e:
            print("  기존 키워드 조회 실패 %s: %s" % (name, str(e)[:100]))
    return out


def name_pool(site, max_alias=4):
    """검색어로 쓸 이름 묶음. 대표명 1개 + name_variants 별칭.

    DB의 name_variants 에 현장당 평균 4.8개가 이미 채워져 있다.
    '양정3 재개발' → '양정3구역' '양정 롯데캐슬' '서면 롯데캐슬' …
    사람들은 구역명이 아니라 브랜드명으로 검색하므로 이걸 빼면 유입을 크게 놓친다.

    별칭 채택 기준
      - 4~30자                     짧으면 일반명사, 길면 검색되지 않음
      - 대표명과 공백제거 후 다름   표기 변형은 네이버가 어차피 합친다
      - 짧은 것 우선               '서면 롯데캐슬'이 '부산진구 양정3 재개발'보다 검색량이 많다
      - 시공사 법인명 제외         '사하구 두산건설(주)' 는 그 현장을 가리키지 못한다

    ⚠️ 「짧은 것 우선」이 이 문들을 «필수» 로 만든다. 조각·법인명은 대체로 짧아서
       거르지 않으면 그 현장의 1~2순위 키워드가 된다 (CV-B ① · ①-2 실측).
    """
    main = kw_name(site["name"])
    # ⚠️ 이름 «자체» 가 브랜드 접미어뿐인 현장이 실제로 있다(『월드메르디앙』·『대광로제비앙』).
    #    그 이름으로 만든 키워드는 14~22개 현장에 걸쳐 어느 곳도 가리키지 못한다.
    out = [main] if len(main) >= 4 and not alias_is_fragment(main) else []
    seen = {main.replace(" ", "")}
    builders = [b for b in (site.get("builder"), site.get("builder_normalized")) if b]
    cands = []
    for v in (site.get("variants") or []):
        n = kw_name(v)
        k = n.replace(" ", "")
        if not (4 <= len(n) <= 30) or k in seen:
            continue
        if alias_is_fragment(n, main):      # PL-A 판정 ① — 접미어 단독 금지
            continue
        if alias_is_corp(v, n, main, builders):   # CV-B ①-2 — 시공사 법인명 금지
            continue
        seen.add(k); cands.append(n)
    cands.sort(key=lambda x: (len(x), x))
    return out + cands[:max_alias]


def build_plan(sites, only=None, skip_existing=True, cats=None, max_alias=4):
    seen = set()
    if skip_existing:
        seen |= existing_keywords()
        if seen:
            print("기존 계정 키워드 %d개를 제외 목록에 넣었습니다." % len(seen))

    buckets = OrderedDict()
    for s in sites:
        if only and s["zone"] != only:
            continue
        if cats and s["cat"] not in cats:
            continue
        buckets.setdefault((s["zone"], s["cat"]), []).append(s)

    slug_dropped = []
    groups = []
    for (zone, cat), items in buckets.items():
        cur, n, idx = [], 0, 1
        for s in items:
            names = name_pool(s, max_alias)
            if not names:
                continue
            kws = []
            for bi, base in enumerate(names):
                # 대표명은 접미어 전체, 별칭은 단독 + 상위 2개만 (조합 폭발 방지)
                sufs = SUFFIX[cat] if bi == 0 else SUFFIX[cat][:3]
                for suf in sufs:
                    k = (base + " " + suf).strip()
                    kk = k.replace(" ", "")       # 네이버는 공백을 제거해 저장한다
                    # 한도를 넘는 키워드는 «만들지 않는다». 만들어 두면 업로드에서
                    # 그 한 줄만 반려되고 성공건수가 신청건수와 어긋난다.
                    if kk in seen or not (2 <= len(k) <= 50) or len(kk) > MAX_KW_NOSPACE:
                        continue
                    seen.add(kk); kws.append(k)
            kws, dropped = reject_slug_keywords(kws)
            if dropped:
                slug_dropped.extend(dropped)
            if not kws:
                continue
            if n + len(kws) > KW_PER_GROUP and cur:
                groups.append({"name": "%s_%s_%d" % (zone, cat, idx),
                               "zone": zone, "cat": cat, "sites": cur})
                cur, n, idx = [], 0, idx + 1
            cur.append({"slug": s["slug"], "name": s["name"], "keywords": kws,
                        "url": SITE + quote("/apt/" + s["slug"])})
            n += len(kws)
        if cur:
            nm = "%s_%s" % (zone, cat) if idx == 1 else "%s_%s_%d" % (zone, cat, idx)
            groups.append({"name": nm, "zone": zone, "cat": cat, "sites": cur})
    if slug_dropped:
        print("[!] slug 형태 키워드 %d개를 생성에서 제외했습니다: %s"
              % (len(slug_dropped), ", ".join(slug_dropped[:5])))
    return groups


# ─────────────────────────────────────────────── 검증

def validate(groups):
    bad = Counter()
    seen = set()
    for g in groups:
        n = sum(len(x["keywords"]) for x in g["sites"])
        if n > 1000: bad["그룹당 1000 초과"] += 1
        if "<" in g["name"] or ">" in g["name"]: bad["그룹명 금지문자"] += 1
        for x in g["sites"]:
            if not x["url"].startswith(SITE + "/apt/"): bad["URL 형식"] += 1
            for k in x["keywords"]:
                if re.search(r"[^0-9A-Za-z가-힣\s\-]", k): bad["키워드 특수문자"] += 1
                if k != k.strip():                        bad["앞뒤 공백"] += 1
                if not (2 <= len(k) <= 50):               bad["길이 범위"] += 1
                if re.search(r"할인|최저|무료 증정|공짜|특가", k): bad["금지 표현"] += 1
                kk = k.replace(" ", "")
                # 생성 단계가 이미 걸렀으므로 여기서 잡히면 그쪽이 새는 것이다.
                if len(kk) > MAX_KW_NOSPACE:              bad["공백제거 25자 초과"] += 1
                if kk in seen: bad["중복"] += 1
                seen.add(kk)
        for t, d in single_ads(g["zone"], g["cat"]):
            chk = t[t.find(":") + 1:-1] if t.startswith("{키워드") else t
            if len(chk) > 15:          bad["소재 제목 15자 초과"] += 1
            if not (20 <= len(d) <= 45): bad["소재 설명 자수"] += 1
        for ts, ds in rsa_ads(g["zone"], g["cat"]):
            for t in ts[1:]:
                if t and len(t) > 15:  bad["반응형 제목 15자 초과"] += 1
            for d in ds:
                if d and not (20 <= len(d) <= 45): bad["반응형 설명 자수"] += 1
    return bad


# ─────────────────────────────────────────────── CSV

def header(kind):
    path = os.path.join(TPL_DIR, {"kw": "ko_add_keyword_template.csv",
                                  "ad": "ko_add_ad_template.csv",
                                  "rsa": "ko_add_rsa_ad_template.csv"}[kind])
    if not os.path.exists(path):
        sys.exit("템플릿이 없습니다: %s\n네이버 대량관리에서 받아 %s/ 에 두세요." % (path, TPL_DIR))
    return open(path, "rb").read().decode(ENC).split("\r\n")[:6]


def write_csv(path, head, rows):
    buf = io.StringIO()
    csv.writer(buf, quoting=csv.QUOTE_ALL, lineterminator="\r\n").writerows(rows)
    open(path, "wb").write(("\r\n".join(head) + "\r\n" + buf.getvalue()).encode(ENC))


def cmd_build(args):
    groups = build_plan(fetch_sites(), args.only, cats=args.cats.split(",") if args.cats else None, max_alias=args.max_alias)
    bad = validate(groups)
    print("검증: %s" % (dict(bad) if bad else "이상 없음"))
    if bad:
        sys.exit("검증 실패 — 파일을 만들지 않았습니다.")

    gid = {}
    if args.gid:
        # ⚠️ 입력 형식은 «광고그룹명,grp-...» 2열이다 (gid.csv).
        #    groups.csv 를 넘기지 말 것 — 2번째 열이 키워드 수라 아래 조건에 걸리지 않고
        #    0개가 로드된다. 실수해도 조용히 지나가므로 아래에서 소리를 낸다.
        for r in csv.reader(open(args.gid, encoding="utf-8-sig")):
            if len(r) >= 2 and r[1].strip().startswith("grp-"):
                gid[r[0].strip()] = r[1].strip()
        print("그룹ID %d개 로드" % len(gid))
        # 0건은 형식을 잘못 넘긴 것이다. 조용히 자리표시 파일을 내보내면 전량 반려로 이어진다.
        if not gid:
            sys.exit("--gid 파일에서 그룹ID를 하나도 못 읽었습니다: %s\n"
                     "2번째 열이 grp- 로 시작해야 합니다. groups.csv(2번째 열=키워드 수)를 넘기지 마세요.\n"
                     "  올바른 형식:  광고그룹명,grp-a001-01-000000000000000" % args.gid)
        # 일부만 채운 건 «그룹별로 나눠 올리는» 정상 사용일 수 있으므로 막지 않고 알린다.
        missing = [g["name"] for g in groups if g["name"] not in gid]
        if missing:
            print("!! ID 없는 그룹 %d개 — 이 그룹 행은 GID_ 자리표시로 나갑니다. 그대로 올리면 반려됩니다:"
                  % len(missing))
            for m in missing:
                print("     %s" % m)

    os.makedirs(OUT, exist_ok=True)

    with open("groups.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["광고그룹명", "키워드", "현장", "기본입찰가", "그룹ID"])
        for g in groups:
            w.writerow([g["name"], sum(len(x["keywords"]) for x in g["sites"]),
                        len(g["sites"]), args.bid, gid.get(g["name"], "")])

    rows = []
    for g in groups:
        for x in g["sites"]:
            for k in x["keywords"]:
                rows.append([gid.get(g["name"], "GID_" + g["name"]), k,
                             x["url"], x["url"], str(args.bid)])
    hk = header("kw")
    for i in range(0, len(rows), ROWS_PER_FILE):
        p = "%s/01_키워드_%02d.csv" % (OUT, i // ROWS_PER_FILE + 1)
        write_csv(p, hk, rows[i:i + ROWS_PER_FILE]); print("%s  %d행" % (p, len(rows[i:i + ROWS_PER_FILE])))

    ads = [[gid.get(g["name"], "GID_" + g["name"]), t, d, SITE, SITE, ""]
           for g in groups for t, d in single_ads(g["zone"], g["cat"])]
    write_csv("%s/02_소재단일형.csv" % OUT, header("ad"), ads)
    print("%s/02_소재단일형.csv  %d행" % (OUT, len(ads)))

    rsa = [[gid.get(g["name"], "GID_" + g["name"]), SITE, SITE] + ts + ds + ["1", "", "", "1", ""]
           for g in groups for ts, ds in rsa_ads(g["zone"], g["cat"])]
    write_csv("%s/03_소재반응형.csv" % OUT, header("rsa"), rsa)
    print("%s/03_소재반응형.csv  %d행" % (OUT, len(rsa)))

    print("\n광고그룹 %d · 현장 %d · 키워드 %d" %
          (len(groups), sum(len(g["sites"]) for g in groups), len(rows)))
    if not gid:
        # ⚠️ --gid 는 groups.csv 를 받지 못한다. 아래 로더가 «2번째 열»에서 grp- 를 찾는데
        #    groups.csv 의 2번째 열은 키워드 수다. 그대로 넘기면 0개가 로드되고
        #    자리표시가 남은 파일이 조용히 나온다 — 그걸 올리면 전량 반려된다.
        #    그래서 이름과 ID «둘만» 있는 별도 파일을 쓴다.
        print("자리표시 상태입니다. groups.csv 이름대로 네이버에 그룹을 만든 뒤,")
        print("이름과 그룹ID 2열짜리 gid.csv 를 따로 만들어 넘기세요.")
        print("  gid.csv 예시 (헤더 없이, 쉼표 2열):")
        for g in groups[:2]:
            print("    %s,grp-a001-01-000000000000000" % g["name"])
        print("  python sa.py build --only %s --cats %s --max-alias %d --bid %d --gid gid.csv"
              % (args.only or "", args.cats or "", args.max_alias, args.bid))
        print("생성 후 반드시 확인: 완성본에 GID_ 로 시작하는 행이 0건이어야 한다.")


def cmd_plan(args):
    groups = build_plan(fetch_sites(), args.only, skip_existing=False,
                        cats=args.cats.split(",") if args.cats else None,
                        max_alias=args.max_alias)
    print("%-30s %8s %6s" % ("광고그룹", "키워드", "현장"))
    tk = 0
    for g in groups:
        n = sum(len(x["keywords"]) for x in g["sites"]); tk += n
        print("%-30s %8d %6d%s" % (g["name"], n, len(g["sites"]), "  !!초과" if n > 1000 else ""))
    print("\n그룹 %d · 현장 %d · 키워드 %d · 소재 %d" %
          (len(groups), sum(len(g["sites"]) for g in groups), tk,
           len(groups) * (MAX_SINGLE + MAX_RSA)))
    print("업로드 파일 수: 키워드 %d개" % (-(-tk // ROWS_PER_FILE)))


# ─────────────────────────────────────────────── API

def _hdr(method, path):
    ts = str(round(time.time() * 1000))
    sig = base64.b64encode(hmac.new(SECRET.encode(),
          ("%s.%s.%s" % (ts, method, path)).encode(), hashlib.sha256).digest())
    return {"Content-Type": "application/json; charset=UTF-8", "X-Timestamp": ts,
            "X-API-KEY": API_KEY, "X-Customer": str(CUSTOMER), "X-Signature": sig}


def call(method, path, params=None, body=None, retries=5):
    import requests
    for i in range(retries):
        r = requests.request(method, BASE + path, params=params, json=body,
                             headers=_hdr(method, path), timeout=40)
        if r.status_code == 429:
            time.sleep(2 ** i); continue
        if r.status_code >= 400:
            raise RuntimeError("%s %s → %s %s" % (method, path, r.status_code, r.text[:300]))
        return r.json() if r.content else None
    raise RuntimeError("429 반복")


def cmd_bids(args):
    """표본 예상 입찰가. 기축을 만들기 전에 반드시 이걸 먼저 볼 것."""
    if not API_KEY: sys.exit("NAVER_SA_* 환경변수가 필요합니다.")
    groups = build_plan(fetch_sites(), args.only, skip_existing=False, max_alias=args.max_alias)
    kws = sorted({x["keywords"][0] for g in groups for x in g["sites"][:20]})
    print("표본 %d개 조회" % len(kws))
    rows = {k: {"keyword": k} for k in kws}
    for dev in ("PC", "MOBILE"):
        for i in range(0, len(kws), 100):
            ch = kws[i:i + 100]
            try:
                r = call("POST", "/estimate/average-position-bid/keyword",
                         body={"device": dev, "items": [{"key": k, "position": 1} for k in ch]})
                for it in r.get("estimate", []): rows[it["keyword"]]["%s_1위" % dev] = it.get("bid")
            except Exception as e: print("  1위(%s) 실패 %s" % (dev, str(e)[:80]))
            try:
                r = call("POST", "/estimate/exposure-minimum-bid/keyword",
                         body={"device": dev, "period": "MONTH", "items": ch})
                for it in r.get("estimate", []): rows[it["keyword"]]["%s_최소" % dev] = it.get("bid")
            except Exception as e: print("  최소(%s) 실패 %s" % (dev, str(e)[:80]))
            time.sleep(0.3)
    cols = ["keyword", "PC_1위", "PC_최소", "MOBILE_1위", "MOBILE_최소"]
    with open("bids.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader()
        for k in kws: w.writerow({c: rows[k].get(c, "") for c in cols})
    vals = [v.get("PC_최소") for v in rows.values() if isinstance(v.get("PC_최소"), int)]
    if vals:
        vals.sort()
        print("PC 최소노출 입찰가  중앙값 %d원 / 상위10%% %d원" %
              (vals[len(vals)//2], vals[int(len(vals)*0.9)]))
    print("bids.csv 저장. 이 값으로 그룹별 --bid 를 정한다.")


def cmd_apply(args):
    if not API_KEY: sys.exit("NAVER_SA_* 환경변수가 필요합니다.")
    groups = build_plan(fetch_sites(), args.only, cats=args.cats.split(",") if args.cats else None, max_alias=args.max_alias)
    bad = validate(groups)
    if bad: sys.exit("검증 실패: %s" % dict(bad))
    st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {"adgroups": {}}
    live = args.live; tag = "[실제]" if live else "[예행]"

    ch = [c for c in call("GET", "/ncc/channels")
          if c.get("channelTp") == "WEBSITE" and "kadeora.app" in (c.get("channelKey") or "")]
    if not ch: sys.exit("kadeora.app 비즈채널을 못 찾았습니다.")
    ch_id = ch[0]["nccBusinessChannelId"]

    cname = "카더라_전국_%s" % (args.only or "ALL")
    camps = {c["name"]: c["nccCampaignId"] for c in call("GET", "/ncc/campaigns")}
    if cname in camps: cid = camps[cname]
    elif live:
        cid = call("POST", "/ncc/campaigns", body={"name": cname, "campaignTp": "WEB_SITE",
                                                  "customerId": int(CUSTOMER)})["nccCampaignId"]
    else: cid = "(예행)"

    ok = fail = 0
    for g in groups:
        n = sum(len(x["keywords"]) for x in g["sites"])
        if g["name"] in st["adgroups"]:
            print("건너뜀   %-30s" % g["name"]); continue
        if not live:
            print("생성예정 %-30s 키워드%5d" % (g["name"], n)); ok += 1; continue
        try:
            grp = call("POST", "/ncc/adgroups", body={
                "name": g["name"], "nccCampaignId": cid,
                "pcChannelId": ch_id, "mobileChannelId": ch_id,
                "bidAmt": args.bid, "userLock": True})
            gidv = grp["nccAdgroupId"]; st["adgroups"][g["name"]] = gidv
            json.dump(st, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

            batch = [{"keyword": k, "useGroupBidAmt": True,
                      "links": {"pc": {"final": x["url"]}, "mobile": {"final": x["url"]}}}
                     for x in g["sites"] for k in x["keywords"]]
            for i in range(0, len(batch), 100):
                call("POST", "/ncc/keywords", params={"nccAdgroupId": gidv}, body=batch[i:i+100])
                time.sleep(0.2)

            for t, d in single_ads(g["zone"], g["cat"]):
                call("POST", "/ncc/ads", body={"nccAdgroupId": gidv, "type": "TEXT_45",
                    "ad": {"headline": t, "description": d,
                           "pc": {"final": SITE}, "mobile": {"final": SITE}}})
            print("생성완료 %-30s %s 키워드%5d" % (g["name"], gidv, len(batch)))
            ok += 1; time.sleep(0.4)
        except Exception as e:
            fail += 1; print("실패     %-30s %s" % (g["name"], str(e)[:160]))
    print("\n%s 성공 %d / 실패 %d" % (tag, ok, fail))
    if live: print("전 그룹 OFF 상태입니다. 검수 통과 후 켜세요. 다음: sa.py verify")


def cmd_verify(args):
    if not API_KEY: sys.exit("NAVER_SA_* 환경변수가 필요합니다.")
    valid = {s["slug"] for s in fetch_sites()}
    st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {"adgroups": {}}
    targets = dict(EXISTING_GROUPS); targets.update(st["adgroups"])
    total = nourl = bad = 0
    for name, gidv in targets.items():
        try:
            for k in call("GET", "/ncc/keywords", params={"nccAdgroupId": gidv}) or []:
                total += 1
                u = ((k.get("links") or {}).get("pc") or {}).get("final") or ""
                if not u: nourl += 1; continue
                if "/apt/" not in u: continue
                slug = unquote(u.split("/apt/", 1)[1])
                if slug not in valid:
                    bad += 1
                    print("깨짐  %-24s %-30s %s" % (name, k.get("keyword"), slug))
        except Exception as e:
            print("조회실패 %s %s" % (name, str(e)[:100]))
    print("\n총 %d · URL없음 %d · DB에 없는 슬러그 %d" % (total, nourl, bad))
    print("전수 통과." if bad == 0 and nourl == 0 else "!! 위 키워드는 /apt/search 로 튕깁니다.")


def rollback_gate(gidv):
    """이 그룹을 지워도 «되는가». 안 되면 이유 문자열을 낸다 (None 이면 통과).

    ⛔ PL-A. `sa_state.json` 은 «등록 직후 되돌리기» 용으로 만들었는데, 그 파일이 지금
       가동 중인 부울경 6그룹(키워드 2,318 · 캠페인 노출 최대치)을 가리키고 있다.
       `rollback --live` 한 줄이 라이브 삭제 버튼이 돼 있었다 — 그래서 문을 단다.

    통과 조건은 «켜진 적 없는 그룹» 이다:
      ① userLock=True   — apply 가 만든 직후 상태 그대로 (한 번도 켜지지 않았다)
      ② 14일 노출 0     — 실제로 나간 적이 없다
    ⚠️ 둘 다여야 한다. 지금 꺼져 있다는 것은 「켜진 적 없다」가 아니다.
    """
    try:
        g = call("GET", "/ncc/adgroups/" + gidv)
    except Exception as e:
        return "그룹 조회 실패 — 확인 전에는 지우지 않는다 (%s)" % str(e)[:80]
    if g.get("userLock") is not True:
        return "userLock=False — 켜져 있거나 켜진 적 있는 그룹이다"
    try:
        kws = call("GET", "/ncc/keywords", params={"nccAdgroupId": gidv}) or []
    except Exception as e:
        return "키워드 조회 실패 (%s)" % str(e)[:80]
    ids = [k["nccKeywordId"] for k in kws]
    until = datetime.date.today() - datetime.timedelta(days=1)
    since = until - datetime.timedelta(days=13)
    imp = 0
    for i in range(0, len(ids), 100):
        try:
            r = call("GET", "/stats", params={
                "ids": ids[i:i+100], "fields": json.dumps(["impCnt"]),
                "timeRange": json.dumps({"since": str(since), "until": str(until)})})
        except Exception as e:
            return "실적 조회 실패 — 확인 전에는 지우지 않는다 (%s)" % str(e)[:80]
        for row in (r.get("data") if isinstance(r, dict) else r) or []:
            imp += int(row.get("impCnt") or 0)
        time.sleep(0.2)
    if imp > 0:
        return "14일 노출 %d — 실제로 나가고 있는 그룹이다 (키워드 %d)" % (imp, len(ids))
    return None


def cmd_rollback(args):
    st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {"adgroups": {}}
    blocked = 0
    for name, gidv in list(st["adgroups"].items()):
        why = rollback_gate(gidv)
        if why:
            blocked += 1
            print("⛔ 거부  %-22s %s — %s" % (name, gidv, why))
            continue
        if not args.live: print("삭제예정 %s %s" % (name, gidv)); continue
        try:
            call("DELETE", "/ncc/adgroups/" + gidv)
            del st["adgroups"][name]
            json.dump(st, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print("삭제완료 %s" % name)
        except Exception as e: print("삭제실패 %s %s" % (name, str(e)[:100]))
    if blocked:
        print("")
        print("⛔ %d개 그룹이 게이트에 막혔다. 이 명령으로는 지울 수 없다." % blocked)
        print("   정말 지워야 한다면 사람이 광고주센터에서 지우고 sa_state.json 에서 줄을 뺀다 —")
        print("   그 판단을 스크립트가 대신하지 않는다.")


# ─────────────────────────────────────────────── 록아웃 캘린더

# 광고 계정에 «쓰는» 명령이 돌면 안 되는 창.
#
# ⚠️ 창 안에서 광고를 건드리면 그 기간의 지표가 «무엇 때문에 움직였는지» 를 잃는다.
#    9/2 CV-A 본실행(시드 2건·조각 355 정리·법인명 가드)의 효과를 재려면 그 뒤 며칠은
#    광고 쪽 변수를 0으로 두어야 한다. 록아웃은 게으름이 아니라 «측정 설계» 다.
# ⚠️ 날짜를 코드 바깥(캘린더)에 두는 이유: 창을 여는 것도 «의도한 행위» 로 남기기 위해서다.
#    급해서 --ignore-lockout 을 붙인 실행은 로그에 그 사실이 크게 남는다.
LOCKOUTS = [
    ("2026-09-03", "2026-09-06",
     "PL-B′ 측정 창 — 9/2 CV-A 본실행 지표 관측. 첫 sa-sync 회전은 이 창을 «닫은 뒤» 돈다"),
]

# 계정을 바꾸는 명령. 읽기(plan·verify·scan)는 록아웃과 무관하다.
def lockout_active(today=None):
    """오늘이 록아웃 창 안이면 (시작, 끝, 사유). 아니면 None."""
    d = today or datetime.date.today().isoformat()
    for start, end, why in LOCKOUTS:
        if start <= d <= end:
            return (start, end, why)
    return None


def assert_lockout_clear(args):
    """계정에 «쓰기» 전에 부르는 문. --live 가 없으면 애초에 아무것도 바꾸지 않는다."""
    if not getattr(args, "live", False):
        return
    win = lockout_active()
    if not win:
        return
    start, end, why = win
    if getattr(args, "ignore_lockout", False):
        print("!! 록아웃(%s~%s)을 «의도적으로» 무시하고 실행합니다 — %s" % (start, end, why))
        return
    msg = [
        "",
        "록아웃 중입니다: %s ~ %s" % (start, end),
        "  사유: %s" % why,
        "  · 읽기 전용(plan·verify·scan)은 그대로 됩니다.",
        "  · 첫 회전을 이 창 «안에서» 돌려야 한다면 LOCKOUTS 의 끝 날짜를 줄이거나"
        "  --ignore-lockout 을 붙이세요.",
        "    어느 쪽이든 «창을 연 것이 의도였다» 는 기록이 남는 것이 목적입니다.",
    ]
    sys.exit(chr(10).join(msg))


# ─────────────────────────────────────────────── scan (CV-B ①·①-2 계정 실존)

SCAN_CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "..", "..", "docs", "m6", "CVB_광고_조각법인명_스캔.csv")

# 붙여쓴 키워드에서도 살아남는 회사 신호. 네이버가 공백을 지워도 「두산건설」은 남는다.
# 생성기(generate_apt_name_variants_jsonb)와 «같은» 브랜드 목록. 「<한 글자> + 브랜드」가
# CV-B ① 에서 지운 ⓑ형이다 — 「외 데시앙」·「남 포레나」·「중 더샵」.
BRANDS = frozenset("""
래미안 자이 힐스테이트 푸르지오 아크로 더샵 롯데캐슬 포레나 호반써밋 아이파크 두산위브 데시앙 비스타
""".split())

CORP_GLUED = re.compile(r"(주식회사|건설|이앤씨|산업개발|종합건설|토건|주택공사|도시공사)")


def keyword_flags(kw, main=None):
    """계정에 «이미 올라간» 키워드 하나의 오염 사유. 없으면 빈 목록.

    ⚠️ 생성기를 고쳐도 계정에 나가 있는 것은 스스로 사라지지 않는다. 그래서 만드는 층·
       내보내는 층에 더해 «이미 나간 층» 을 한 번 훑는 문이 따로 필요하다.
    ⚠️ 판정은 name_pool 이 쓰는 것과 «같은 함수» 를 부른다. 여기서 조건을 다시 쓰면
       두 판정이 갈린다(_load_off_targets 의 교훈과 같다).
    """
    why = []
    if SLUG_KEYWORD.search(kw or ""):
        why.append("slug형")
    # ⚠️ 「한 글자 토큰이면 조각」이 아니다 — 「가평 센트럴파크 더 스카이」의 「더」,
    #    「우미 린」의 「린」은 이름에 원래 있다. 반대로 「외 데시앙」은 «대표명에 외 가 있어도»
    #    조각이다(외동→외). 그래서 위치·모양으로 가른다 — CV-B ① 정리에서 실제로 지운
    #    두 형태 그대로다: ⓐ「<한 글자> + 대표명」 ⓑ「<한 글자> + 브랜드」.
    #    테스트 ⑦ 이 이 자리를 두 번 잡았다(면제 과잉 → 차단 과잉).
    bare_main = (main or "").replace(" ", "")
    toks = (kw or "").split()
    if toks and len(toks[0]) == 1 and re.search(r"[가-힣]", toks[0]):
        rest = "".join(toks[1:])
        if not bare_main:
            # 대표명을 못 찾았으면 면제 여부를 «모른다». OFF 로 바로 넘기지 않게 표시한다.
            why.append("조각(대표명 미상)")
        elif rest == bare_main or (len(toks) == 2 and toks[1] in BRANDS):
            why.append("조각")
    if alias_is_corp(kw, kw, main or "") or (
            " " not in (kw or "") and CORP_GLUED.search(kw or "")
            and not CORP_GLUED.search((main or "").replace(" ", ""))):
        why.append("법인명")
    return why


def cmd_scan(args):
    """계정에 나가 있는 키워드를 조각·법인명·slug형으로 훑는다. «읽기 전용» 이다.

    산출물은 off 가 그대로 먹는 CSV 다(키워드 ID·키워드·광고그룹 이름·사유).
    ⚠️ 삭제가 아니라 OFF 다 — 되돌릴 수 있어야 노출이 붙은 뒤 다시 판단할 수 있다.
    """
    if not API_KEY:
        sys.exit("NAVER_SA_* 환경변수가 필요합니다.")
    names = {}
    try:
        for s_ in fetch_sites():
            names[s_["slug"]] = s_["name"]
    except SystemExit:
        print("(DB 미접속 — 대표명 면제 없이 검사합니다. 오탐이 늘 수 있습니다.)")

    st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {"adgroups": {}}
    targets = dict(EXISTING_GROUPS); targets.update(st.get("adgroups", {}))

    rows, total = [], 0
    for gname, gid in targets.items():
        try:
            for k in call("GET", "/ncc/keywords", params={"nccAdgroupId": gid}) or []:
                total += 1
                kw = (k.get("keyword") or "").strip()
                u = ((k.get("links") or {}).get("pc") or {}).get("final") or ""
                slug = unquote(u.split("/apt/", 1)[1]) if "/apt/" in u else ""
                why = keyword_flags(kw, names.get(slug))
                if why:
                    rows.append((k.get("nccKeywordId") or "", kw, gname, "·".join(why),
                                 "OFF" if k.get("userLock") is True else "ON"))
        except Exception as e:
            print("조회실패 %s %s" % (gname, str(e)[:100]))

    on = [r for r in rows if r[4] == "ON"]
    print("검사 %d개 · 오염 %d개 (그중 ON %d)" % (total, len(rows), len(on)))
    by = {}
    for r in rows:
        by[r[3]] = by.get(r[3], 0) + 1
    for k in sorted(by, key=lambda x: -by[x]):
        print("   %-16s %4d" % (k, by[k]))
    for r in on[:20]:
        print("   ON  %-14s %-22s %s" % (r[3], r[2][:20], r[1][:32]))
    if len(on) > 20:
        print("   ... 외 %d건" % (len(on) - 20))

    out = args.csv
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with io.open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["키워드 ID", "키워드", "광고그룹 이름", "사유", "현재상태"])
        for r in rows:
            w.writerow(list(r))
    print("")
    print("CSV: %s" % os.path.normpath(out))
    print("끄려면: python tools/naver-sa/sa.py off --csv \"%s\" --live" % os.path.normpath(out))
    print("⚠️ OFF 는 되돌릴 수 있다. 삭제하지 않는다.")


# ─────────────────────────────────────────────── off (R3-1)

OFF_CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "..", "..", "docs", "m6", "R3_광고_중단대상.csv")


def _load_off_targets(path):
    """중단 대상 CSV → [(keyword_id, keyword, adgroup, reason)]

    ⚠️ 이 파일 «안에 있는 키워드 ID 만» 대상이다. 조건을 여기서 다시 계산하지 않는다 —
       CSV 가 이미 검토를 거친 확정 목록이고, 코드가 조건을 또 만들면 두 판정이 갈린다.
    """
    if not os.path.exists(path):
        sys.exit("중단 대상 CSV 가 없습니다: %s (먼저 export_off.py 로 만드세요)" % path)
    rows = []
    # 다운로드 양식과 같은 UTF-8 BOM 이다.
    with io.open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            kid = (r.get("키워드 ID") or "").strip()
            if not kid:
                continue
            rows.append((kid, (r.get("키워드") or "").strip(),
                         (r.get("광고그룹 이름") or "").strip(), (r.get("사유") or "").strip()))
    ids = [x[0] for x in rows]
    if len(ids) != len(set(ids)):
        sys.exit("CSV 에 키워드 ID 중복이 있습니다 (%d행 / 고유 %d)" % (len(ids), len(set(ids))))
    return rows


def _keyword_state(ids):
    """키워드 ID → 현재 상태. SA API 는 ids 를 쉼표로 받는다. URL 길이가 있어 끊는다."""
    out = {}
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        try:
            for k in call("GET", "/ncc/keywords", params={"ids": ",".join(chunk)}) or []:
                out[k.get("nccKeywordId")] = k
        except Exception as e:
            print("  조회 실패(%d~%d): %s" % (i, i + len(chunk), str(e)[:120]))
    return out


def cmd_off(args):
    """R3-1 중단 대상 177건을 SA API 로 끈다(userLock=true).

    ── 왜 파일 업로드가 아니라 API 인가 ─────────────────────────────────────
    대량 «수정» 은 다운로드 양식이 아니라 «작업 유형별 템플릿» 을 요구한다.
    다운로드 CSV 를 그대로 올리면 「불필요한 항목」으로 반려된다(2026-08-26 실측).
    양식을 맞추느니 API 로 상태만 바꾸는 편이 안전하다 — 컬럼을 잘못 채워
    «다른 값까지» 덮어쓸 위험이 없다.

    ── ⛔ 대상 외 키워드는 절대 건드리지 않는다 ────────────────────────────
    대상은 CSV 에 명시된 키워드 ID 뿐이다. 그룹 단위로 끄거나 조건으로 다시 고르지 않는다.
    실행 전에 조회해 «CSV 에 있는데 계정에 없는» 것도 걸러 낸다.

    ⚠️ 삭제가 아니라 OFF(userLock)다. 되돌릴 수 있어야 한다 —
       노출이 붙은 뒤 「중복 40 중 어느 쪽을 남길지」를 다시 판단할 수 있다.
    """
    if not API_KEY:
        sys.exit("NAVER_SA_* 환경변수가 필요합니다.")
    rows = _load_off_targets(args.csv)
    print("중단 대상 %d건 — %s" % (len(rows), args.csv))
    by_reason = {}
    for _, _, _, why in rows:
        by_reason[why] = by_reason.get(why, 0) + 1
    for k in sorted(by_reason, key=lambda x: -by_reason[x]):
        print("   %-12s %4d" % (k or "(사유없음)", by_reason[k]))

    ids = [r[0] for r in rows]
    print("")
    print("계정 상태 조회 중...")
    state = _keyword_state(ids)
    missing = [r for r in rows if r[0] not in state]
    already = [r for r in rows if r[0] in state and state[r[0]].get("userLock") is True]
    todo = [r for r in rows if r[0] in state and state[r[0]].get("userLock") is not True]
    print("  계정에 있음 %d · 없음 %d · 이미 OFF %d · 끌 대상 %d"
          % (len(state), len(missing), len(already), len(todo)))
    for r in missing[:5]:
        print("   [!] 계정에 없음: %s (%s)" % (r[1], r[0]))

    if not args.live:
        print("")
        print("--live 가 없어 아무것도 바꾸지 않았습니다. 끌 대상:")
        for kid, kw, grp, why in todo[:40]:
            print("   %-12s %-24s %s" % (why, grp[:22], kw[:34]))
        if len(todo) > 40:
            print("   ... 외 %d건" % (len(todo) - 40))
        print("")
        print("실행하려면: python tools/naver-sa/sa.py off --live")
        return

    ok = fail = 0
    # ⚠️ PUT /ncc/keywords 는 부분 갱신이다. fields 로 바꿀 필드를 «한정» 해야
    #    나머지 값(입찰가·연결URL)이 보존된다. 이걸 빼면 통째로 덮인다.
    for i in range(0, len(todo), 20):
        chunk = todo[i:i + 20]
        body = [{"nccKeywordId": kid, "userLock": True} for kid, _, _, _ in chunk]
        try:
            call("PUT", "/ncc/keywords", params={"fields": "userLock"}, body=body)
            ok += len(chunk)
            print("  OFF %d/%d" % (min(i + len(chunk), len(todo)), len(todo)))
        except Exception as e:
            fail += len(chunk)
            print("  실패 %d~%d: %s" % (i, i + len(chunk), str(e)[:160]))
        time.sleep(0.3)

    print("")
    print("요청 완료 — 성공 %d · 실패 %d · 이미 OFF %d · 계정에 없음 %d"
          % (ok, fail, len(already), len(missing)))

    # ── 실행 후 재조회. 「요청이 200 이었다」가 아니라 「실제로 꺼졌나」를 본다 ──
    print("")
    print("재조회 중...")
    after = _keyword_state(ids)
    off_now = [r for r in rows if after.get(r[0], {}).get("userLock") is True]
    on_now = [r for r in rows if r[0] in after and after[r[0]].get("userLock") is not True]
    print("검증: 대상 %d 중 OFF %d · 아직 ON %d · 조회 안 됨 %d"
          % (len(rows), len(off_now), len(on_now), len(rows) - len(after)))
    for kid, kw, grp, why in on_now[:10]:
        print("   [!] 아직 ON: %-24s %s (%s)" % (grp[:22], kw[:30], kid))
    if not on_now and len(after) == len(rows):
        print("전수 OFF 확인.")


def main():
    p = argparse.ArgumentParser(description="카더라 파워링크 전국 대량등록")
    s = p.add_subparsers(dest="cmd", required=True)
    def common(x):
        x.add_argument("--only", help="zone: 수도권/부울경/대경/충청/호남강원제주")
        x.add_argument("--cats", help="단계 필터. 예: A_분양중,B_분양예정,C_미분양")
        x.add_argument("--bid", type=int, default=80)
        x.add_argument("--max-alias", type=int, default=4, dest="max_alias", help="현장당 별칭 최대 개수 (0=별칭 미사용)")
        return x
    common(s.add_parser("plan")).set_defaults(fn=cmd_plan)
    common(s.add_parser("bids")).set_defaults(fn=cmd_bids)
    b = common(s.add_parser("build")); b.add_argument("--gid"); b.set_defaults(fn=cmd_build)
    a = common(s.add_parser("apply")); a.add_argument("--live", action="store_true"); a.set_defaults(fn=cmd_apply)
    s.add_parser("verify").set_defaults(fn=cmd_verify)
    r = s.add_parser("rollback"); r.add_argument("--live", action="store_true"); r.set_defaults(fn=cmd_rollback)
    o = s.add_parser("off", help="R3-1 중단 대상 CSV 의 키워드를 OFF(userLock) 한다")
    o.add_argument("--live", action="store_true", help="없으면 대상 목록만 출력하고 아무것도 바꾸지 않는다")
    o.add_argument("--csv", default=OFF_CSV, help="중단 대상 CSV 경로")
    o.set_defaults(fn=cmd_off)
    sc = s.add_parser("scan", help="계정에 나가 있는 키워드를 조각·법인명·slug형으로 훑는다(읽기 전용)")
    sc.add_argument("--csv", default=SCAN_CSV, help="산출 CSV 경로 (off 가 그대로 먹는 양식)")
    sc.set_defaults(fn=cmd_scan)
    for x in (a, o, r):
        x.add_argument("--ignore-lockout", action="store_true", dest="ignore_lockout",
                       help="록아웃 창 안에서도 실행한다 — 실행 사실이 로그에 남는다")
    args = p.parse_args()
    assert_lockout_clear(args)      # 계정에 «쓰기» 전 마지막 문
    args.fn(args)


if __name__ == "__main__":
    main()
