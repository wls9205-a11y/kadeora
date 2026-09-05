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

print()
print('■ ④ 단위 — alias_is_corp (CV-B ①-2 시공사 법인명 금지)')
for raw, main, builders, want in [
    ('사하구 두산건설(주)',            '사하 괴정5 재개발', ['두산건설(주)'], True),
    ('김해시 (주)일동',                '김해 외동 재건축사업', ['(주)일동'],   True),
    ('남구 삼정건설 주식회사',          '대연 가로주택정비',  ['삼정건설'],    True),
    ('경산시 제일건설 주식회사 외 1개업체', '경산 중산 코아루', ['제일건설'],   True),
    ('강서구 금호건설(주) 등',          '강서 금호어울림',    ['금호건설'],    True),
    ('동구 (주)태영건설',              '더 팰리스트 데시앙',  ['태영건설'],    True),
    # 살아야 하는 것들 — 브랜드·구역·결합형은 시공사명이 아니다
    ('서면 롯데캐슬',                  '양정3 재개발',       ['롯데건설'],    False),
    ('양정 롯데캐슬',                  '양정3 재개발',       ['롯데건설'],    False),
    ('창원자이',                       '창원자이 더 스카이',  ['GS건설'],      False),
    ('감만1구역',                      '부산 감만1 재개발',   ['한화건설'],    False),
    ('김해 외동 데시앙',               '김해 외동 재건축사업', ['태영건설'],   False),
]:
    got = sa.alias_is_corp(raw, sa.kw_name(raw), main, builders)
    check(got == want, '%-26s / %-20s → %s (기대 %s)' % (raw[:24], main[:18], got, want))

print()
# ⚠️ 영구 등재 — 2026-09-02 실제 사고. alias_is_corp 의 회사 꼬리 목록에 「개발」·「공사」를
#    «단독» 으로 넣었더니 「양정3 재개발」이 죽었다. 조각·법인명을 막는 문이 정상 결합형을
#    죽이는 형태는 PL-A 의 「창원자이」·「경남아너스빌」 사고와 «같은 종» 이다.
#    꼬리는 반드시 «명시» 로만 적는다(건설·산업개발·이앤씨·종합건설·토건·건업·주택공사·도시공사).
#    이 블록을 지우지 말 것 — 다음 사람이 같은 함정을 밟는다.
print('■ ④-b 과잉 차단 — 「재개발」·「도시개발」은 회사 꼬리가 아니다')
for raw, main, builders, want in [
    ('양정3 재개발',   '양정3구역',        ['롯데건설'],   False),
    ('감만1 재개발',   '부산 감만1구역',   ['한화건설'],   False),
    ('명지 국제신도시', '명지 더샵',        ['포스코이앤씨'], False),
]:
    got = sa.alias_is_corp(raw, sa.kw_name(raw), main, builders)
    check(got == want, '%-18s / %-16s → %s (기대 %s)' % (raw, main, got, want))

print()
print('■ ⑤ 회귀 — name_pool 이 법인명을 내놓지 않는다')
CORP_SAMPLES = [
    {'name': '사하 괴정5 재개발', 'builder': '두산건설(주)', 'builder_normalized': '두산건설',
     'variants': ['사하구 두산건설(주)', '괴정5구역', '사하 두산위브']},
    {'name': '대연 가로주택정비', 'builder': '삼정건설', 'builder_normalized': '삼정건설',
     'variants': ['남구 삼정건설 주식회사', '대연 포레나', '대연동 가로주택정비']},
]
for s_ in CORP_SAMPLES:
    pool = sa.name_pool(s_, max_alias=4)
    bad = [p for p in pool
           if sa.alias_is_corp(p, p, s_['name'],
                               [s_.get('builder'), s_.get('builder_normalized')])]
    check(not bad, '%-24s → %s' % (s_['name'][:22], pool))

print()
print('■ ⑥ 록아웃 캘린더 — 계정에 «쓰는» 명령만 막는다')
for day, want in [('2026-09-02', False), ('2026-09-03', True), ('2026-09-06', True), ('2026-09-07', False)]:
    got = sa.lockout_active(day) is not None
    check(got == want, '%s → %s (기대 %s)' % (day, '잠김' if got else '열림', '잠김' if want else '열림'))

