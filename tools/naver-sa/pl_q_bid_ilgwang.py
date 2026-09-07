#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
판정회신_Q_20260907 ① — 일광 신규분 15키워드 입찰 ×0.5 하향.

    python tools/naver-sa/pl_q_bid_ilgwang.py          # 현재 값만 읽는다
    python tools/naver-sa/pl_q_bid_ilgwang.py --live   # 실제로 내린다

근거: 33클릭·리드 0·클릭당 443원(9/7 실측). 상위 방어는 큐샵 캠페인이 이미 한다.
대상 15건은 docs/PL_B_PRIME_EXCLUDE_20260831.md 의 keyword_id 명단 그대로다.

⛔ 대상은 그 15개 ID «뿐» 이다. 그룹·조건으로 다시 고르지 않는다.
⛔ 하루예산·그룹 기본입찰·착지 URL 은 건드리지 않는다. bidAmt 한 필드만 바꾼다.
⛔ D_기축이 아니므로 동결 규약과 무관하다.

⚠️ PUT /ncc/keywords 는 «배열» 을 받는다. 조회한 객체를 통째로 싣고 단일 객체로 보내면
   400 `Cannot deserialize value of type java.util.ArrayList` 로 거부된다(9/7 실측 11/11).
   sa.cmd_off 와 «같은 형태» 로 보낸다 — `fields` 로 바꿀 필드를 한정하고, 최소 객체
   `{nccKeywordId, bidAmt}` 만 실어 나머지 값(연결URL·userLock)이 보존되게 한다.
   ⛔ pl5_bid_e.py 의 「전체 객체를 요구한다」는 «그룹»(/ncc/adgroups) 이야기다.
      엔드포인트가 다르면 규약도 다르다 — 그 주석을 여기에 옮겨 적지 않는다.
⚠️ useGroupBidAmt=True 인 키워드는 «키워드 입찰을 따르지 않는다». 그런 건이 있으면
   바꿔도 화면에 아무 효과가 없으므로 «건드리지 않고» 보고한다.
⚠️ 네이버 파워링크 최소 입찰가는 70원이다. ×0.5 가 70 미만이 되는 건은
   70 으로 «바닥을 친다» — 50원을 보내면 API 가 거부하거나 조용히 70으로 올린다.
   어느 쪽이든 「보낸 값」과 「실제 값」이 갈리므로 처음부터 70으로 보낸다.
