#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PL 6축 상시 감사 — 9/5 손감사를 코드로 (지시서 SUPL §C-3 · 계단 금지 원칙).

    python tools/naver-sa/pl_audit6.py                 # 표만 출력
    python tools/naver-sa/pl_audit6.py --csv           # 축별 명단 CSV 도 쓴다

⛔⛔ 광고 계정에 «쓰지 않는다». 계정 API 를 아예 부르지 않는다 —
    전부 `ad_keywords` 스냅샷 최신일 × `apt_sites` 조인이다. 록아웃과 무관하게 돈다.
⚠️ 그래서 이 표가 보는 것은 «어제까지의 계정» 이다. 집행 직전 확인은 `sa.py scan` 이다.

── 왜 코드로 옮기나 ────────────────────────────────────────────────────────
9/5 전수조사는 손으로 6축을 돌려 결함 3종을 찾았다. 손감사는 «한 번» 이다.
같은 결함이 다음 주에 다시 생기면 다음 사람이 처음부터 다시 판다.
정례 산출이 되어야 「0 이던 칸이 3 이 됐다」가 스스로 말한다.

── 축 ──────────────────────────────────────────────────────────────────────
  ① 무착지 가동           연결 URL 없이 도는 키워드 (그룹 기본 착지 = 홈)
  ② 착지 slug 미존재       /apt/{slug} 인데 apt_sites 에 그 slug 가 없다
  ③ 비활성·ad_blocked 착지  꺼진 현장/광고 금지 현장에 돈이 들어간다
  ④ 그룹 간 중복           같은 키워드가 두 그룹에서 동시에 돈다 (자기 경쟁)
  ⑤ 법인명·조각·slug형      ⚠️ 판정은 sa.py 의 keyword_flags() «그 함수» 를 부른다.
                           여기서 조건을 다시 쓰면 scan 과 두 판정이 갈린다.
  ⑥ 부울경 적격 미등록      sa.py 의 «그 SQL» 로 적격 현장을 뽑아 스냅샷과 뺀다
  ⑦ (보강) 외부·PC/모바일 불일치 착지 — 9/5 에 0 이었다. 0 이 유지되는지만 본다.
"""
import os, sys, io, csv

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'docs', 'pl', 'audit')

import importlib.util
spec = importlib.util.spec_from_file_location('sa', os.path.join(HERE, 'sa.py'))
sa = importlib.util.module_from_spec(spec)
_argv = sys.argv[:]
sys.argv = [sys.argv[0]]
spec.loader.exec_module(sa)
sys.argv = _argv

WRITE_CSV = '--csv' in sys.argv

# 카더라 캠페인. ⚠️ 계정에는 타 캠페인 10그룹(일광더에스·큐샵 계열)이 «불가침» 으로 있다.
# 그것들을 이 표에 섞으면 매번 「결함」이 잔뜩 뜨고, 그러면 아무도 이 표를 안 본다.
CAMPAIGN = 'cmp-a001-01-000000011002673'
ZONES = ('부산', '울산', '경남')

BASE = """
  from ad_keywords k
  left join apt_sites s on s.slug = k.site_slug
  where k.snapshot_date = %s and k.campaign_id = %s and k.status = 'ELIGIBLE'
