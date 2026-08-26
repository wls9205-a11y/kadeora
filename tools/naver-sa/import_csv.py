#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SA3 §C — 네이버 검색광고 «다운로드 CSV» 를 `ad_keywords` 에 적재한다.

    python tools/naver-sa/import_csv.py <csv경로> [--date 2026-08-26] [--dry]

sa.py 와 달리 이 스크립트는 **쓴다**. 대상은 `ad_keywords` 하나뿐이고
`apt_sites` 는 건드리지 않는다.

── 왜 이 테이블이 필요한가 ────────────────────────────────────────────
「어느 현장에 광고가 있나」를 조회로 답할 자리가 없었다. 광고주센터를 눈으로
훑는 수밖에 없어서 「등록이 안 됐다」와 「등록은 됐는데 노출이 없다」가 구분되지
않았다. 적재해 두면 `v_ad_coverage` 가 그 둘을 갈라 준다.

── CSV 규격 (실측 2026-08-26 · 5,478행) ──────────────────────────────
  · 인코딩은 **UTF-8 BOM** 이다. cp949 아니다.
  · **첫 줄이 안내문**이라 헤더는 두 번째 줄이다 → 한 줄 건너뛴다.
  · 헤더 12열:
      CUST_ID · 로그인 ID · 캠페인 ID · 캠페인 이름 · 광고그룹 ID · 광고그룹 이름
      키워드 ID · 키워드 · 키워드 연결URL(PC) · 키워드 연결URL(모바일)
      키워드 입찰가 · 키워드 상태
  · 다운로드 파일명이 `.csv` 인데 실제로는 «같은 이름의 폴더» 로 풀리는 경우가 있다
    (zip 해제 방식). 폴더가 오면 안쪽 파일을 자동으로 집는다.

── site_slug 도출 규칙 ────────────────────────────────────────────────
  `urlparse(url).path` 에서 `/apt/` 를 떼고 **URL 디코드** 한다.
  한글 slug 가 퍼센트 인코딩돼 오므로 디코드가 없으면 전부 어긋난다.

  ⚠️ 남은 경로에 `/` 가 더 있으면 **허브** 다 → `site_slug = null`.
     실측 6경로 137행 — region/부산 63 · region/경남 33 · region/경북 29 ·
     redev/부산·경북·경남 각 4.
  ⚠️ 연결 URL 이 «양쪽 다 빈» 행 47건을 **버리지 않는다.** 광고그룹 기본 URL 을
     쓰는 행이라 CSV 에 안 찍힐 뿐 실재하는 키워드다. `site_slug = null` 로 넣는다.
     (버리면 「등록 5,478」과 테이블 행수가 어긋나 다음 사람이 원인을 다시 판다.)

── 재실행 ─────────────────────────────────────────────────────────────
  `unique (snapshot_date, keyword_id)` 라 같은 날 다시 돌리면 upsert 된다.
  ⚠️ 날짜가 다르면 **덮어쓰지 않고 쌓인다.** 그게 의도다 — 과거 상태를 남긴다.
