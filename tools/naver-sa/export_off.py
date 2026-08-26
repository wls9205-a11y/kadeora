#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
R3-1 — 광고 «중단(off)» 대상을 대량수정용 CSV 로 뽑는다.

    export SUPABASE_DB_URL='postgresql://...'
    python tools/naver-sa/export_off.py [--out docs/m6/R3_광고_중단대상.csv]

⚠️ CC 는 네이버 계정을 만지지 않는다. 이 스크립트는 «파일을 뽑는 데까지» 다.
   업로드(대량 수정)는 사람이 한다.

── 출력 규격 ──
광고 다운로드 CSV 와 «같은 컬럼 · 같은 UTF-8 BOM» 이고, `키워드 상태` 만 off 다.
그대로 대량 수정에 올릴 수 있다. 맨 뒤에 `사유` 한 열만 덧붙는다
(네이버는 모르는 열을 무시한다. 올리기 전에 지우고 싶으면 지워도 된다).

── 대상 세 종류 ──
  slug키워드   132   keyword ~ '[가-힣]-[가-힣]'
  중복40        40   같은 키워드가 기존(A~D)·신규(부울경_*) 두 그룹에 다 있는 것 → «기존» 을 끈다
  비활성현장     5   site_slug = '양산-물금-재건축' (apt_sites.is_active = false)

⚠️ 하이픈 판정은 «한글과 한글 사이» 만이다. 하이픈 전체로 걸면 429건이 잡히고
   `금곡2-1구역재개발` · `에코델타시티16블록중흥S-클래스` 같은 정상 검색어 297개가 함께 죽는다.

⚠️ 중복 40건에서 «높은 쪽(110원, 신규)» 을 남기는 이유는 비용이 아니라 «계측» 이다.
   같은 키워드에 두 입찰가가 걸리면 네이버가 어느 쪽을 쓸지 우리가 통제하지 못하고
   성과가 두 그룹으로 쪼개져 n_keyword 분석이 갈린다.

⚠️ 이중 등록 «174곳» 을 전부 정리하지 않는다. 실측하면 기존에만 있는 키워드 1,169개 ·
   신규에만 있는 키워드 1,074개다 — 같은 현장에 «서로 다른 검색어» 를 나눠 넣은 것이라
   각자 값을 한다. 실제 완전 중복은 40건뿐이고 그것만 끈다.
"""
import argparse
import csv
import io
import os
import sys

HEADER = ["CUST_ID", "로그인 ID", "캠페인 ID", "캠페인 이름", "광고그룹 ID", "광고그룹 이름",
          "키워드 ID", "키워드", "키워드 연결URL(PC)", "키워드 연결URL(모바일)",
          "키워드 입찰가", "키워드 상태", "사유"]

SQL = """
with snap as (select max(snapshot_date) d from ad_keywords),
dup as (
  select keyword from ad_keywords, snap where snapshot_date = snap.d
  group by keyword
  having count(distinct case when adgroup_name like '부울경%' then 1 else 0 end) = 2
)
select k.campaign_id, k.adgroup_id, k.adgroup_name, k.keyword_id, k.keyword,
       k.landing_pc, k.landing_mobile, k.bid,
       case
         when k.keyword ~ '[가-힣]-[가-힣]'                              then 'slug키워드'
         when k.keyword in (select keyword from dup)
              and k.adgroup_name not like '부울경%'                      then '중복40'
         when k.site_slug = '양산-물금-재건축'                            then '비활성현장'
       end as reason
  from ad_keywords k, snap
 where k.snapshot_date = snap.d
   and (k.keyword ~ '[가-힣]-[가-힣]'
        or (k.keyword in (select keyword from dup) and k.adgroup_name not like '부울경%')
        or k.site_slug = '양산-물금-재건축')
 order by reason, k.adgroup_name, k.keyword
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="docs/m6/R3_광고_중단대상.csv")
    ap.add_argument("--cust", default="1875914", help="CUST_ID (다운로드 CSV 와 같은 값)")
    ap.add_argument("--login", default="yoas2:naver", help="로그인 ID")
    ap.add_argument("--campaign-name", default="카더라")
    a = ap.parse_args()

    db = os.environ.get("SUPABASE_DB_URL", "")
    if not db:
        sys.exit("SUPABASE_DB_URL 이 없다.")
    import psycopg2
    conn = psycopg2.connect(db)
    try:
        with conn.cursor() as cur:
            cur.execute(SQL)
            rows = cur.fetchall()
    finally:
        conn.close()

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    # utf-8-sig = BOM. 네이버 대량관리가 BOM 없는 UTF-8 을 cp949 로 오독한다.
    with io.open(a.out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        for (camp_id, grp_id, grp_nm, kw_id, kw, pc, mo, bid, reason) in rows:
            w.writerow([a.cust, a.login, camp_id, a.campaign_name, grp_id, grp_nm,
                        kw_id, kw, pc or "", mo or "", bid if bid is not None else "",
                        "off", reason])

    from collections import Counter
    c = Counter(r[8] for r in rows)
    print("파일: %s" % a.out)
    print("행  : %d" % len(rows))
    for k in ("slug키워드", "중복40", "비활성현장"):
        print("  %-10s %4d" % (k, c.get(k, 0)))
    ids = [r[3] for r in rows]
    if len(ids) != len(set(ids)):
        print("[!] 키워드 ID 중복 %d건 — 대량수정이 거부한다" % (len(ids) - len(set(ids))))
    else:
        print("키워드 ID 중복 없음.")


if __name__ == "__main__":
    main()