"""
import os, sys, json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

if not os.environ.get('NAVER_SA_API_KEY'):
    import subprocess
    for _n in ('NAVER_SA_API_KEY', 'NAVER_SA_SECRET_KEY', 'NAVER_SA_CUSTOMER_ID'):
        _o = subprocess.run(['powershell', '-NoProfile', '-Command',
                             "[Environment]::GetEnvironmentVariable('%s','User')" % _n],
                            capture_output=True, text=True, encoding='utf-8')
        if (_o.stdout or '').strip():
            os.environ[_n] = _o.stdout.strip()

import sa  # noqa: E402

MIN_BID = 70
FACTOR = 0.5

IDS = [
    "nkw-a001-01-000008560917258", "nkw-a001-01-000008560917260", "nkw-a001-01-000008560917263",
    "nkw-a001-01-000008560917265", "nkw-a001-01-000008560917268", "nkw-a001-01-000008560917270",
    "nkw-a001-01-000008560917272", "nkw-a001-01-000008560917273", "nkw-a001-01-000008560917274",
    "nkw-a001-01-000008560917275", "nkw-a001-01-000008560917276", "nkw-a001-01-000008560917277",
    "nkw-a001-01-000008560917278", "nkw-a001-01-000008560917279", "nkw-a001-01-000008560917280",
]


def target_bid(cur):
    v = int(round(cur * FACTOR))
    return max(v, MIN_BID)


def main():
    live = "--live" in sys.argv
    if not sa.API_KEY:
        sys.exit("NAVER_SA_* 환경변수가 필요합니다.")

    print("일광 신규분 15키워드 — 입찰 ×%.1f (바닥 %d원)" % (FACTOR, MIN_BID))
    state = sa._keyword_state(IDS)

    missing = [i for i in IDS if i not in state]
    if missing:
        print("⚠️ 계정에 없는 ID %d건: %s" % (len(missing), ", ".join(x[-6:] for x in missing)))

    plan, skip_group, skip_same = [], [], []
    print("\n%-22s %7s %7s  %-8s %-6s %s" % ("키워드", "현재", "→목표", "userLock", "그룹입찰", "상태"))
    for i in IDS:
        k = state.get(i)
        if not k:
            continue
        kw = k.get("keyword", "?")
        cur = int(k.get("bidAmt") or 0)
        ugb = bool(k.get("useGroupBidAmt"))
        lock = bool(k.get("userLock"))
        tgt = target_bid(cur)
        note = ""
        if ugb:
            skip_group.append((kw, cur))
            note = "← 그룹입찰을 따름. 건드리지 않는다"
        elif tgt == cur:
            skip_same.append((kw, cur))
            note = "← 이미 목표값(바닥 %d)" % MIN_BID
        else:
            plan.append((i, k, kw, cur, tgt))
        print("%-22s %7d %7d  %-8s %-6s %s" % (kw[:22], cur, tgt, lock, ugb, note))

    print("\n바꿀 대상 %d건 · 그룹입찰이라 제외 %d건 · 이미 목표값 %d건"
          % (len(plan), len(skip_group), len(skip_same)))

    if not live:
        print("\n--live 가 없어 아무것도 바꾸지 않았습니다.")
        return

    if not plan:
        print("바꿀 것이 없습니다.")
        return

    import time
    done, fail = [], []
    for s in range(0, len(plan), 20):
        chunk = plan[s:s + 20]
        # ⚠️ 3705 Invalid ad group number — bidAmt 갱신은 nccAdgroupId 를 «같이» 요구한다.
        #    userLock 갱신(sa.cmd_off)은 안 그런다. 같은 엔드포인트라도 필드마다 다르다.
        # ⚠️ 3916 No value is entered in the default bid or bid amount field —
        #    bidAmt 만 실으면 서버가 「그룹 기본입찰을 쓰는 건가」를 판단하지 못한다.
        #    useGroupBidAmt 를 «명시» 해야 한다. 대상 15건은 이미 False 라 값 변화는 없다.
        body = [{"nccKeywordId": i, "nccAdgroupId": k["nccAdgroupId"],
                 "bidAmt": tgt, "useGroupBidAmt": False}
                for i, k, _, _, tgt in chunk]
        try:
            sa.call("PUT", "/ncc/keywords",
                    params={"fields": "bidAmt,useGroupBidAmt"}, body=body)
            for i, _, kw, cur, tgt in chunk:
                done.append((i, kw, cur, tgt))
            print("  하향 %d/%d" % (min(s + len(chunk), len(plan)), len(plan)))
        except Exception as e:
            for _, _, kw, _, _ in chunk:
                fail.append((kw, str(e)[:160]))
            print("  실패 %d~%d: %s" % (s, s + len(chunk), str(e)[:160]))
        time.sleep(0.3)

    print("\nPUT 성공 %d · 실패 %d" % (len(done), len(fail)))

    # ⛔ 「200 이었다」는 확인이 아니다. 재조회로 «실제 값» 을 센다.
    print("\n재조회 검증...")
    after = sa._keyword_state([x[0] for x in done])
    ok = bad = 0
    for i, kw, cur, tgt in done:
        a = after.get(i) or {}
        got = int(a.get("bidAmt") or 0)
        if got == tgt:
            ok += 1
        else:
            bad += 1
            print("  불일치 %s: 보낸 %d · 실제 %d" % (kw, tgt, got))
    print("재조회 일치 %d · 불일치 %d" % (ok, bad))
    if fail or bad:
        sys.exit(1)


if __name__ == "__main__":
    main()
