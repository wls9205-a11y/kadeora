#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PL-A 판정 ⑥ — `E_대표` «그룹만» 기본입찰을 300원으로 올린다.

    python tools/naver-sa/pl5_bid_e.py           # 현재 값만 읽는다
    python tools/naver-sa/pl5_bid_e.py --live    # 실제로 바꾼다

⛔ 대상은 `E_대표` 그룹 «하나» 다. 다른 그룹·다른 캠페인은 손대지 않는다.
⛔ 하루예산(dailyBudget)은 «건드리지 않는다» — 판정이 상한 불변이라고 못 박았다.
   실행 후 예산이 그대로인지 재조회로 «확인» 한다. 「안 보냈으니 그대로겠지」는 확인이 아니다.

⚠️ 왜 그룹 값을 바꾸는가 — E_대표 158키워드가 «전부» `useGroupBidAmt=True` 다.
   즉 그룹 기본입찰이 실제로 먹는다. (키워드에 남아 있는 bidAmt 70 은 따르지 않는 값이다.)
⚠️ 네이버 PUT 은 «전체 객체» 를 요구한다 — 8/28 키워드 links PUT 이 그랬고,
   소재는 아예 거부한다(3830). 그래서 조회한 객체를 그대로 싣고 bidAmt 만 바꾼다.
⚠️ 적용 후 노출·순위 변화는 «기록만» 한다. 되돌리기 판단은 Node 몫이다.
"""
import os, sys, json, time

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
_argv = sys.argv[:]
sys.argv = [sys.argv[0]]
spec.loader.exec_module(sa)
sys.argv = _argv

if not (sa.API_KEY and sa.SECRET and sa.CUSTOMER):
    sys.exit('NAVER_SA_* 환경변수가 필요합니다.')

CAMPAIGN = 'cmp-a001-01-000000011002673'
GID = 'grp-a001-01-000000072363917'      # E_대표 «하나»
NEW_BID = 300

LIVE = '--live' in sys.argv


def show(g, tag):
    print('  %-6s name=%-8s bidAmt=%-5s dailyBudget=%-7s userLock=%-6s status=%s'
          % (tag, g.get('name'), g.get('bidAmt'), g.get('dailyBudget'),
             g.get('userLock'), g.get('status')))


def main():
    print('■ PL-A 6 E_대표 기본입찰 → %d원 %s'
          % (NEW_BID, '[실제 실행]' if LIVE else '[예행 — 아무것도 바꾸지 않는다]'))
    print('')
    g = sa.call('GET', '/ncc/adgroups/' + GID)
    if g.get('nccCampaignId') != CAMPAIGN:
        sys.exit('경계 위반: 「카더라」 캠페인이 아니다')
    if g.get('name') != 'E_대표':
        sys.exit('대상이 E_대표 가 아니다: %s' % g.get('name'))
    show(g, '전')

    kws = sa.call('GET', '/ncc/keywords', params={'nccAdgroupId': GID}) or []
    follow = sum(1 for k in kws if k.get('useGroupBidAmt') is True)
    print('  키워드 %d개 중 그룹입찰을 따르는 것 %d개' % (len(kws), follow))
    if follow != len(kws):
        print('  ⚠️ 일부가 자기 입찰을 쓴다 — 그룹 값만 올리면 그만큼은 안 먹는다.')

    if g.get('bidAmt') == NEW_BID:
        print('')
        print('  이미 %d원이다. 변경 0건.' % NEW_BID)
        return
    if not LIVE:
        print('')
        print('  --live 없이 실행했다. 변경 0건.')
        return

    before_budget = g.get('dailyBudget')
    body = dict(g)
    body['bidAmt'] = NEW_BID
    sa.call('PUT', '/ncc/adgroups/' + GID, params={'fields': 'bidAmt'}, body=body)
    print('  요청 보냄')

    time.sleep(2.0)
    after = sa.call('GET', '/ncc/adgroups/' + GID)
    print('')
    show(after, '후')
    ok = True
    if after.get('bidAmt') != NEW_BID:
        ok = False
        print('  ⛔ 입찰이 %s 다 — 반영되지 않았다.' % after.get('bidAmt'))
    if after.get('dailyBudget') != before_budget:
        ok = False
        print('  ⛔ 하루예산이 %s → %s 로 «바뀌었다». 판정 위반이다.'
              % (before_budget, after.get('dailyBudget')))
    else:
        print('  ✅ 하루예산 %s 그대로' % after.get('dailyBudget'))
    if ok:
        print('  ✅ E_대표 기본입찰 %d원 반영 확인' % NEW_BID)
    else:
        sys.exit(1)


if __name__ == '__main__':
    main()
