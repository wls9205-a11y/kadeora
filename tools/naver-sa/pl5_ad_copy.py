#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PL-A 판정 ② — 소재 문구의 금칙 표기 「부울경」을 뺀다.

    python tools/naver-sa/pl5_ad_copy.py            # 전후 표만. 아무것도 바꾸지 않는다
    python tools/naver-sa/pl5_ad_copy.py --probe    # «가장 한산한» 1건만 시험 수정
    python tools/naver-sa/pl5_ad_copy.py --live     # 16건 전부

── 왜 「빼는가」 ────────────────────────────────────────────────────────────
`src/lib/region/display.ts` 의 규칙 그대로다.
  ⛔ 「부울경」 금지 · ⛔ 「부산·울산·경남」 풀어쓰기도 금지 · ⛔ 「부산」으로 좁히기도 금지
  → **지역 단어를 빼는 것이 유일하게 참인 선택이다.** 어느 지역인지는 «키워드가» 말한다.

⚠️ 소재 문구를 API 로 «고칠 수 있는지» 가 확실하지 않다. 네이버는 소재에 대해 보통
   on/off 만 열어 두고 문구는 삭제·재생성을 요구한다. 그런데 그룹당 단일형 한도가 5이고
   지금 5가 차 있어서 「새로 만들고 지우기」 순서를 쓸 수 없다 — 지우면 그 사이 구멍이 난다.
   그래서 «먼저 1건만» 찔러 본다(--probe). 실패하면 아무것도 더 하지 않는다.

