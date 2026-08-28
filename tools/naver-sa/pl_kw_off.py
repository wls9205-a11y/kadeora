#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
승인된 «개별 키워드» 를 OFF 한다. (PL-0 표를 보고 Node 가 승인한 것만)

    python tools/naver-sa/pl_kw_off.py                # 대상만 출력, 아무것도 바꾸지 않는다
    python tools/naver-sa/pl_kw_off.py --live         # 실제로 끈다

⛔ 대상은 아래 APPROVED 목록 «뿐» 이다. 조건을 다시 계산하지 않는다 —
   CSV·표를 보고 사람이 정한 목록인데 코드가 조건을 또 만들면 두 판정이 갈린다(R6 와 같은 규칙).
⚠️ 삭제가 아니라 OFF(userLock)다. 되돌릴 수 있어야 한다.
⚠️ `fields=userLock` 을 «반드시» 붙인다. 부분 갱신 지정이 없으면 입찰가·연결URL 이 통째로 덮인다.
⚠️ 실행 «후 재조회» 해서 실제로 꺼졌는지 센다 — 「요청이 200 이었다」는 확인이 아니다.
"""
import os, sys, json, time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))

# 자격은 Windows 사용자 환경변수에 있다. ⛔ 값을 출력하지 말 것.
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

# ── 승인 목록 (2026-08-28) ──────────────────────────────────────────────────
# 「기존」 그룹의 기장원룸 — 14일 노출 492,633(전체 76%) · 클릭 241(전체 42%) · 연결 URL 없음.
# 원룸 임대 검색어이고 카더라에 그 콘텐츠가 없다. CTR 0.05%.
APPROVED = [
    ('grp-a001-01-000000072288447', '기장원룸'),
]

LIVE = '--live' in sys.argv


def keywords_of(gid):
    return sa.call('GET', '/ncc/keywords', params={'nccAdgroupId': gid})


def is_off(k):
    return k.get('userLock') is True


def main():
    print('■ 키워드 OFF %s\n' % ('[실제 실행]' if LIVE else '[예행 — 아무것도 바꾸지 않는다]'))
    targets = []
    for gid, kw in APPROVED:
        found = [k for k in keywords_of(gid) if k.get('keyword') == kw]
        if not found:
            print('  ⚠️ 계정에 «없음»: %s (%s)' % (kw, gid))
            continue
        for k in found:
            targets.append(k)
            print('  대상 %-14s id=%s 현재 userLock=%s' % (kw, k['nccKeywordId'], k.get('userLock')))

    already = [k for k in targets if is_off(k)]
    todo = [k for k in targets if not is_off(k)]
    print('\n  대상 %d개 · 이미 OFF %d · 끌 것 %d' % (len(targets), len(already), len(todo)))

    if not LIVE:
        print('\n  --live 없이 실행했다. 변경 0건.')
        return

    # ⚠️ 본문은 «배열» 이다. 한 건이어도 배열로 보낸다 —
    #    객체로 보내면 400 JSON parse error 가 난다(sa.py:771 과 같은 모양).
    if todo:
        sa.call('PUT', '/ncc/keywords', params={'fields': 'userLock'},
                body=[{'nccKeywordId': k['nccKeywordId'], 'userLock': True} for k in todo])
        for k in todo:
            print('  요청 보냄: %s' % k.get('keyword'))
        time.sleep(0.3)

    # ── 재조회 검증 — 여기가 이 스크립트의 «핵심» 이다 ───────────────────────
    time.sleep(1.5)
    off, still_on, missing = 0, [], 0
    for gid, kw in APPROVED:
        found = [k for k in keywords_of(gid) if k.get('keyword') == kw]
        if not found:
            missing += 1
            continue
        for k in found:
            if is_off(k):
                off += 1
            else:
                still_on.append(kw)
    print('\n■ 재조회 결과 — 꺼짐 %d · 아직 ON %d · 조회 안 됨 %d' % (off, len(still_on), missing))
    for kw in still_on:
        print('  ⚠️ 아직 ON: %s' % kw)
    if still_on or missing:
        sys.exit(1)
    print('  ✅ 승인 목록 전부 OFF 확인')


if __name__ == '__main__':
    main()
