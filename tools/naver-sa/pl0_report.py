#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PL-0 — 파워링크 성과·착지 실측 «보고 전용».

    python tools/naver-sa/pl0_report.py

⛔⛔ 이 스크립트는 광고를 «절대 바꾸지 않는다». GET 과 «조회용» POST(stat) 만 쓴다.
    on/off · 입찰 · 소재 수정은 지시서 PL 금지 항목이고, 그 판단은 이 표를 보고
    Node 가 한다. 쓰기 호출을 여기에 «추가하지 말 것» — 추가하려거든 별도 파일로.

⚠️ 착지 URL 검사는 «리드폼이 실제로 렌더되는가» 까지 본다. 200 인 것과 폼이 있는 것은
   다른 사실이다. D_기축 착지(post_move_in·landmark_active)는 200 이지만 폼이 없다 —
   광고비가 들어가는데 전환 지점이 없는 상태다. 그 구분이 이 보고의 핵심이다.
"""
import os, sys, json, io, time, datetime, urllib.request, urllib.error, re

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# ⚠️ 자격은 Windows «사용자» 환경변수에 있어 Git Bash 프로세스에는 안 실린다.
#    db.py 와 같은 방식으로 여기서 끌어온다. ⛔ 값을 출력하지 «말 것».
if not os.environ.get('NAVER_SA_API_KEY'):
    import subprocess
    for _n in ('NAVER_SA_API_KEY', 'NAVER_SA_SECRET_KEY', 'NAVER_SA_CUSTOMER_ID'):
        _o = subprocess.run(
            ['powershell', '-NoProfile', '-Command',
             "[Environment]::GetEnvironmentVariable('%s','User')" % _n],
            capture_output=True, text=True, encoding='utf-8')
        _v = (_o.stdout or '').strip()
        if _v:
            os.environ[_n] = _v

# sa.py 의 인증·호출부를 그대로 재사용한다(자격은 R6 것과 같다).
import importlib.util
spec = importlib.util.spec_from_file_location('sa', os.path.join(HERE, 'sa.py'))
sa = importlib.util.module_from_spec(spec)
sys.argv = [sys.argv[0]]          # sa.py 가 argparse 를 돌리지 않게
spec.loader.exec_module(sa)

if not (sa.API_KEY and sa.SECRET and sa.CUSTOMER):
    sys.exit('NAVER_SA_* 환경변수가 필요합니다.')

SITE = 'https://kadeora.app'
GROUPS = {
    '기존':        'grp-a001-01-000000072288447',
    'A_분양':      'grp-a001-01-000000072353924',
    'B_입주예정':  'grp-a001-01-000000072353948',
    'C_정비사업':  'grp-a001-01-000000072353971',
    'D_기축':      'grp-a001-01-000000072353993',
    'E_대표':      'grp-a001-01-000000072363917',
}


def stat(ids, fields, tr):
    """
    StatReport. ⚠️ 조회 전용 API 다.

    ⚠️ `ids` 를 JSON 배열 문자열로 보내면 11001「유효하지 않은 ID 형식」이 난다.
       이 API 는 «같은 이름의 파라미터를 여러 번» 받는다(ids=a&ids=b).
       requests 는 리스트를 그렇게 펼쳐 준다 — json.dumps 로 감싸지 «말 것».
    """
    return sa.call('GET', '/stats', params={
        'ids': list(ids),
        'fields': json.dumps(fields),
        'timeRange': json.dumps(tr),
    })


def link_of(k):
    """
    키워드의 연결 URL.

    ⚠️ `links` 의 값이 «문자열일 때도 dict 일 때도» 있다(일부 키워드가 {'final': ...} 형태).
       바로 슬라이스했다가 KeyError 로 죽었다. 어떤 모양이 와도 문자열을 내도록 한다.
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


