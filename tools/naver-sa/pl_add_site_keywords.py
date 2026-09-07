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
            # ⛔ 계정에 «올라가는» 표기는 공백을 지운 것이다. 네이버 SA 키워드는 공백을
            #    담지 못한다 — 계정 실측 5,512행 전량 공백 0건이고, 공백을 넣어 POST 하면
            #    응답은 200 인데 그 항목만 «생성되지 않는다»(TRIVN 2026-09-07 에 9건 중
            #    8건이 이렇게 조용히 새어 나갔다).
            # ⚠️ 판정(조각·법인명·slug형)은 «읽는 표기» kw 로 하고, 등록만 key 로 한다 —
            #    공백 지운 문자열에 술어를 걸면 어절 경계가 사라져 판정이 달라진다.
            plan.append({"tier": tier, "keyword": key, "bid": BIDS[tier]})
    return plan


def ad_eligible_stages():
    """광고 적격 단계 — `src/lib/apt/lead-eligibility.ts` 의 LEAD_ELIGIBLE_STAGES «그것» 을 읽는다.

    ⛔ 이 목록을 파이썬으로 다시 «적지» 않는다. 착지 프로브(걸쇠 ④)가 보는 판정과
       등록이 보는 판정이 갈리면, 폼이 없는 페이지에 광고를 붙이는 바로 그 사고가 난다
       (PL-0 「기장원룸」 계보). 그래서 사본이 아니라 «같은 파일» 을 파싱한다.
    ⚠️ 못 읽으면 추측하지 않고 멈춘다 — 비어 있는 집합으로 통과시키는 쪽이 더 나쁘다.
    """
    src = os.path.join(HERE, "..", "..", "src", "lib", "apt", "lead-eligibility.ts")
    try:
        txt = open(src, encoding="utf-8").read()
    except Exception as e:
        sys.exit("lead-eligibility.ts 를 읽지 못했습니다(%s) — 단계 판정을 추측하지 않습니다." % str(e)[:80])
    import re
    m = re.search(r"LEAD_ELIGIBLE_STAGES\s*=\s*\[(.*?)\]\s*as const", txt, re.S)
    if not m:
        sys.exit("lead-eligibility.ts 에서 LEAD_ELIGIBLE_STAGES 를 찾지 못했습니다 — 멈춥니다.")
    stages = re.findall(r"'([a-z_]+)'", m.group(1))
    if not stages:
        sys.exit("LEAD_ELIGIBLE_STAGES 가 비어 보입니다 — 멈춥니다.")
    return stages