"""
import argparse
import csv
import datetime as dt
import io
import os
import sys
from urllib.parse import urlparse, unquote

COLS = {
    "campaign_id":    "캠페인 ID",
    "adgroup_id":     "광고그룹 ID",
    "adgroup_name":   "광고그룹 이름",
    "keyword_id":     "키워드 ID",
    "keyword":        "키워드",
    "landing_pc":     "키워드 연결URL(PC)",
    "landing_mobile": "키워드 연결URL(모바일)",
    "bid":            "키워드 입찰가",
    "status":         "키워드 상태",
}


def resolve_path(p: str) -> str:
    """다운로드가 '이름.csv' 폴더로 풀린 경우 안쪽 파일을 집는다."""
    if os.path.isdir(p):
        inner = [f for f in os.listdir(p) if f.lower().endswith(".csv")]
        if len(inner) != 1:
            sys.exit("폴더 안에 csv 가 %d개다. 파일을 직접 지정할 것: %s" % (len(inner), p))
        return os.path.join(p, inner[0])
    return p


# /apt 아래의 «정적 라우트» 이름. 현장 slug 가 될 수 없다.
#
# ⚠️ 경로에 `/` 가 있는지만 보면 «부족하다». `/apt/busan` · `/apt/pipeline` ·
#    `/apt/unsold` 처럼 세그먼트가 하나뿐인 허브가 있다. 첫 적재에서 이 셋이
#    현장 slug 로 들어가 apt_sites 에 대응 행이 없는 «고아 21행» 이 생겼다
#    (unsold 9 · busan 6 · pipeline 6). v_ad_coverage 는 apt_sites 기준
#    LEFT JOIN 이라 그 고아가 화면에 안 나타나 조용했다.
#
# 목록은 `src/app/(main)/apt/` 의 «[param] 이 아닌» 디렉터리 이름이다.
# 라우트를 추가하면 여기도 같이 늘릴 것 — 안 늘리면 또 고아가 생긴다.
# (적재 끝에 고아 검출을 돌리므로, 빠뜨려도 그 자리에서 잡힌다.)
APT_HUB_SEGMENTS = {
    "archive", "area", "big-events", "builder", "busan", "compare", "complex",
    "data", "diagnose", "feed", "landmark", "map", "pipeline", "popular",
    "ranking", "redev", "region", "search", "sites", "stage", "theme",
    "unsold", "unsold-deals",
}


def site_slug_of(pc: str, mobile: str):
    """랜딩 URL → site_slug. 허브·빈 URL 은 None."""
    url = (pc or "").strip() or (mobile or "").strip()
    if not url:
        return None
    path = unquote(urlparse(url).path or "")
    if not path.startswith("/apt/"):
        return None
    rest = path[len("/apt/"):].strip("/")
    if not rest:
        return None
    if "/" in rest:                      # /apt/region/부산 같은 다단 허브
        return None
    if rest in APT_HUB_SEGMENTS:         # /apt/busan 같은 «단일 세그먼트» 허브
        return None
    return rest


def to_int(v):
    v = (v or "").strip().replace(",", "")
    try:
        return int(v)
    except ValueError:
        return None


def parse(path: str):
    with io.open(path, encoding="utf-8-sig", newline="") as f:
        first = f.readline()
        # 보통은 첫 줄이 안내문이라 건너뛴 상태로 DictReader 에 넘긴다.
        # 안내문 없이 헤더로 시작하는 파일이 오면 되감아 첫 줄부터 읽는다.
        if "CUST_ID" in first:
            f.seek(0)
        rows = list(csv.DictReader(f))
    if not rows:
        sys.exit("행이 없다. 첫 줄이 안내문인지, 헤더가 맞는지 확인할 것.")
    missing = [k for k in COLS.values() if k not in rows[0]]
    if missing:
        sys.exit("CSV 헤더에 없는 열: %s\n실제 열: %s" % (missing, list(rows[0].keys())))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path")
    ap.add_argument("--date", default=dt.date.today().isoformat(),
                    help="snapshot_date (기본: 오늘). 과거 파일을 넣을 때 지정한다.")
    ap.add_argument("--dry", action="store_true", help="DB 에 쓰지 않고 집계만 낸다")
    a = ap.parse_args()

    path = resolve_path(a.csv_path)
    rows = parse(path)

    recs, hub, blank = [], 0, 0
    for r in rows:
        pc, mo = r.get(COLS["landing_pc"], ""), r.get(COLS["landing_mobile"], "")
        slug = site_slug_of(pc, mo)
        if not (pc or "").strip() and not (mo or "").strip():
            blank += 1
        elif slug is None:
            hub += 1
        recs.append((
            a.date,
            (r[COLS["campaign_id"]] or "").strip(),
            (r[COLS["adgroup_id"]] or "").strip(),
            (r[COLS["adgroup_name"]] or "").strip(),
            (r[COLS["keyword_id"]] or "").strip(),
            (r[COLS["keyword"]] or "").strip(),
            (pc or "").strip() or None,
            (mo or "").strip() or None,
            to_int(r.get(COLS["bid"])),
            (r.get(COLS["status"]) or "").strip() or None,
            slug,
        ))

    print("파일        : %s" % path)
    print("snapshot    : %s" % a.date)
    print("행          : %d" % len(recs))
    print("  site_slug : %d  (고유 %d)" % (sum(1 for x in recs if x[10]),
                                           len({x[10] for x in recs if x[10]})))
    print("  허브 null : %d" % hub)
    print("  빈URL null: %d   ← 버리지 않는다" % blank)
    if a.dry:
        print("\n--dry 라 쓰지 않았다.")
        return

    db = os.environ.get("SUPABASE_DB_URL", "")
    if not db:
        sys.exit("SUPABASE_DB_URL 이 없다. Supabase > Settings > Database > Connection string")
    import psycopg2
    from psycopg2.extras import execute_values
    conn = psycopg2.connect(db)
    try:
        with conn, conn.cursor() as cur:
            execute_values(cur, """
                insert into ad_keywords
                  (snapshot_date, campaign_id, adgroup_id, adgroup_name, keyword_id,
                   keyword, landing_pc, landing_mobile, bid, status, site_slug)
                values %s
                on conflict (snapshot_date, keyword_id) do update set
                  campaign_id    = excluded.campaign_id,
                  adgroup_id     = excluded.adgroup_id,
                  adgroup_name   = excluded.adgroup_name,
                  keyword        = excluded.keyword,
                  landing_pc     = excluded.landing_pc,
                  landing_mobile = excluded.landing_mobile,
                  bid            = excluded.bid,
                  status         = excluded.status,
                  site_slug      = excluded.site_slug
            """, recs, page_size=500)
            cur.execute("select count(*) from ad_keywords where snapshot_date = %s", (a.date,))
            print("\n적재 완료. ad_keywords(%s) = %d행" % (a.date, cur.fetchone()[0]))

            # ── 고아 검출 — 상시로 돌린다 ─────────────────────────────
            # 랜딩이 가리키는 slug 인데 apt_sites 에 그 행이 없는 경우다.
            # ⚠️ v_ad_coverage 는 apt_sites 기준 LEFT JOIN 이라 «뷰에는 안 나타난다».
            #    첫 적재 때 단일 세그먼트 허브 3종이 21행 들어갔는데 그래서 조용했다.
            #    APT_HUB_SEGMENTS 를 빠뜨렸거나 랜딩을 잘못 넣으면 여기서 잡힌다.
            cur.execute(
                "select k.site_slug, count(*) from ad_keywords k "
                "left join apt_sites s on s.slug = k.site_slug "
                "where k.snapshot_date = %s and k.site_slug is not null and s.slug is null "
                "group by 1 order by 2 desc",
                (a.date,))
            orphans = cur.fetchall()
            if orphans:
                print("\n[!] 고아 %d종 %d행 - apt_sites 에 대응 행이 없다:"
                      % (len(orphans), sum(n for _, n in orphans)))
                for slug, n in orphans:
                    print("     %-28s %4d행" % (slug, n))
                print("    허브면 APT_HUB_SEGMENTS 에 넣고, 오타면 광고 랜딩을 고칠 것.")
            else:
                print("고아 0건 - 모든 site_slug 가 apt_sites 에 있다.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
