#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""단일 현장 «긴급» 키워드 등록 — 일광(2026-08-31) 절차를 코드로 굳힌 것.

    python tools/naver-sa/pl_add_site_keywords.py --slug 그랑라크-에일린의-뜰            # 예행
    python tools/naver-sa/pl_add_site_keywords.py --slug 그랑라크-에일린의-뜰 --live      # 집행

── 왜 sa.py apply 를 쓰지 않는가 ──────────────────────────────────────────────
`apply` 는 «존별 그룹 전체» 를 만든다. 여기서 필요한 것은 이미 있는 A_분양 그룹에
현장 하나의 키워드 15~20개를 «얹는» 일이다. 규모도 목적도 다르다.

⛔ 그래도 문은 «같은 문» 이다. 손으로 적은 키워드도 sa.py 의 판정을 그대로 통과시킨다 —
   조각(alias_is_fragment) · 법인명(alias_is_corp) · slug형(reject_slug_keywords).
   여기서 규칙을 다시 쓰면 판정이 둘로 갈린다(오늘 하루의 교훈).
⚠️ 입찰은 «층 나눔» 이다. 브랜드 300 · 부지/지역 100 — 같은 검색어에서 우리끼리
   1위를 다투지 않게 아래로 깐다. 노출이 적은 것은 «설계» 이지 결함이 아니다.
⚠️ 등록 직후 재조회는 «너무 이른» 재조회다. 2초 시점에는 PAUSED 로 보이고 잠시 뒤
   ELIGIBLE 이 된다(8/31 실측). 그 값으로 판정하지 말 것.
⚠️ 등록분은 PL-B′ 측정에서 «신규분» 으로 제외한다 — 등록 당일 키워드는 당연히 노출 0 이라
   「노출0 이 안 줄었다」는 틀린 결론을 만든다. 산출된 keyword_id 를 제외 문서에 남긴다.
