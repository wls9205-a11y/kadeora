# 파워링크 전국 등록 도구 (`sa.py`)

Supabase `apt_sites` 를 읽어 네이버 검색광고 대량등록 CSV 를 만들거나, SA API 로 직접 등록한다.
`apt_sites` 는 **읽기만** 한다. 이 도구는 어떤 테이블도 쓰지 않는다.

## 설치

```bash
pip install psycopg2-binary requests
```

`templates/` 의 CSV 3종은 네이버 대량관리에서 받은 원본이다.
`sa.py` 가 1~6행 헤더를 그대로 읽어 쓰므로 **편집하지 말 것.** 없으면 실행이 멈춘다.

## 환경변수

```bash
SUPABASE_DB_URL='postgresql://...'    # Supabase > Settings > Database > Connection string
NAVER_SA_API_KEY=...                  # 네이버광고 > 도구 > API 사용 관리
NAVER_SA_SECRET_KEY=...
NAVER_SA_CUSTOMER_ID=...
```

읽기 전용 DB 계정을 권장한다.
`SUPABASE_DB_URL` 만 있어도 `plan` · `build` 는 돈다. API 키는 `bids` · `apply` · `verify` 용.

## 실행 옵션

| 옵션 | 뜻 |
|---|---|
| `--only <zone>` | 수도권 / 부울경 / 대경 / 충청 / 호남강원제주 |
| `--cats A_분양중,B_분양예정,C_미분양` | 단계 선택. 기축 없이 먼저 돌려볼 때 유용 |
| `--max-alias 0\|2\|4` | 현장당 별칭 개수. 규모를 좌우한다 (기본 4) |
| `--bid <원>` | 그룹 기본 입찰가 (기본 80 — 임시값. `bids` 로 실측 후 정할 것) |
| `--gid <csv>` | 그룹ID 매핑 파일. **`광고그룹명,grp-...` 2열**짜리 `gid.csv` 다 (`groups.csv` 를 넘기면 0개 로드된다) |
| `--live` | `apply` 에서만. 없으면 아무것도 만들지 않는다 |

### 별칭 개수별 전국 규모

| `--max-alias` | 그룹 | 키워드 | 소재 | 업로드 |
|---|---|---|---|---|
| 0 | 50 | 26,728 | 400 | 3회 |
| 2 | 78 | 52,066 | 624 | 6회 |
| 4 (기본) | 92 | 64,735 | 736 | 8회 |

`name_variants` 에 고유 별칭 20,454개가 이미 들어 있다.
`양정3 재개발` → `양정3구역` `서면 롯데캐슬` `양정 롯데캐슬`.
사람들은 구역명이 아니라 브랜드명으로 검색하므로 별칭을 빼면 유입을 크게 놓친다.

## 순서

```bash
python sa.py plan  --only 부울경                    # DB만 읽음. 파일 안 만듦. 가장 안전한 첫 실행
python sa.py bids  --only 부울경                    # 입찰가 실측 → bids.csv. 기축 만들기 전 필수
python sa.py build --only 부울경 --max-alias 2      # out/ + groups.csv (자리표시 GID_<그룹명>)
#   → groups.csv 이름대로 네이버에 그룹 생성
#   → 「광고그룹명,grp-...」 2열짜리 gid.csv 를 «따로» 만든다
#     ⚠️ groups.csv 를 그대로 --gid 에 넘기지 말 것. 로더가 2번째 열에서 grp- 를 찾는데
#        거기엔 키워드 수가 들어 있어 0개가 로드된다 (지금은 그 경우 실행이 멈춘다)
python sa.py build --only 부울경 --max-alias 2 --gid gid.csv      # 완성본
#   → 완성본에 GID_ 로 시작하는 행이 0건인지 반드시 확인하고 올린다
python sa.py verify                                 # 등록 후 연결 URL 전수 대조
```

API 경로(그룹 생성부터 자동)는 되돌리기가 번거롭다. **CSV 로 한 zone 을 성공시킨 뒤에 쓸 것.**

```bash
python sa.py apply --only 부울경                    # 예행
python sa.py apply --only 부울경 --live --bid 150   # 실제
python sa.py rollback --live                        # sa_state.json 에 기록된 그룹 삭제
```

zone 진행 순서: **부울경 → 대경 → 충청 → 호남강원제주 → 수도권.**
수도권이 가장 크므로 마지막. 한 zone 씩 검수 통과를 확인하고 다음으로 간다.

## 등록 후 필수

```bash
python sa.py verify
```

```
총 N · URL없음 0 · DB에 없는 슬러그 0
```

셋 다 0이어야 한다. 0이 아니면 그 키워드는 클릭 시 단지 페이지가 아니라 `/apt/search` 로 튕긴다.

## 하지 말 것

1. 키워드 생성 · 그룹 분할 · 소재 문구 로직을 다시 짜지 말 것 — 검증을 통과했다
2. 자리표시를 `<...>` 로 바꾸지 말 것 — 70행 전량 반려 전례
3. CSV 를 UTF-8 로 저장하지 말 것 — `ENC = "cp949"` 를 바꾸면 한글이 전부 깨진다
4. 템플릿 1~6행을 지우지 말 것
5. 슬러그를 이름에서 재생성하지 말 것 — DB 의 `slug` 그대로
6. `apt_sites` 를 수정하지 말 것
7. `--live` 없이 실제 API 를 호출하지 말 것
8. 생성 그룹을 ON 으로 만들지 말 것 (`userLock: True` 유지)
9. `EXISTING_GROUPS` 를 지우지 말 것 — 계정에 이미 있는 키워드 3,100여 개를 제외 목록에
   넣는 용도다. 빠뜨리면 전량 중복 거부된다

## 계정 현황

| 광고그룹 | ID | 키워드 |
|---|---|---|
| 카더라 | grp-a001-01-000000072288447 | 117 |
| A_분양 | grp-a001-01-000000072353924 | 380 |
| B_입주예정 | grp-a001-01-000000072353948 | 856 |
| C_정비사업 | grp-a001-01-000000072353971 | 905 |
| D_기축 | grp-a001-01-000000072353993 | 744 |
| E_대표 | grp-a001-01-000000072363917 | 158 |

캠페인 `cmp-a001-01-000000011002673` · 비즈채널 `https://kadeora.app` (검토 완료)

`existing_keywords()` 가 API 로 조회해 자동 제외한다.
**API 키가 없으면 이 제외가 동작하지 않는다** — CSV 경로로만 갈 거라면 해당 그룹들을
수동으로 다운로드해 제외 목록을 만들어야 한다.
