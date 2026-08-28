#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
승인된 착지 URL 교체 — 리드폼 없는 목록 페이지 → 그 지역의 지역 허브.

    python tools/naver-sa/pl_landing_fix.py            # 예행. 아무것도 바꾸지 않는다
    python tools/naver-sa/pl_landing_fix.py --live     # 실제 교체

승인(2026-08-28): 「E 착지 유지(unsold·pipeline 33키워드만 지역 허브로)」

⛔ 대상은 아래 네 갈래에 «현재 착지해 있는» 키워드뿐이다. 조건을 다시 만들지 않는다.
⛔ `/apt/region/*` 에 이미 착지한 125키워드는 «건드리지 않는다» — 승인 범위 밖이다.
⚠️ `fields=links` 를 반드시 붙인다. 부분 갱신 지정이 없으면 입찰가·상태가 통째로 덮인다.
⚠️ 옮기기 «전에» 목적지가 200 인지 확인한다. 죽은 곳으로 옮기면 지금보다 나빠진다.
⚠️ 실행 «후 재조회» 로 실제 반영을 센다 — 「요청이 200 이었다」는 확인이 아니다.
"""
import os, sys, re, json, time, urllib.request, urllib.error, urllib.parse, io

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))

if not os.environ.get('NAVER_SA_API_KEY'):
    import subprocess
    for _n in ('NAVER_SA_API_KEY', 'NAVER_SA_SECRET_KEY', 'NAVER_SA_CUSTOMER_ID'):
        _o = subprocess.run(['powershell', '-NoProfile', '-Command',
                             "[Environment]::GetEnvironmentVariable('%s','User')" % _n],
                            capture_output=True, text=True, encoding='utf-8')
        if (_o.stdout or '').strip():
            os.environ[_n] = _o.stdout.strip()

import importlib.util
spec = importlib.util.spec_from_file_location('sa', os.path.join(HERE, 'sa.py'))
sa = importlib.util.module_from_spec(spec)
_argv = sys.argv[:]; sys.argv = [sys.argv[0]]
spec.loader.exec_module(sa)
sys.argv = _argv

SITE = 'https://kadeora.app'
GROUPS = {'E_대표': 'grp-a001-01-000000072363917'}
LIVE = '--live' in sys.argv

# 리드폼이 «없는» 목록·허브 페이지들. 여기 착지한 것만 옮긴다.
MOVE_FROM = ('/apt/unsold', '/apt/pipeline', '/apt/busan', '/apt/redev/')
REGIONS = ('부산', '울산', '경남')


def link_of(k):
    """
    키워드의 연결 URL.

    ⚠️ `links` 의 값이 «문자열일 때도 dict 일 때도» 있다(일부 키워드가 {'final': ...} 형태).
       PL-0 에서 같은 곳에서 죽었다. 어떤 모양이 와도 문자열을 낸다.
    """
    L = k.get('links') or {}
    if isinstance(L, str):
        return L
    for key in ('pc', 'mobile', 'final'):
        v = L.get(key)
        if isinstance(v, str) and v:
            return v
        if isinstance(v, dict):
            for k2 in ('final', 'url', 'pc', 'mobile'):
                if isinstance(v.get(k2), str) and v[k2]:
                    return v[k2]
    return ''


def path_of(u):
    u = u or ''
    return u[len(SITE):] if u.startswith(SITE) else u


def region_of(keyword, path):
    """
    목적지 지역을 정한다.

    ⚠️ 지역을 «추측하지 않는다». URL 이나 키워드에서 세 지역 중 하나가 실제로 읽힐 때만
       옮기고, 안 읽히면 건드리지 않고 남긴다 — 틀린 지역으로 보내면 지금보다 나쁘다.
    """
    m = re.match(r'^/apt/redev/(.+)$', urllib.parse.unquote(path))
    if m and m.group(1) in REGIONS:
        return m.group(1)
    if urllib.parse.unquote(path).startswith('/apt/busan'):
        return '부산'
    for r in REGIONS:                       # /apt/unsold · /apt/pipeline 은 키워드가 말한다
        if r in (keyword or ''):
            return r
    return None


def alive(url):
    try:
        with urllib.request.urlopen(
                urllib.request.Request(url, headers={'User-Agent': 'kadeora-pl/1.0'}), timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return 'ERR ' + str(e)[:30]


def main():
    print('■ 착지 교체 %s\n' % ('[실제 실행]' if LIVE else '[예행 — 변경 0건]'))
    plan, skipped = [], []
    for name, gid in GROUPS.items():
        for k in sa.call('GET', '/ncc/keywords', params={'nccAdgroupId': gid}):
            cur = link_of(k)
            p = path_of(cur)
            if not any(urllib.parse.unquote(p).startswith(t) for t in MOVE_FROM):
                continue
            reg = region_of(k.get('keyword'), p)
            if not reg:
                skipped.append((k.get('keyword'), p))
                continue
            plan.append({'id': k['nccKeywordId'], 'kw': k.get('keyword'), 'raw': k,
                         'from': cur, 'to': SITE + '/apt/region/' + urllib.parse.quote(reg)})

    print('  옮길 키워드 %d개 · 지역을 못 읽어 «남기는» 것 %d개' % (len(plan), len(skipped)))
    for kw, p in skipped:
        print('    남김: %-22s %s' % (kw, urllib.parse.unquote(p)))

    dests = sorted({x['to'] for x in plan})
    print('\n  목적지 %d종 사전 확인:' % len(dests))
    dead = []
    for d in dests:
        c = alive(d)
        n = sum(1 for x in plan if x['to'] == d)
        print('    %-6s %-46s (%d키워드)' % (c, urllib.parse.unquote(d.replace(SITE, '')), n))
        if c != 200:
            dead.append(d)
    if dead:
        sys.exit('⛔ 목적지가 200 이 아니다. 옮기지 않는다: %s' % dead)

    if not LIVE:
        print('\n  --live 없이 실행했다. 변경 0건.')
        return

    # ⚠️ 본문은 «배열» 이다(sa.py:771 과 같은 모양). fields=links 로 부분 갱신.
    B = 50
    for i in range(0, len(plan), B):
        chunk = plan[i:i + B]
        # ⚠️⚠️ 본문에 «전체 키워드 객체» 를 실어야 한다. id + links 만 보내면 500(code 1005)이다.
        #    fields=links 는 그대로 둔다 — 그것이 «적용 대상» 을 links 로 한정한다.
        #    실측 확인: 이 형태로 보낸 뒤 bidAmt·userLock·status 가 «그대로» 였다.
        payload = []
        for x in chunk:
            o = dict(x['raw'])
            o['links'] = {'pc': {'final': x['to']}, 'mobile': {'final': x['to']}}
            payload.append(o)
        sa.call('PUT', '/ncc/keywords', params={'fields': 'links'}, body=payload)
        print('  요청 보냄 %d건' % len(chunk))
        time.sleep(0.4)

    # ── 재조회 검증 ─────────────────────────────────────────────────────────
    time.sleep(2)
    want = {x['id']: x['to'] for x in plan}
    okc, bad = 0, []
    for name, gid in GROUPS.items():
        for k in sa.call('GET', '/ncc/keywords', params={'nccAdgroupId': gid}):
            if k['nccKeywordId'] not in want:
                continue
            now = link_of(k)
            if urllib.parse.unquote(now) == urllib.parse.unquote(want[k['nccKeywordId']]):
                okc += 1
            else:
                bad.append((k.get('keyword'), now))
    print('\n■ 재조회 — 반영 %d / %d · 안 바뀐 것 %d' % (okc, len(plan), len(bad)))
    for kw, now in bad[:10]:
        print('  ⚠️ %s → %s' % (kw, urllib.parse.unquote(path_of(now))))
    io.open(os.path.join(HERE, 'out_pl0', 'landing_changed.json'), 'w', encoding='utf-8').write(
        json.dumps(plan, ensure_ascii=False, indent=1))
    if bad:
        sys.exit(1)
    print('  ✅ 전부 반영 확인')


if __name__ == '__main__':
    main()