def main():
    today = datetime.date.today()
    since = today - datetime.timedelta(days=14)
    tr = {'since': since.isoformat(), 'until': (today - datetime.timedelta(days=1)).isoformat()}
    print('■ PL-0 — 최근 14일 (%s ~ %s) · 광고 설정 변경 0건\n' % (tr['since'], tr['until']))

    # ── 1. 그룹 6개 성과 ────────────────────────────────────────────────────
    fields = ['impCnt', 'clkCnt', 'salesAmt', 'ctr', 'cpc', 'avgRnk']
    rows = {}
    try:
        r = stat(list(GROUPS.values()), fields, tr)
        for d in (r.get('data') or []):
            rows[d.get('id')] = d
    except Exception as e:
        print('  ⚠️ 그룹 성과 조회 실패: %s' % str(e)[:200])

    print('┌ 그룹별 성과')
    print('│ %-12s %8s %7s %10s %7s %8s %7s' % ('그룹', '노출', '클릭', '비용(원)', 'CTR%', 'CPC', '평균순위'))
    tot = {'impCnt': 0, 'clkCnt': 0, 'salesAmt': 0}
    for name, gid in GROUPS.items():
        d = rows.get(gid, {})
        imp = d.get('impCnt', 0) or 0
        clk = d.get('clkCnt', 0) or 0
        amt = d.get('salesAmt', 0) or 0
        tot['impCnt'] += imp; tot['clkCnt'] += clk; tot['salesAmt'] += amt
        print('│ %-12s %8s %7s %10s %7s %8s %7s' % (
            name, f'{imp:,}', f'{clk:,}', f'{amt:,}',
            ('%.2f' % (d.get('ctr') or 0)), f"{int(d.get('cpc') or 0):,}",
            ('%.1f' % (d.get('avgRnk') or 0))))
    print('│ %-12s %8s %7s %10s' % ('합계', f"{tot['impCnt']:,}", f"{tot['clkCnt']:,}", f"{tot['salesAmt']:,}"))
    print('└')

    # ── 2·3. 그룹별 키워드 + 연결 URL ───────────────────────────────────────
    all_kw = []
    for name, gid in GROUPS.items():
        try:
            kws = sa.call('GET', '/ncc/keywords', params={'nccAdgroupId': gid})
        except Exception as e:
            print('\n  ⚠️ %s 키워드 조회 실패: %s' % (name, str(e)[:150]))
            continue
        ids = [k['nccKeywordId'] for k in kws]
        st = {}
        for i in range(0, len(ids), 100):
            try:
                r = stat(ids[i:i + 100], ['impCnt', 'clkCnt', 'salesAmt'], tr)
                for d in (r.get('data') or []):
                    st[d.get('id')] = d
            except Exception as e:
                print('  ⚠️ %s 키워드 성과 실패: %s' % (name, str(e)[:120]))
            time.sleep(0.2)
        for k in kws:
            d = st.get(k['nccKeywordId'], {})
            all_kw.append({
                'group': name,
                'keyword': k.get('keyword'),
                'url': link_of(k),
                'on': k.get('userLock') is not True and k.get('status') != 'PAUSED',
                'imp': d.get('impCnt', 0) or 0,
                'clk': d.get('clkCnt', 0) or 0,
                'amt': d.get('salesAmt', 0) or 0,
            })
        print('\n┌ %s — 키워드 %d개 (클릭 상위 20)' % (name, len(kws)))
        top = sorted([x for x in all_kw if x['group'] == name], key=lambda x: -x['clk'])[:20]
        for t in top:
            print('│ %6s클릭 %7s노출  %-26s %s' % (
                t['clk'], t['imp'], (t['keyword'] or '')[:26], (t['url'] or '(없음)')[:70]))
        print('└')

    # ── 3. E_대표 착지 분포 ─────────────────────────────────────────────────
    def kind(u):
        p = u.replace(SITE, '') if u.startswith(SITE) else u
        if re.match(r'^/apt/region/', p): return '지역 허브'
        if re.match(r'^/apt/?($|\?)', p): return '/apt'
        if re.match(r'^/apt/[^/]+', p): return '현장 상세'
        if p in ('', '/'): return '홈'
        return '기타'
    e = [x for x in all_kw if x['group'] == 'E_대표']
    dist = {}
    for x in e:
        dist[kind(x['url'])] = dist.get(kind(x['url']), 0) + 1
    print('\n┌ E_대표 착지 분포 (키워드 %d개)' % len(e))
    for k, v in sorted(dist.items(), key=lambda kv: -kv[1]):
        print('│ %-10s %4d개' % (k, v))
    print('└')

    # ── 4. 착지 URL 전수 — 상태코드 + 리드폼 렌더 ───────────────────────────
    urls = sorted({x['url'] for x in all_kw if x['url']})
    print('\n■ 착지 URL %d종 검사 (상태코드 + 리드폼 렌더)' % len(urls))
    bad_status, no_form = [], []
    for u in urls:
        code, form = None, None
        try:
            req = urllib.request.Request(u, headers={'User-Agent': 'kadeora-pl0/1.0'})
            with urllib.request.urlopen(req, timeout=30) as r:
                code = r.status
                html = r.read().decode('utf-8', 'replace')
            # ⚠️ 「200 이다」와 「폼이 있다」는 다른 사실이다. 앵커·입력칸을 «둘 다» 본다.
            form = bool(re.search(r'id=["\']lead[-_]?form|#lead\b|name=["\']phone["\']', html))
        except urllib.error.HTTPError as ex:
            code = ex.code
        except Exception as ex:
            code = 'ERR ' + str(ex)[:40]
        if code != 200:
            bad_status.append((code, u))
        elif not form:
            no_form.append(u)
        time.sleep(0.15)

    print('  200 아님 %d건' % len(bad_status))
    for c, u in bad_status[:25]:
        print('    %-8s %s' % (c, u[:100]))
    print('  200 이지만 «리드폼 없음» %d건' % len(no_form))
    for u in no_form[:25]:
        n = sum(1 for x in all_kw if x['url'] == u)
        clk = sum(x['clk'] for x in all_kw if x['url'] == u)
        print('    키워드 %2d개 · 14일 클릭 %3d  %s' % (n, clk, u[:90]))
    if len(no_form) > 25:
        print('    ... 외 %d건' % (len(no_form) - 25))

    # ── 산출물 ──────────────────────────────────────────────────────────────
    out = os.path.join(HERE, 'out_pl0')
    os.makedirs(out, exist_ok=True)
    with io.open(os.path.join(out, 'keywords.json'), 'w', encoding='utf-8') as f:
        json.dump(all_kw, f, ensure_ascii=False, indent=1)
    # PL-1 이 스모크에 넣을 «고정 표본 30». 클릭 많은 순 — 실제로 돈이 들어가는 착지부터.
    seen, sample = set(), []
    for x in sorted(all_kw, key=lambda y: -y['clk']):
        if x['url'] and x['url'] not in seen:
            seen.add(x['url']); sample.append(x['url'])
        if len(sample) >= 30: break
    with io.open(os.path.join(out, 'landing_sample_30.json'), 'w', encoding='utf-8') as f:
        json.dump(sample, f, ensure_ascii=False, indent=1)
    print('\n  out_pl0/keywords.json · landing_sample_30.json 저장')
    print('\n⛔ 이 실행에서 «변경한 광고 설정: 0건».')


if __name__ == '__main__':
    main()
