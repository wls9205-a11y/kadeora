#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PL C-1 ⓐ «URL 부여» 경로 — 「일광더에스」(부울경_B_분양예정) 한 건에 착지를 준다.

    python tools/naver-sa/pl_c1a_landing_set.py          # 예행. 아무것도 바꾸지 않는다
    python tools/naver-sa/pl_c1a_landing_set.py --live   # 실제 부여

── 이 스크립트가 존재하는 이유 ─────────────────────────────────────────────
9/5 전수조사에서 이 키워드 하나가 남았다:
  · 부울경_B_분양예정 「일광더에스」 — 연결 URL 없음(그룹 기본 착지 = 홈)·bid 140
    ·7일 176노출/0클릭.
  · 같은 계정 A_분양 에 같은 키워드가 500원·일광 상세 착지로 살아 있고
    1,925노출/9클릭을 낸다.
홈으로 떨어지는 176노출은 «전환되지 않는 노출» 이고, 동시에 A_분양 과 자기 경쟁이다.

⛔ 양안 중 «어느 쪽인지는 Node 가 정한다» — OFF 인가, URL 부여인가.
   이 파일은 URL 경로의 준비물이고, OFF 경로는
   `docs/pl/PL_C1_A_일광더에스_OFF_20260906.csv` + `sa.py off --csv` 다.
   ⛔ Node 의 한 단어(`OFF` 또는 `URL`) 없이 --live 를 붙이지 않는다.

⚠️ `fields=links` 를 반드시 붙인다. 부분 갱신 지정이 없으면 입찰가·상태가 통째로 덮인다.
⚠️ 본문에는 «전체 키워드 객체» 를 실어야 한다 — id+links 만 보내면 500(code 1005)이다
   (pl_landing_fix.py 실측 교훈 승계).
⚠️ 옮기기 «전에» 목적지가 200 인지 확인한다. 죽은 곳으로 보내면 지금보다 나쁘다.
⚠️ 실행 «후 재조회» 로 반영을 센다 — 「요청이 200 이었다」는 확인이 아니다.
"""
import os, sys, time, urllib.request, urllib.error, urllib.parse

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

if not (sa.API_KEY and sa.SECRET and sa.CUSTOMER):
    sys.exit('NAVER_SA_* 환경변수가 필요합니다.')

SITE = 'https://kadeora.app'
LIVE = '--live' in sys.argv

# ── 승인 대상 (2026-09-05 스냅샷 실측 · 단 한 건) ───────────────────────────
# ⛔ 조건을 다시 계산하지 않는다. 이 id 하나가 대상이다.
GROUP_NAME = '부울경_B_분양예정'
GROUP_ID   = 'grp-a001-01-000000072376804'
KEYWORD_ID = 'nkw-a001-01-000008560733652'
KEYWORD    = '일광더에스'
# A_분양(nkw-...8560917260)이 쓰는 것과 «같은» 착지다. 두 곳이 갈리면 자기 경쟁이 남는다.
DEST = SITE + '/apt/' + urllib.parse.quote('일광-더에스-동일스위트')


def link_of(k):
    """⚠️ links 는 문자열일 때도 dict 일 때도 온다. 어떤 모양이 와도 문자열을 낸다."""
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


def alive(url):
    try:
        with urllib.request.urlopen(
                urllib.request.Request(url, headers={'User-Agent': 'kadeora-pl/1.0'}), timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception as e:
        return 'ERR ' + str(e)[:40]


def main():
    print('■ C-1 ⓐ 착지 부여 %s\n' % ('[실제 실행]' if LIVE else '[예행 — 변경 0건]'))

    found = [k for k in (sa.call('GET', '/ncc/keywords', params={'nccAdgroupId': GROUP_ID}) or [])
             if k.get('nccKeywordId') == KEYWORD_ID]
    if not found:
        sys.exit('⛔ 계정에 대상이 없다: %s (%s / %s)' % (KEYWORD, GROUP_NAME, KEYWORD_ID))
    k = found[0]
    if (k.get('keyword') or '').strip() != KEYWORD:
        sys.exit('⛔ id 가 가리키는 키워드가 다르다: %r (기대 %r)' % (k.get('keyword'), KEYWORD))

    cur = link_of(k)
    print('  대상   %s / %s' % (GROUP_NAME, KEYWORD))
    print('  현재   착지=%s · bid=%s · userLock=%s · status=%s'
          % (urllib.parse.unquote(cur) or '(없음 — 그룹 기본 = 홈)',
             k.get('bidAmt'), k.get('userLock'), k.get('status')))
    print('  목적지 %s' % urllib.parse.unquote(DEST))

    code = alive(DEST)
    print('\n  목적지 사전 확인: %s' % code)
    if code != 200:
        sys.exit('⛔ 목적지가 200 이 아니다. 부여하지 않는다.')

    if not LIVE:
        print('\n  --live 없이 실행했다. 변경 0건.')
        print('  ⛔ Node 가 `URL` 이라고 답한 뒤에만 --live 를 붙인다.')
        return

    body = dict(k)
    body['links'] = {'pc': {'final': DEST}, 'mobile': {'final': DEST}}
    sa.call('PUT', '/ncc/keywords', params={'fields': 'links'}, body=[body])
    print('\n  요청 보냄 1건')

    # ── 재조회 검증 — 여기가 이 스크립트의 «핵심» 이다 ───────────────────────
    time.sleep(2)
    again = [x for x in (sa.call('GET', '/ncc/keywords', params={'nccAdgroupId': GROUP_ID}) or [])
             if x.get('nccKeywordId') == KEYWORD_ID]
    if not again:
        sys.exit('⛔ 재조회에서 대상이 사라졌다.')
    now = link_of(again[0])
    same = urllib.parse.unquote(now) == urllib.parse.unquote(DEST)
    print('■ 재조회 — 착지=%s · bid=%s · userLock=%s'
          % (urllib.parse.unquote(now), again[0].get('bidAmt'), again[0].get('userLock')))
    if not same:
        sys.exit('⛔ 반영되지 않았다.')
    # ⚠️ 부분 갱신이 정말 «부분» 이었는지 센다. 입찰가가 덮였으면 여기서 걸린다.
    if again[0].get('bidAmt') != k.get('bidAmt'):
        sys.exit('⛔ 입찰가가 바뀌었다: %s → %s (fields=links 가 안 먹었다)'
                 % (k.get('bidAmt'), again[0].get('bidAmt')))
    print('  ✅ 착지 부여 확인 · 입찰가 불변')


if __name__ == '__main__':
    main()