"""
import argparse, importlib.util, json, os, sys, time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("sa", os.path.join(HERE, "sa.py"))
sa = importlib.util.module_from_spec(spec)
_argv = sys.argv[:]; sys.argv = [sys.argv[0]]
spec.loader.exec_module(sa)
sys.argv = _argv

SPEC_PATH = os.path.join(HERE, "urgent_keywords.json")
BIDS = {"brand": 300, "site": 100, "region": 100}
TIER_KO = {"brand": "브랜드", "site": "부지·구역", "region": "지역"}


def build(slug, site_name):
    spec_all = json.load(open(SPEC_PATH, encoding="utf-8"))
    if slug not in spec_all:
        sys.exit("%s 에 %s 가 없습니다." % (SPEC_PATH, slug))
    plan, seen = [], set()
    for tier in ("brand", "site", "region"):
        for raw in spec_all[slug].get(tier, []):
            kw = sa.kw_name(raw)
            key = kw.replace(" ", "")
            if not kw or key in seen:
                continue
            # ⛔ 손으로 적은 것도 같은 문을 지난다.
            if sa.alias_is_fragment(kw, site_name):
                print("  제외(조각)   %s" % kw); continue
            if sa.alias_is_corp(raw, kw, site_name):
                print("  제외(법인명) %s" % kw); continue
            ok, bad = sa.reject_slug_keywords([kw])
            if bad:
                print("  제외(slug형) %s" % kw); continue
            seen.add(key)
            plan.append({"tier": tier, "keyword": kw, "bid": BIDS[tier]})
    return plan


def main():
    p = argparse.ArgumentParser(description="단일 현장 긴급 키워드 등록")
    p.add_argument("--slug", required=True)
    p.add_argument("--group", default="A_분양")
    p.add_argument("--name", help="DB 조회가 막혔을 때 쓸 대표명")
    p.add_argument("--live", action="store_true")
    p.add_argument("--ignore-lockout", action="store_true", dest="ignore_lockout")
    args = p.parse_args()
    sa.assert_lockout_clear(args)

    if not sa.API_KEY:
        sys.exit("NAVER_SA_* 환경변수가 필요합니다.")
    gid = sa.EXISTING_GROUPS.get(args.group)
    if not gid:
        sys.exit("모르는 그룹: %s" % args.group)

    # ⚠️ DB 는 «있으면» 쓴다. 로컬 pooler 인증이 막혀 있어도(백로그) 등록을 못 하게 만들지 않는다.
    #    다만 그 경우 광고 적격(cs·ad_blocked)을 여기서 재확인하지 못한다 — 그 사실을 크게 적는다.
    site = None
    try:
        site = next((s for s in sa.fetch_sites() if s["slug"] == args.slug), None)
        if not site:
            sys.exit("DB 에 있으나 광고 대상 조건 밖입니다(cs·단계·이름 필터): %s" % args.slug)
    except SystemExit:
        raise
    except Exception as e:
        if not args.name:
            sys.exit("DB 조회 실패(%s) — --name 으로 대표명을 주면 그것으로 진행합니다." % str(e)[:80])
        print("⚠️ DB 조회 실패 — 광고 적격(cs·ad_blocked)을 이 스크립트가 «재확인하지 못했습니다».")
        print("   호출자가 확인한 값으로 진행합니다: %s" % args.name)
        site = {"name": args.name, "region": "-", "content_score": "-"}
    url = sa.SITE.rstrip("/") + "/apt/" + args.slug
    print("현장   %s (%s · cs %s)" % (site["name"], site["region"], site.get("content_score")))
    print("착지   %s" % url)
    print("그룹   %s %s" % (args.group, gid))
    print("")

    plan = build(args.slug, sa.kw_name(site["name"]))
    have = set()
    try:
        for k in sa.call("GET", "/ncc/keywords", params={"nccAdgroupId": gid}) or []:
            have.add((k.get("keyword") or "").replace(" ", ""))
    except Exception as e:
        sys.exit("그룹 조회 실패: %s" % str(e)[:200])
    print("그룹 현재 키워드 %d개" % len(have))

    todo = [x for x in plan if x["keyword"].replace(" ", "") not in have]
    dup = [x for x in plan if x["keyword"].replace(" ", "") in have]
    for x in dup:
        print("  이미 있음   %s" % x["keyword"])
    print("")
    for x in todo:
        print("  %-10s %-24s 입찰 %d" % (TIER_KO[x["tier"]], x["keyword"], x["bid"]))
    print("")
    print("등록 대상 %d개 (중복 제외 %d)" % (len(todo), len(dup)))

    if not args.live:
        print("")
        print("--live 가 없어 «아무것도 등록하지 않았습니다».")
        return
    if not todo:
        print("등록할 것이 없습니다."); return

    body = [{"keyword": x["keyword"], "bidAmt": x["bid"], "useGroupBidAmt": False,
             "links": {"pc": {"final": url}, "mobile": {"final": url}}} for x in todo]
    made = sa.call("POST", "/ncc/keywords", params={"nccAdgroupId": gid}, body=body) or []
    print("")
    print("등록 완료 %d개" % len(made))
    ids = [m.get("nccKeywordId") for m in made]
    print(json.dumps(ids, ensure_ascii=False))
    # ⚠️ 곧바로 재조회하지 않는다 — 2초 시점의 PAUSED 는 «너무 이른» 값이다.
    print("")
    print("15초 뒤 상태를 확인합니다...")
    time.sleep(15)
    state = {}
    for k in sa.call("GET", "/ncc/keywords", params={"nccAdgroupId": gid}) or []:
        if k.get("nccKeywordId") in ids:
            state[k["nccKeywordId"]] = (k.get("status"), k.get("userLock"), k.get("bidAmt"))
    for x, i in zip(todo, ids):
        st = state.get(i, ("?", "?", "?"))
        print("  %-24s %-12s userLock=%s bid=%s  %s" % (x["keyword"], st[0], st[1], st[2], i))
    print("")
    print("⚠️ PL-B′ 제외 목록에 위 keyword_id 를 남기세요 — 등록 당일 키워드는 노출 0 이 «정상» 입니다.")


if __name__ == "__main__":
    main()