def unscoped_site(slug, allow_low_cs):
    """생성 스코프(`sa.SQL`) «밖» 의 현장 — 갓 시드된 대어를 위한 좁은 문.

    ⚠️ `sa.SQL` 의 `content_score >= 40` 은 «전국 일괄 생성에서 무엇을 만들지» 를 고르는
       스코프 필터이지 «광고를 붙여도 되는가» 가 아니다. 갓 시드된 현장은 인리치가
       48h SLA 라 «정의상» cs 0 이다. 그래서 이 문이 없으면 긴급 등록은 정작 대상인
       «신규 대어» 에만 영원히 닫힌다 — 일광·그랑라크가 안 걸린 건 이미 cs≥40 이었기
       때문이지 규칙이 맞아서가 아니다 (TRIVN 2026-09-07 에 실제로 걸려서 판 문이다).
    ⛔ 문턱만 비켜 가고 «진짜 적격» 은 오히려 더 좁게 본다 — is_active · ad_blocked ·
       supply_type · 단계 네 가지를 DB 에서 직접 조회해 하나라도 어긋나면 등록하지
       않는다. 아무것도 확인하지 않고 통과시키는 `--name` 보다 강한 문이다.
    ⛔ `sa.SQL` 자체는 «건드리지 않는다». 문턱을 낮추면 전국 일괄 생성이 통째로 달라진다.
    ⚠️ 비켜 가는 것은 언제나 «의도한 행위» 로 남긴다 — 그래서 자동이 아니라 플래그다
       (`--ignore-lockout` 과 같은 규율).
    """
    if not allow_low_cs:
        sys.exit("생성 스코프 밖입니다(cs·단계·이름 필터): %s\n"
                 "  · cs 문턱(40)에만 걸린 «갓 시드된» 현장이라면 --allow-low-cs 를 붙이세요.\n"
                 "    그 경우에도 is_active·ad_blocked·supply_type·단계를 직접 확인하고,\n"
                 "    하나라도 어긋나면 멈춥니다." % slug)
    if not sa.DB_URL:
        sys.exit("--allow-low-cs 는 DB 로 실적격을 직접 확인합니다 — SUPABASE_DB_URL 이 필요합니다.")
    import psycopg2, psycopg2.extras
    with psycopg2.connect(sa.DB_URL) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT slug, name, region, sigungu, total_units, content_score,
                       is_active, ad_blocked, lifecycle_stage, supply_type,
                       CASE WHEN jsonb_typeof(name_variants) = 'array'
                            THEN ARRAY(SELECT jsonb_array_elements_text(name_variants))
                            ELSE ARRAY[]::text[] END AS variants
                FROM apt_sites WHERE slug = %s
            """, (slug,))
            row = cur.fetchone()
    if not row:
        sys.exit("apt_sites 에 없는 slug 입니다: %s" % slug)
    row = dict(row)
    stages = ad_eligible_stages()
    for bad, why in (
        (not row["is_active"],                    "is_active=false"),
        (bool(row["ad_blocked"]),                 "ad_blocked=true"),
        (row["supply_type"] != "민영",             "supply_type=%s (민영 아님)" % row["supply_type"]),
        (row["lifecycle_stage"] not in stages,    "단계 %s 가 광고 적격 밖" % row["lifecycle_stage"]),
    ):
        if bad:
            sys.exit("실적격 미달 — 등록하지 않습니다: %s (%s)" % (slug, why))
    print("⚠️ 생성 스코프 밖(cs %s < 40)이라 --allow-low-cs 로 «의도적으로» 진행합니다." % row["content_score"])
    print("   실적격 직접 확인 4/4: is_active=true · ad_blocked=false · supply_type=민영 · %s ∈ 광고적격"
          % row["lifecycle_stage"])
    print("   단계 집합 출처: src/lib/apt/lead-eligibility.ts (%d단계 · 착지 프로브와 같은 소스)" % len(stages))
    print("   ⛔ cs 는 색인(noindex) 기준일 뿐 착지와 무관하다 — 착지는 걸쇠 ④ 프로브가 본다.")
    row["zone"] = sa.ZONE.get(row["region"], "호남강원제주")
    return row


def main():
    p = argparse.ArgumentParser(description="단일 현장 긴급 키워드 등록")
    p.add_argument("--slug", required=True)
    p.add_argument("--group", default="A_분양")
    p.add_argument("--name", help="DB 조회가 막혔을 때 쓸 대표명")
    p.add_argument("--live", action="store_true")
    p.add_argument("--ignore-lockout", action="store_true", dest="ignore_lockout")
    # 갓 시드된 현장(cs 0)을 위한 좁은 문. unscoped_site() 의 4중 검사를 반드시 거친다.
    p.add_argument("--allow-low-cs", action="store_true", dest="allow_low_cs")
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
            # ⚠️ 「스코프 밖」과 「적격 밖」은 다르다. 전자는 cs 문턱일 수 있고, 그건
            #    갓 시드된 현장에서 «항상» 참이다. 좁은 문이 실적격을 다시 본다.
            site = unscoped_site(args.slug, args.allow_low_cs)
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
    ids = [m.get("nccKeywordId") for m in made]
    # ⛔ 응답 «행 수» 를 성공 수로 세지 말 것. 네이버는 만들지 못한 항목도 자리를 채워
    #    되돌려 준다 — id 가 없는 행이 그것이다. len(made) 를 세던 판이 「등록 완료 9개」
    #    를 찍고 실제로는 1개만 들어간 사고를 냈다 (TRIVN 2026-09-07).
    good = [i for i in ids if i]
    print("")
    if len(good) != len(todo):
        print("⛔ 요청 %d · 실제 생성 %d — %d건이 «조용히» 실패했습니다."
              % (len(todo), len(good), len(todo) - len(good)))
        for x, i in zip(todo, ids):
            if not i:
                print("   실패  %s" % x["keyword"])
        print("   ⚠️ 계정에 나가 있는 것은 아래 검증이 «다시» 확인합니다 — 이 목록을 믿지 말고 게이트를 보세요.")
    print("등록 완료 %d개 / 요청 %d개" % (len(good), len(todo)))
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