⚠️ --probe 대상은 `부울경_B_분양예정` 이다. 14일 노출 118 · 클릭 0 — 실패해도 잃을 것이 가장 적다.
⛔ 문구 수정은 재검토를 유발할 수 있다. 실행 후 status 를 반드시 다시 읽는다.
"""
import os, sys, json, time, re, collections

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
    '기존':                'grp-a001-01-000000072288447',
    'A_분양':              'grp-a001-01-000000072353924',
    'B_입주예정':          'grp-a001-01-000000072353948',
    'C_정비사업':          'grp-a001-01-000000072353971',
    'D_기축':              'grp-a001-01-000000072353993',
    'E_대표':              'grp-a001-01-000000072363917',
    '부울경_A_분양중':     'grp-a001-01-000000072376797',
    '부울경_B_분양예정':   'grp-a001-01-000000072376804',
    '부울경_C_미분양':     'grp-a001-01-000000072376809',
    '부울경_D_입주예정':   'grp-a001-01-000000072376814',
    '부울경_E_정비사업_1': 'grp-a001-01-000000072376823',
    '부울경_E_정비사업_2': 'grp-a001-01-000000072376826',
}
PROBE_GROUP = '부울경_B_분양예정'

PROBE = '--probe' in sys.argv
LIVE = '--live' in sys.argv


def strip_bg(t):
    if not t:
        return t
    return re.sub(r'\s+', ' ', re.sub(r'부울경\s*', '', t)).strip()


def collect():
    out = []
    for name, gid in GROUPS.items():
        g = sa.call('GET', '/ncc/adgroups/' + gid)
        if g.get('nccCampaignId') != CAMPAIGN:
            sys.exit('경계 위반: ' + name)
        for a in sa.call('GET', '/ncc/ads', params={'nccAdgroupId': gid}) or []:
            ad = a.get('ad') or {}
            if '부울경' in json.dumps(ad, ensure_ascii=False):
                out.append((name, a))
        time.sleep(0.25)
    return out


def patched(ad):
    new = dict(ad)
    for k in ('headline', 'description'):
        if new.get(k):
            new[k] = strip_bg(new[k])
    return new


def main():
    mode = '[1건 시험]' if PROBE else ('[실제 실행]' if LIVE else '[예행 — 아무것도 바꾸지 않는다]')
    print('■ PL-A 2 소재 금칙 표기 제거 ' + mode)
    print('')
    found = collect()
    for n, c in collections.Counter(n for n, _ in found).most_common():
        print('  %-20s %d건' % (n, c))
    print('')
    print('  대상 %d건' % len(found))

    targets = found
    if PROBE:
        targets = [x for x in found if x[0] == PROBE_GROUP][:1]
        if not targets:
            sys.exit('probe 대상을 찾지 못했다: ' + PROBE_GROUP)
        print('  probe 대상: %s / %s' % (targets[0][0], targets[0][1].get('nccAdId')))

    if not (PROBE or LIVE):
        for i, (n, a) in enumerate(found, 1):
            ad = a.get('ad') or {}
            p = patched(ad)
            print('')
            print('  [%d] %-18s %s' % (i, n, a.get('nccAdId')))
            for k, lab in (('headline', '헤드라인'), ('description', '설명문')):
                if ad.get(k) != p.get(k):
                    print('      %s  %s' % (lab, ad.get(k)))
                    print('      %s  → %s' % (' ' * len(lab), p.get(k)))
        print('')
        print('  --probe 로 1건 먼저 시험하세요. 문구 수정이 API 로 되는지 «모른다».')
        return

    # ⚠️ 3830 「Invalid ad type」 은 «못 고친다» 가 아니라 «본문이 모자라다» 는 신호였다.
    #    키워드 links PUT 때와 같다 — id 만 보내면 거부하고 «전체 객체» 를 요구한다.
    #    변형을 순서대로 시험한다. 실패한 시도는 아무것도 바꾸지 않으므로 안전하다.
    def variants(a):
        full = dict(a)
        full['ad'] = patched(a.get('ad') or {})
        aid = a.get('nccAdId')
        return [
            ('A 단수+전체객체', 'PUT', '/ncc/ads/' + aid, {'fields': 'ad'}, full),
            ('B 복수+배열',     'PUT', '/ncc/ads',        {'fields': 'ad'}, [full]),
            ('C 단수+type만',   'PUT', '/ncc/ads/' + aid, {'fields': 'ad'},
             {'nccAdId': aid, 'nccAdgroupId': a.get('nccAdgroupId'), 'type': a.get('type'),
              'ad': patched(a.get('ad') or {})}),
        ]

    ok, fail, method = 0, 0, None
    for n, a in targets:
        aid = a.get('nccAdId')
        done = False
        for label, m, path, params, body in variants(a):
            if method and label != method:
                continue
            try:
                sa.call(m, path, params=params, body=body)
                ok += 1; method = label; done = True
                print('  수정 요청 %s (%s) — 방식 %s' % (aid, n, label))
                break
            except Exception as e:
                print('  · 방식 %s 실패: %s' % (label, str(e)[:150]))
        if not done:
            fail += 1
            print('')
            print('  ⛔ 세 방식 모두 거부됐다. 문구는 API 로 못 고친다는 뜻이고,')
            print('     그러면 삭제·재생성뿐인데 그룹당 단일형 한도 5 때문에 순서를 짤 수 없다.')
            print('     → Node 판단 사항이다. 여기서 더 진행하지 않는다.')
            break
        time.sleep(0.4)

    if ok:
        time.sleep(2.0)
        again = collect()
        left = len(again)
        print('')
        print('■ 재조회 — 요청 %d · 실패 %d · 「부울경」 남은 소재 %d건' % (ok, fail, left))
        for n, a in again:
            ad = a.get('ad') or {}
            print('  남음 %-18s %s %s' % (n, a.get('nccAdId'), ad.get('headline') or ad.get('description')))
        # 검토 상태 — 문구를 고치면 재검토로 떨어질 수 있다
        st = collections.Counter()
        for name, gid in GROUPS.items():
            for a in sa.call('GET', '/ncc/ads', params={'nccAdgroupId': gid}) or []:
                st[(a.get('status'), a.get('statusReason'))] += 1
            time.sleep(0.2)
        print('')
        print('■ 캠페인 전 소재 검토 상태')
        for (s, r), c in st.most_common():
            print('  %-12s %-24s %d' % (s, r, c))


if __name__ == '__main__':
    main()
