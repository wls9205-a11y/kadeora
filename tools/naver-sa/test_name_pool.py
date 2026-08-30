#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PL-A 판정 ① 잠금 — 「접미어 단독」 키워드를 생성기가 «다시 만들지 않는다».

    python tools/naver-sa/test_name_pool.py

SUPABASE_DB_URL 이 있으면 전 현장을 실제로 훑어 OFF 목록 38단어가 한 건도
재생성되지 않는지 «전수» 로 확인한다. 없으면 고정 표본만 돈다.

⚠️ 이 테스트가 지키는 것은 «없어야 할 것이 없다» 이다. 동시에 «있어야 할 것이 있다» 도
   같이 잰다 — 결합형(「서면 롯데캐슬」)까지 죽이면 유입을 잃는다. 한쪽만 재면 과잉 차단을 못 잡는다.
"""
import os, sys, importlib.util

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('sa', os.path.join(HERE, 'sa.py'))
sa = importlib.util.module_from_spec(spec)
_argv = sys.argv[:]
sys.argv = [sys.argv[0]]
spec.loader.exec_module(sa)
sys.argv = _argv

# PL-A ① 로 끈 38단어. 생성기가 이 중 하나라도 다시 만들면 실패다.
BANNED = set("""
프리미엄 리미티드 시그니처 플래티넘 포레스트 그랑블루 프리미어 아이파크 양우내안애
노르웨이숲 VIEW 아시아드 리버파크 리치먼드 푸르지오 한라비발디 메가시티 시에르네
아이유쉘 센트레빌 센트럴파크 한화포레나 오션포레 우미린 로제비앙 디에트르 그랑루체
에듀리버 센트럴스카이 한양립스 월드메르디앙 비스타동원 에듀포레 대광로제비앙
힐스테이트 롯데캐슬 에일린의 엘리시움
""".split())

fails = []


def check(cond, msg):
    print(('  ✅ ' if cond else '  ❌ ') + msg)
    if not cond:
        fails.append(msg)


print('■ ① 단위 — alias_is_fragment')
for alias, main, want in [
    ('시그니처', '김해 구산 롯데캐슬 시그니처', True),    # 대표명의 조각
    ('푸르지오', '거제 푸르지오 마린피스',       True),
    ('에일린의', '울산 호수공원 에일린의 뜰 2단지', True),
    ('VIEW',    '센텀파크',                    True),    # 목록 문
    ('아이파크', '창원 센트럴 아이파크',         True),
    ('서면 롯데캐슬', '양정3 재개발',            False),   # 결합형 — 살아야 한다
    ('창원자이',  '창원자이 더 스카이',           False),   # 지역+브랜드
    ('경남아너스빌', '김해 경남아너스빌',          False),
    ('감만1구역', '부산 감만1 재개발',            False),   # 구역 식별자
    ('양정3구역', '양정3 재개발',                False),
]:
    got = sa.alias_is_fragment(alias, main)
    check(got == want, '%-14s / %-22s → %s (기대 %s)' % (alias, main, got, want))

print('\n■ ② 회귀 — name_pool 이 금지어를 내놓지 않는다')
SAMPLES = [
    {'name': '김해 구산 롯데캐슬 시그니처', 'variants': ['시그니처', '김해구산롯데캐슬', '구산 롯데캐슬']},
    {'name': '써밋 리미티드 남천',        'variants': ['리미티드', '남천 써밋', '써밋리미티드']},
    {'name': '경성대부경대역 비스타동원 더 프리미엄',
     'variants': ['프리미엄', '비스타동원', '경성대 비스타동원']},
    {'name': '울산 호수공원 에일린의 뜰 2단지', 'variants': ['에일린의', '호수공원 에일린의뜰']},
]
for s in SAMPLES:
    pool = sa.name_pool(s, max_alias=4)
    bad = [p for p in pool if p in BANNED]
    check(not bad, '%-28s → %s' % (s['name'][:26], pool))

if os.environ.get('SUPABASE_DB_URL'):
    print('\n■ ③ 전수 — 전 현장 name_pool 스윕')
    sites = sa.fetch_sites()
    hit = {}
    total = 0
    for s in sites:
        for p in sa.name_pool(s, max_alias=4):
            total += 1
            if p in BANNED:
                hit.setdefault(p, []).append(s['name'])
    check(not hit, '현장 %d · 생성 키워드 %d · 금지어 재생성 %d종' % (len(sites), total, len(hit)))
    for w, names in list(hit.items())[:10]:
        print('     ❌ %s ← %s' % (w, names[:3]))
else:
    print('\n■ ③ 전수 — SUPABASE_DB_URL 없음. 건너뜀 (표본만 검증됨)')

print('\n%s  실패 %d건' % ('실패' if fails else '전부 통과', len(fails)))
sys.exit(1 if fails else 0)