# ⚠️ --live 가 없으면 애초에 아무것도 바꾸지 않으므로 문이 열려 있어야 한다.
#    록아웃이 읽기까지 막으면 창 안에서 «관측» 을 못 하게 되어 목적과 반대가 된다.
class _A:
    def __init__(self, **kw): self.__dict__.update(kw)
sa.assert_lockout_clear(_A(live=False))
check(True, '--live 없는 실행은 록아웃과 무관 (통과)')

print()
print('■ ⑦ 계정 실존 스캔 — keyword_flags')
for kw, main, want in [
    ('사하구 두산건설', '사하 괴정5 재개발', ['법인명']),
    ('사하구두산건설',  '사하 괴정5 재개발', ['법인명']),      # 공백이 지워져도 잡힌다
    ('외 데시앙',       '김해 외동 재건축사업', ['조각']),
    ('동래-반도-유보라', '반도유보라',        ['slug형']),
    ('서면 롯데캐슬',   '양정3 재개발',       []),
    ('가평 센트럴파크 더 스카이', '가평센트럴파크더스카이', []),  # 이름에 있는 한 글자
    ('김해김해외동재건축사업', '김해 외동 재건축사업', ['지역중복']),   # 이미 나간 층
]:
    got = sa.keyword_flags(kw, main)
    check(got == want, '%-22s → %s (기대 %s)' % (kw, got or '깨끗', want or '깨끗'))

print()
print('■ ⑧ 단위 — alias_is_dup_prefix (지역 접두 중복 · 2026-09-05)')
# ⚠️ 생산자(generate_apt_name_variants_jsonb)는 2026-09-02 에 이미 막혔다. 9/5 재생성
#    실측으로 «지금 함수는 0건» 을 확인했다. 그런데도 이 문이 필요한 이유는 그 «이전에»
#    앉은 데이터가 활성 1,955별칭·653현장 남아 있기 때문이다. 소비단의 두 번째 문이다.
for alias, main, want in [
    ('김해김해외동재건축사업',      '김해 외동 재건축사업', True),
    ('김해 김해 외동 재건축사업',   '김해 외동 재건축사업', True),
    ('김해시 김해 외동 재건축사업', '김해 외동 재건축사업', True),   # 행정 꼬리형
    ('창원 창원자이 더 스카이',     '창원자이 더 스카이',   True),
    # 살아야 하는 것들 — 접두가 «덧붙은» 것이 아니면 건드리지 않는다
    ('김해 외동 데시앙',           '김해 외동 재건축사업', False),
    ('외동 데시앙',                '김해 외동 재건축사업', False),
    ('김해 데시앙',                '김해 외동 재건축사업', False),
    ('서면 롯데캐슬',              '양정3 재개발',        False),
    ('창원자이 더 스카이',         '창원자이 더 스카이',   False),
    ('부산 감만1 재개발',          '감만1 재개발',        False),   # 접두가 이름에 없다 = 정상 결합
]:
    got = sa.alias_is_dup_prefix(alias, main)
    check(got == want, '%-24s / %-20s → %s (기대 %s)' % (alias[:22], main[:18], got, want))

print()
# ⚠️ 영구 등재 — 2026-09-05 실제 사고. builder 는 text 인데 builder_normalized 는 «text[]» 다.
#    그대로 alias_is_corp 로 넘어가 re.sub 에서 TypeError. 부울경 적격 1,182현장 중
#    470현장에서 name_pool 이 죽었고, cmd_build 는 전 현장을 훑으므로 첫 크래시에서
#    회전이 통째로 멈춘다. ⛔ 이 블록을 지우지 말 것.
print('■ ⑨ 회귀 — builder_normalized 가 배열이어도 name_pool 이 죽지 않는다')
try:
    pool = sa.name_pool({'name': '센트레빌 아스테리움 거제', 'sigungu': '거제시',
                         'builder': '동부건설', 'builder_normalized': ['동부건설'],
                         'variants': ['거제 센트레빌', '거제 아스테리움']}, max_alias=4)
    check(True, '배열 builder_normalized → %s' % pool)
except Exception as e:
    check(False, '배열 builder_normalized 에서 예외: %r' % (e,))

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
