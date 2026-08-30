#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PL-A 판정 ① — 「브랜드 접미어 단독」 키워드를 전 그룹 일괄 OFF 한다.

    python tools/naver-sa/pl5_kw_off.py           # 대상만 출력. 아무것도 바꾸지 않는다
    python tools/naver-sa/pl5_kw_off.py --live    # 실제로 끈다

⛔ 대상은 아래 APPROVED «뿐» 이다. 조건을 코드가 다시 계산하지 않는다 —
   PL-5 실측표를 보고 사람이 가른 목록이다 (pl_kw_off.py 와 같은 규칙).
⚠️ 삭제가 아니라 OFF(userLock)다. 되돌릴 수 있다.
⚠️ `fields=userLock` 을 «반드시» 붙인다 — 없으면 입찰가·연결 URL 이 통째로 덮인다.
⚠️ 실행 «후 재조회» 해서 실제로 꺼졌는지 센다.

── 가른 기준 (PL-5 §축3) ──────────────────────────────────────────────────
OFF : 브랜드·등급 접미어가 «단독» 으로 선 것. 어느 현장도 가리키지 못한다.
      (시그니처 39현장 · 아이파크 53 · 푸르지오 128 · 힐스테이트 143 공유)
남김: ① 「지역+브랜드」 결합형 — 판정이 허용한 형태
         창원자이 · 경남아너스빌 · 대연디아이엘 · 신문그리니티 · 광안SK뷰
      ② 지명·지구·공원 — 센텀파크 · 선암호수공원 · 장안지구 · 에코델타(시티)
      ③ 클릭이 «실제로» 나온 것 — 호수공원(clk 4 · CTR 0.29%) · 에코팰리스(clk 1)
      ④ 카테고리 수요어 — 주택청약 · 미분양 · 울산분양 · 부산아파트분양 …
         브랜드 접미어가 아니다. E_대표 그룹의 «존재 이유» 이기도 하다.
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

CAMPAIGN = 'cmp-a001-01-000000011002673'          # ⛔ 「카더라」 캠페인 밖으로 나가지 않는다
GROUPS = {
    '기존':              'grp-a001-01-000000072288447',
    'A_분양':            'grp-a001-01-000000072353924',
    'B_입주예정':        'grp-a001-01-000000072353948',
    'C_정비사업':        'grp-a001-01-000000072353971',
    'D_기축':            'grp-a001-01-000000072353993',
    'E_대표':            'grp-a001-01-000000072363917',
    '부울경_A_분양중':   'grp-a001-01-000000072376797',
    '부울경_B_분양예정': 'grp-a001-01-000000072376804',
    '부울경_C_미분양':   'grp-a001-01-000000072376809',
    '부울경_D_입주예정': 'grp-a001-01-000000072376814',
    '부울경_E_정비사업_1': 'grp-a001-01-000000072376823',
    '부울경_E_정비사업_2': 'grp-a001-01-000000072376826',
}

APPROVED = [
    '프리미엄', '리미티드', '시그니처', '플래티넘', '포레스트', '그랑블루', '프리미어',
    '아이파크', '양우내안애', '노르웨이숲', 'VIEW', '아시아드', '리버파크', '리치먼드',
    '푸르지오', '한라비발디', '메가시티', '시에르네', '아이유쉘', '센트레빌', '센트럴파크',
    '한화포레나', '오션포레', '우미린', '로제비앙', '디에트르', '그랑루체', '에듀리버',
    '센트럴스카이', '한양립스', '월드메르디앙', '비스타동원', '에듀포레', '대광로제비앙',
    '힐스테이트', '롯데캐슬', '에일린의', '엘리시움',
]

LIVE = '--live' in sys.argv


def keywords_of(gid):
    return sa.call('GET', '/ncc/keywords', params={'nccAdgroupId': gid}) or []


def collect():
    """캠페인 12그룹에서 APPROVED 와 «정확히» 일치하는 키워드를 모은다."""
    want = set(APPROVED)
    found = []
    for name, gid in GROUPS.items():
        g = sa.call('GET', '/ncc/adgroups/' + gid)
        if g.get('nccCampaignId') != CAMPAIGN:
            sys.exit('⛔ 경계 위반: %s 가 「카더라」 캠페인이 아니다' % name)
        for k in keywords_of(gid):
            if (k.get('keyword') or '') in want:
                found.append((name, k))
        time.sleep(0.25)
    return found


def main():
    print('■ PL-A ① 접미어 단독 키워드 OFF %s\n'
          % ('[실제 실행]' if LIVE else '[예행 — 아무것도 바꾸지 않는다]'))
    found = collect()
    per = collections.Counter(n for n, _ in found)
    for n, c in per.most_common():
        print('  %-20s %d건' % (n, c))
    seen = {k.get('keyword') for _, k in found}
    miss = [w for w in APPROVED if w not in seen]
    print('\n  대상 %d건 / 승인목록 %d단어 · 계정에 없는 단어 %d' % (len(found), len(APPROVED), len(miss)))
    for w in miss:
        print('    ⚠️ 계정에 없음: %s' % w)

    todo = [k for _, k in found if k.get('userLock') is not True]
    print('  이미 OFF %d · 끌 것 %d' % (len(found) - len(todo), len(todo)))

    if not LIVE:
        print('\n  --live 없이 실행했다. 변경 0건.')
        return

    for i in range(0, len(todo), 100):
        chunk = todo[i:i + 100]
        sa.call('PUT', '/ncc/keywords', params={'fields': 'userLock'},
                body=[{'nccKeywordId': k['nccKeywordId'], 'userLock': True} for k in chunk])
        print('  요청 보냄 %d건' % len(chunk))
        time.sleep(0.4)

    time.sleep(2.0)
    again = collect()
    off = sum(1 for _, k in again if k.get('userLock') is True)
    on = [k.get('keyword') for _, k in again if k.get('userLock') is not True]
    print('\n■ 재조회 — 꺼짐 %d · 아직 ON %d' % (off, len(on)))
    for w in on:
        print('  ⚠️ 아직 ON: %s' % w)
    if on:
        sys.exit(1)
    print('  ✅ 승인 목록 전부 OFF 확인')


if __name__ == '__main__':
    main()
