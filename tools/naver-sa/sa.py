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

import argparse, base64, csv, hashlib, hmac, io, json, os, re, sys, time
from collections import Counter, OrderedDict
from urllib.parse import quote, unquote

# ─────────────────────────────────────────────── 상수

SITE = "https://kadeora.app"
ENC = "cp949"                 # 네이버 템플릿 인코딩. UTF-8 로 쓰면 한글이 전부 깨진다
KW_PER_GROUP = 900            # 네이버 한도 1,000
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
SELECT slug, name, region, sigungu, total_units, content_score,
  CASE
    WHEN lifecycle_stage IN ('subscription_open','contract_signing','award_announced') THEN 'A_분양중'
    WHEN lifecycle_stage = 'pre_announcement'                                          THEN 'B_분양예정'
    WHEN lifecycle_stage = 'unsold_active'                                             THEN 'C_미분양'
    WHEN lifecycle_stage IN ('move_in_ready','move_in_started')                        THEN 'D_입주예정'
    WHEN lifecycle_stage IN ('union_established','site_planning','plan_approved',
                             'mgmt_approved','constructor_selected','construction')    THEN 'E_정비사업'
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

def kw_name(name):
    n = ALIAS.get(name, name)
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
    """
    main = kw_name(site["name"])
    out = [main] if len(main) >= 4 else []
    seen = {main.replace(" ", "")}
    cands = []
    for v in (site.get("variants") or []):
        n = kw_name(v)
        k = n.replace(" ", "")
        if not (4 <= len(n) <= 30) or k in seen:
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
                    if kk in seen or not (2 <= len(k) <= 50):
                        continue
                    seen.add(kk); kws.append(k)
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


def cmd_rollback(args):
    st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {"adgroups": {}}
    for name, gidv in list(st["adgroups"].items()):
        if not args.live: print("삭제예정 %s %s" % (name, gidv)); continue
        try:
            call("DELETE", "/ncc/adgroups/" + gidv)
            del st["adgroups"][name]
            json.dump(st, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print("삭제완료 %s" % name)
        except Exception as e: print("삭제실패 %s %s" % (name, str(e)[:100]))


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
    args = p.parse_args(); args.fn(args)


if __name__ == "__main__":
    main()
