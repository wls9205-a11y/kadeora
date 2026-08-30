#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PL-A 판정 ③ — «비활성 현장» 에 착지하는 키워드를 OFF 한다.

    python tools/naver-sa/pl5_off_inactive.py           # 대상만 출력
    python tools/naver-sa/pl5_off_inactive.py --live    # 실제로 끈다

대상 3현장 25키워드. 셋 다 `apt_sites.is_active = false` 인데 광고가 아직 가리킨다.
  괴정3구역-재건축          10  ← PV P0-2 중복 병합 대상
  초량-호반써밋-센트럴베이    10  ← PV P0-2 중복 병합 대상
  양산-물금-재건축            5  ← `/apt/양산물금-브라운스톤` 으로 리디렉트된다

⚠️ 셋 다 «지금은» 200 이고 리드폼도 뜬다. 「깨졌으니 끈다」가 아니라
   「DB 가 비활성으로 판정한 현장에 광고비를 넣지 않는다」가 이유다.
⚠️ 삭제가 아니라 OFF(userLock)다 — P0-2 병합이 끝나 canonical 로 옮길 수 있게 되면 되살린다.
⛔ 조건을 코드가 다시 계산하지 않는다. 아래 ID 목록이 확정 대상이다.

⚠️ 드리프트 86키워드는 여기에 «없다». 판정 ③ 은 「현행 stage 기준 연결 URL 갱신」을 지시했지만
   실측 결과 86건 전부 자기 현장 상세로 «정확히» 가고 있어 갱신할 URL 이 없다.
   드리프트는 착지가 아니라 «그룹 배치» 의 문제이고, 그 교정(그룹 이동)은 판정이 금지했다.
"""
import os, sys, json, time, collections

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
GROUPS = {
    'A_분양':     'grp-a001-01-000000072353924',
    'C_정비사업': 'grp-a001-01-000000072353971',
}

TARGETS = [
    ('nkw-a001-01-000008540645518', '초량호반써밋센트럴베이', '초량-호반써밋-센트럴베이'),
    ('nkw-a001-01-000008540645519', '초량호반써밋센트럴베이분양가', '초량-호반써밋-센트럴베이'),
    ('nkw-a001-01-000008540645520', '초량호반써밋센트럴베이모델하우스', '초량-호반써밋-센트럴베이'),
    ('nkw-a001-01-000008540645521', '초량호반써밋센트럴베이분양일정', '초량-호반써밋-센트럴베이'),
    ('nkw-a001-01-000008540645522', '초량호반써밋센트럴베이청약', '초량-호반써밋-센트럴베이'),
    ('nkw-a001-01-000008540645523', '초량호반써밋센트럴베이견본주택', '초량-호반써밋-센트럴베이'),
    ('nkw-a001-01-000008540645524', '초량호반써밋센트럴베이분양', '초량-호반써밋-센트럴베이'),
    ('nkw-a001-01-000008540645525', '초량호반써밋센트럴베이입주', '초량-호반써밋-센트럴베이'),
    ('nkw-a001-01-000008540645526', '초량호반써밋센트럴베이일반분양', '초량-호반써밋-센트럴베이'),
    ('nkw-a001-01-000008540645527', '초량호반써밋센트럴베이조합원분양', '초량-호반써밋-센트럴베이'),
    ('nkw-a001-01-000008540645568', '괴정3구역재건축', '괴정3구역-재건축'),
    ('nkw-a001-01-000008540645569', '괴정3구역재건축분양가', '괴정3구역-재건축'),
    ('nkw-a001-01-000008540645570', '괴정3구역재건축모델하우스', '괴정3구역-재건축'),
    ('nkw-a001-01-000008540645571', '괴정3구역재건축분양일정', '괴정3구역-재건축'),
    ('nkw-a001-01-000008540645572', '괴정3구역재건축청약', '괴정3구역-재건축'),
    ('nkw-a001-01-000008540645573', '괴정3구역재건축견본주택', '괴정3구역-재건축'),
    ('nkw-a001-01-000008540645574', '괴정3구역재건축분양', '괴정3구역-재건축'),
    ('nkw-a001-01-000008540645575', '괴정3구역재건축입주', '괴정3구역-재건축'),
    ('nkw-a001-01-000008540645576', '괴정3구역재건축일반분양', '괴정3구역-재건축'),
    ('nkw-a001-01-000008540645577', '괴정3구역재건축조합원분양', '괴정3구역-재건축'),
    ('nkw-a001-01-000008540647860', '양산물금재건축', '양산-물금-재건축'),
    ('nkw-a001-01-000008540647861', '양산물금재건축조합', '양산-물금-재건축'),
    ('nkw-a001-01-000008540647862', '양산물금재건축시공사', '양산-물금-재건축'),
    ('nkw-a001-01-000008540647863', '양산물금재건축분양', '양산-물금-재건축'),
    ('nkw-a001-01-000008540647864', '양산물금재건축분양가', '양산-물금-재건축'),
]

LIVE = '--live' in sys.argv


def fetch():
    want = {i for i, _, _ in TARGETS}
    out = []
    for name, gid in GROUPS.items():
        g = sa.call('GET', '/ncc/adgroups/' + gid)
        if g.get('nccCampaignId') != CAMPAIGN:
            sys.exit('경계 위반: ' + name)
        for k in sa.call('GET', '/ncc/keywords', params={'nccAdgroupId': gid}) or []:
            if k['nccKeywordId'] in want:
                out.append((name, k))
        time.sleep(0.25)
    return out


def main():
    print('■ PL-A 3 비활성 현장 착지 OFF ' +
          ('[실제 실행]' if LIVE else '[예행 — 아무것도 바꾸지 않는다]'))
    print('')
    found = fetch()
    for n, c in collections.Counter(n for n, _ in found).most_common():
        print('  %-20s %d건' % (n, c))
    by_slug = collections.Counter(s for i, k, s in TARGETS)
    for s, c in by_slug.most_common():
        print('  현장 %-28s %d키워드' % (s, c))
    print('')
    print('  대상 %d / 목록 %d' % (len(found), len(TARGETS)))
    todo = [k for _, k in found if k.get('userLock') is not True]
    print('  이미 OFF %d · 끌 것 %d' % (len(found) - len(todo), len(todo)))
    if not LIVE:
        print('')
        print('  --live 없이 실행했다. 변경 0건.')
        return
    for i in range(0, len(todo), 100):
        chunk = todo[i:i + 100]
        sa.call('PUT', '/ncc/keywords', params={'fields': 'userLock'},
                body=[{'nccKeywordId': k['nccKeywordId'], 'userLock': True} for k in chunk])
        print('  요청 보냄 %d건' % len(chunk))
        time.sleep(0.4)
    time.sleep(2.0)
    again = fetch()
    off = sum(1 for _, k in again if k.get('userLock') is True)
    on = [k.get('keyword') for _, k in again if k.get('userLock') is not True]
    print('')
    print('■ 재조회 — 꺼짐 %d · 아직 ON %d' % (off, len(on)))
    for w in on:
        print('  ⚠️ 아직 ON: %s' % w)
    if on:
        sys.exit(1)
    print('  ✅ 대상 전부 OFF 확인')


if __name__ == '__main__':
    main()