"""


def q(cur, sql, args=None):
    cur.execute(sql, args or ())
    return [dict(r) for r in cur.fetchall()]


def collect():
    if not sa.DB_URL:
        sys.exit('SUPABASE_DB_URL 이 없습니다.')
    try:
        import psycopg2, psycopg2.extras
    except ImportError:
        sys.exit('pip install psycopg2-binary')

    ax = {}
    with psycopg2.connect(sa.DB_URL) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            day = q(cur, "select max(snapshot_date) as d from ad_keywords")[0]['d']
            arg = (day, CAMPAIGN)

            # ① 무착지 — PC·모바일 «둘 다» 비었을 때만이다.
            ax['1_무착지'] = q(cur, """
              select k.keyword_id, k.keyword, k.adgroup_name, k.bid
            """ + BASE + """
                and k.landing_pc is null and k.landing_mobile is null
              order by k.adgroup_name, k.keyword""", arg)

            # ② 착지 slug 미존재 — ⚠️ v_ad_coverage 는 apt_sites 기준 LEFT JOIN 이라
            #    여기에 «나타나지 않는다». 반대 방향으로 봐야 보인다(verify.sql ④ 와 같은 함정).
            ax['2_slug미존재'] = q(cur, """
              select k.keyword_id, k.keyword, k.adgroup_name, k.site_slug
            """ + BASE + """
                and k.site_slug is not null and s.slug is null
              order by k.site_slug, k.keyword""", arg)

            # ③ 비활성·ad_blocked 착지 — 돈이 새는 자리.
            ax['3_비활성착지'] = q(cur, """
              select k.keyword_id, k.keyword, k.adgroup_name, k.site_slug,
                     s.is_active, s.ad_blocked, s.ad_blocked_reason
            """ + BASE + """
                and (s.is_active is false or s.ad_blocked is true)
              order by k.site_slug, k.keyword""", arg)

            # ④ 그룹 간 중복 — 같은 키워드가 두 그룹에서 동시에 도는 «자기 경쟁».
            ax['4_그룹중복'] = q(cur, """
              with c as (
                select k.keyword, k.keyword_id, k.adgroup_name, k.bid, k.site_slug
              """ + BASE + """
              )
              select keyword, count(*) as 행수,
                     string_agg(adgroup_name || '(' || coalesce(bid::text, '-') || '/' ||
                                coalesce(site_slug, '무착지') || ')', ' | '
                                order by adgroup_name) as 분포,
                     string_agg(keyword_id, ',' order by adgroup_name) as 키워드ID들
                from c group by keyword having count(*) > 1
              order by count(*) desc, keyword""", arg)

            # ⑤ 법인명·조각·slug형 — SQL 은 «후보만» 좁히고, 판정은 scan 과 같은 함수가 한다.
            cand = q(cur, """
              select k.keyword_id, k.keyword, k.adgroup_name, k.site_slug, s.name as site_name
            """ + BASE + """
                and (k.keyword ~ '(주식회사|건설|이앤씨|산업개발|종합건설|토건|주택공사|도시공사)'
                     or k.keyword ~ '[가-힣]-[가-힣]'
                     or k.keyword ~ '^[가-힣][ ]'
                     -- 지역 접두 중복 후보: 공백을 지웠을 때 «대표명으로 끝나면서 더 긴» 키워드.
                     -- ⚠️ 후보일 뿐이다. 접두가 정말 중복인지는 keyword_flags 가 판정한다.
                     or (s.name is not null
                         and length(regexp_replace(k.keyword,'\s+','','g'))
                             > length(regexp_replace(s.name,'\s+','','g'))
                         and right(regexp_replace(k.keyword,'\s+','','g'),
                                   length(regexp_replace(s.name,'\s+','','g')))
                             = regexp_replace(s.name,'\s+','','g')))
              order by k.keyword""", arg)
            flagged = []
            for r in cand:
                why = sa.keyword_flags(r['keyword'], r.get('site_name') or '')
                if why:
                    flagged.append({
                        'keyword_id': r['keyword_id'], 'keyword': r['keyword'],
                        'adgroup_name': r['adgroup_name'], '사유': '·'.join(why),
                        'site_name': r.get('site_name'),
                    })
            ax['5_법인명조각'] = flagged

            # ⑥ 부울경 적격 미등록 — sa.py 의 «그 SQL» 을 그대로 쓴다.
            #    조건을 여기서 다시 쓰면 「등록 대상」의 정의가 두 벌이 된다.
            eligible = q(cur, sa.SQL)
            have = set()
            for r in q(cur, "select distinct k.site_slug" + BASE + " and k.site_slug is not null", arg):
                if r['site_slug']:
                    have.add(r['site_slug'])
            ax['6_부울경미등록'] = [
                {'slug': e['slug'], 'name': e['name'], 'cat': e['cat'],
                 'region': e['region'], 'sigungu': e['sigungu'],
                 'total_units': e['total_units'], 'content_score': e['content_score']}
                for e in eligible if e['region'] in ZONES and e['slug'] not in have
            ]

            # ⑦ (보강) 외부 착지 · PC↔모바일 불일치 — 9/5 에 0 이었다.
            ax['7_외부·불일치'] = q(cur, """
              select k.keyword_id, k.keyword, k.adgroup_name, k.landing_pc, k.landing_mobile
            """ + BASE + """
                and (
                  (k.landing_pc is not null and k.landing_pc not like 'https://kadeora.app%%')
                  or (k.landing_mobile is not null and k.landing_mobile not like 'https://kadeora.app%%')
                  or (k.landing_pc is not null and k.landing_mobile is not null
                      and k.landing_pc <> k.landing_mobile)
                )
              order by k.adgroup_name, k.keyword""", arg)
    return day, ax


def main():
    day, ax = collect()
    print('■ PL 6축 감사 — 스냅샷 %s · 캠페인 %s' % (day, CAMPAIGN))
    print('')
    for name, rows in ax.items():
        print('%s %-16s %5d' % ('  ' if not rows else '⚠️', name, len(rows)))
    print('')
    # 축마다 «어디에 몰려 있는가» 를 먼저 말한다. 643 같은 숫자는 분포 없이는 안 읽힌다.
    GROUP_BY = {'1_무착지': 'adgroup_name', '5_법인명조각': 'adgroup_name',
                '6_부울경미등록': 'cat', '3_비활성착지': 'site_slug'}
    for name, rows in ax.items():
        if not rows:
            continue
        print('── %s (%d) %s' % (name, len(rows), '─' * 28))
        key = GROUP_BY.get(name)
        if key and rows and key in rows[0]:
            dist = {}
            for r in rows:
                dist[r[key]] = dist.get(r[key], 0) + 1
            print('   분포: ' + ' · '.join('%s %d' % (k, v)
                                          for k, v in sorted(dist.items(), key=lambda x: -x[1])[:8]))
        for r in rows[:8]:
            print('   ' + ' · '.join('%s' % v for v in list(r.values())[:4]))
        if len(rows) > 8:
            print('   ... 외 %d건' % (len(rows) - 8))
        print('')

    if WRITE_CSV:
        os.makedirs(OUT, exist_ok=True)
        for name, rows in ax.items():
            if not rows:
                continue
            p = os.path.join(OUT, 'PL6_%s_%s.csv' % (name, day))
            with io.open(p, 'w', encoding='utf-8-sig', newline='') as f:
                w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
                w.writeheader()
                for r in rows:
                    w.writerow(r)
            print('CSV: %s (%d행)' % (os.path.normpath(p), len(rows)))

    # ⚠️ 종료코드로 판정하지 «않는다». 0 이 아닌 축이 늘 있을 수 있고, 그때마다 크론이
    #    빨개지면 아무도 이 표를 안 본다. 이것은 «읽히기 위한» 표다.


if __name__ == '__main__':
    main()
