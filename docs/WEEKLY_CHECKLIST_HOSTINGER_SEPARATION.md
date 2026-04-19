# Node 수동 작업 체크리스트 — 호스팅어 분리 후속

**생성일**: 2026-04-19
**배경**: 세션 141에서 카더라 코드베이스 분리 완료. Claude가 직접 못 하는 Node 수동 작업을 주간/월간 단위로 정리.

---

## 🔴 오늘 밤 (Day 0) — 1시간 30분

### A. 비밀번호·2FA 긴급 교체 (30분)
> 해킹된 WP admin 암호가 다른 계정에 재사용됐을 가능성 차단

- [ ] **GitHub 개인 액세스 토큰 `ghp_Zw0xj...` Revoke + 재발급**
  - github.com → Settings → Developer settings → Personal access tokens → Delete 기존 → Generate new (scope: `repo`)
  - 카더라 CI/CD 환경 (Vercel, 로컬 `.env`) 모두 새 토큰으로 업데이트
  - **⚠️ Claude 메모리에서 이미 제거 완료** (2026-04-19 이 세션)
- [ ] **Hostinger hPanel 비밀번호 교체 + 2FA ON**
  - 해커가 서버 레벨까지 장악했을 가능성 대비
- [ ] **Hostinger SSH 키 전부 Revoke, 새 키 생성**
  - hPanel → Advanced → SSH Access → Manage SSH Keys
- [ ] **Google 계정 (현재 카더라 등록된 계정) 비밀번호 교체**
- [ ] **Vercel 계정 비밀번호 + 2FA 확인**
- [ ] **Supabase 계정 비밀번호 + 2FA 확인**
- [ ] **Anthropic Console 비밀번호 + 2FA 확인**
- [ ] **Solapi 대시보드 비밀번호 교체** (API Key도 평문으로 Claude 메모리에 있음)
- [ ] **Toss Payments 계정 비밀번호**
- [ ] **카카오 개발자 콘솔 비밀번호**

### B. Vercel 환경변수 주입 (15분)
> 현재 카더라 GA 트래픽 측정 불가 상태 (env 미설정)

- [ ] **새 GA4 속성 생성**
  - analytics.google.com → 새 Google 계정 (카더라 전용) → 속성 만들기
  - 속성 이름: "kadeora" / 시간대: Asia/Seoul / 통화: KRW
  - 측정 ID 카피 (G-로 시작)
- [ ] **Vercel Dashboard 환경변수 주입**
  - vercel.com → kadeora → Settings → Environment Variables
  - 추가: `NEXT_PUBLIC_GA_ID` = `G-새속성ID`
  - 환경: Production, Preview, Development **모두**
- [ ] **Redeploy 트리거**
  - Deployments → 최신 → Redeploy (Use existing Build Cache 체크)
- [ ] **검증**: 배포 후 kadeora.app 방문 → 브라우저 devtools Network 탭에 `gtag/js?id=G-...` 요청 보이는지

### C. GSC 계정 분리 (30분)
> 카더라가 감염 도메인과 같은 Google 계정에 있어 연좌제 리스크

- [ ] **새 Google 계정 생성** (예: kadeora.admin@gmail.com)
  - 2FA 필수, 복구 정보 본인만 알 수 있게
- [ ] **search.google.com/search-console** 새 계정으로 로그인
- [ ] **구 계정에서 카더라 속성 → 설정 > 사용자 및 권한** → 새 계정을 **소유자**로 추가
- [ ] **새 계정으로 로그인** → DNS TXT 또는 HTML 파일로 소유권 확인
- [ ] **구 계정에서 본인 제거** (Remove yourself from kadeora property)
- [ ] **⚠️ 구 Google 계정은 절대 삭제하지 말 것** (최소 6개월 유지 — 감염 도메인 GSC 기록 보존)

### D. GSC URL Removal 제출 (15분)
> 감염된 일본 doorway 페이지 Google SERP에서 24~48h 내 제거

**구 Google 계정으로 로그인해서** 각 감염 도메인 속성별:

- [ ] **xn--zf0bv61a84di4cc7c4tay28c.com** (분양권실전투자)
  - Removals → New request → "Temporarily hide URL with this prefix"
  - URL prefix: `https://xn--zf0bv61a84di4cc7c4tay28c.com/`
- [ ] **xn--kj0bw8tr3a.com** (급매물)
  - 동일 절차
- [ ] **xn--9i2by8fvyb69i.site** (주린이)
  - 동일 절차

### E. 네이버 서치어드바이저 웹문서 수집제외 (15분)

- [ ] **searchadvisor.naver.com** 로그인
- [ ] 감염 3사이트 각각:
  - 사이트 관리 → 해당 사이트 → 요청 → **웹페이지 수집 제외**

---

## 🟠 내일 (Day 1) — 2시간

### F. boost-cache 자산 추출 (hPanel File Manager, 30분)
> 카더라 블로그 재활용 가능한 한국어 AI 콘텐츠 백업

**⚠️ Disable 전에 반드시 실행**

- [ ] hpanel.hostinger.com → 각 감염 사이트 → File Manager
- [ ] `public_html/wp-content/boost-cache/` 디렉토리 진입
- [ ] 전체 선택 → Compress → `.zip` 다운로드
- [ ] 3개 사이트 반복 (분양권실전투자, 급매물, 주린이)
- [ ] 로컬에 `boost-cache-rescue/` 폴더로 저장 (나중에 파싱 검토)

### G. hPanel에서 감염 3사이트 즉시 Disable (15분)
> Googlebot이 일본 doorway 먹는 것 중단

- [ ] hpanel.hostinger.com → Websites
- [ ] 분양권실전투자.com → ⋯ → Disable (또는 Suspend)
- [ ] 급매물.com → 동일
- [ ] 주린이.site → 동일

### H. hPanel에서 나머지 116개 Disable + 전체 auto-renewal OFF (1시간)

- [ ] **116개 나머지 사이트**: Websites 페이지에서 Select All → Bulk Disable (UI에 있으면)
- [ ] UI에 일괄 기능 없으면 Hostinger 지원팀에 티켓:
  > "계정 내 모든 웹사이트 일괄 suspend 요청 (119 sites). Japanese Keyword Hack 감염 확정."
- [ ] **Domains → 전체 선택 → Auto-renewal OFF**
- [ ] **이메일 호스팅 확인** (hPanel → Emails)
  - `@분양권실전투자.com` 등 계정 있으면: 수신 메일 백업 후 삭제
  - 해커가 비밀번호 재설정 링크 훔칠 수 있는 경로 차단

### I. Hostinger 지원 티켓 제출 — 플랜 다운그레이드 (15분)

- [ ] hpanel.hostinger.com → 우하단 챗봇 또는 Help → Contact support → **Human agent 요청**
- [ ] 이 채팅의 "영어 표준 (권장)" 티켓 본문 복붙
  - (제목: `Request to downgrade hosting plan to lowest tier`)
- [ ] 1~3일 내 상담원 회신 기다림
- [ ] 다음 갱신일(2027-03-25경) 자동 적용 확인

---

## 🟡 이번 주 (Day 2~7)

### J. Whois 프라이버시 확인 (15분)

- [ ] **kadeora.app Whois 조회**: https://who.is/whois/kadeora.app
  - 본인 이름/주소/전화 노출됐으면 → Cloudflare Registrar 또는 Vercel Domains에서 **Privacy Protection ON**
- [ ] 호스팅어 감염 도메인은 어차피 만료 예정이라 스킵

### K. 소셜 프로필 업데이트 (30분)
> 감염 도메인 링크가 외부에 걸려있으면 해커 서버로 연결됨

- [ ] **카카오톡 채널**: 연결 웹사이트 필드에서 감염 도메인 제거 → kadeora.app로 교체
- [ ] **네이버 블로그/카페** 공식 프로필
- [ ] **인스타그램 bio**
- [ ] **트위터/X 프로필**
- [ ] **오픈카톡방 공지**
- [ ] **명함·문서 인쇄본**에 기재된 도메인 (물리 자산 교체)

### L. 개인정보 유출 리콜 체크 (30분)
> WP 사이트에 회원가입·문의 폼이 있었다면 DB 탈취 리스크

- [ ] 감염된 WP 사이트에 Contact Form 7, WPForms 등 플러그인 설치했던 기억 있는지 리콜
- [ ] 있었다면: DB에 방문자 이메일/전화번호 저장 → 해커가 탈취했을 가능성
- [ ] 유출 범위 불명확하면 KISA 개인정보보호 포털 문의 (국번없이 118)
- [ ] 불확실성 크면 법무 자문 고려

### M. 카더라 Runtime Timeout 원인 규명 (별건, 1시간)
> 2026-04-19 04:38~04:40 구간 다발적 timeout 발생 (Vercel 로그 확인됨)

- [ ] Vercel Dashboard → kadeora → Deployments → 해당 시간대 로그 drill-down
- [ ] Supabase → Reports → Query Performance → slow queries 확인
- [ ] 매일 같은 시간에 재발하는지 모니터링
- [ ] 특정 크론이 DB lock 잡는 패턴인지 확인

---

## 🟢 이번 달 (Month 1)

### N. GSC Performance 추이 모니터링

- [ ] **새 계정 GSC → kadeora.app → 성능** 탭
- [ ] 일별 impression/click 추적 (호스팅어 유입 끊긴 후 하락폭 기록)
- [ ] 예상: 초기 30~50% 하락 → 3개월 내 회복 시작

### O. 네이버 서치어드바이저도 동일 모니터링

- [ ] **sitemap 제출 상태** 재확인
- [ ] 색인 요청 재전송 (변화 있으면)

### P. Hostinger 플랜 다운그레이드 확정 확인

- [ ] 지원팀 답신 수락 여부 확인
- [ ] 다음 갱신일까지 auto-renewal OFF 상태인지 재검증
- [ ] Billing 페이지에서 예상 청구 금액 확인

### Q. 카더라 새 Analytics 데이터 수집 시작 확인

- [ ] 새 GA4 속성에 데이터 들어오는지 확인
- [ ] Realtime 리포트에서 활성 사용자 표시되면 OK

---

## 🔵 3개월 후 (Month 3)

### R. 감염 도메인 SERP 정화 검증

- [ ] Google에서 `site:xn--zf0bv61a84di4cc7c4tay28c.com` 검색
- [ ] 일본 doorway 사라졌는지 확인 (미사라졌으면 Google Spam Report 제출)
- [ ] 네이버에서도 동일 검증

### S. 카더라 impression 회복 추세 확인

- [ ] GSC 성능 탭에서 하락→회복 전환 시점 기록
- [ ] 예상: 3개월차부터 점진 회복

---

## 🟣 6개월 후 (Month 6)

### T. 카더라 수동조치 이력 0 확인

- [ ] GSC → 보안 및 수동 조치 → 이슈 없음 상태 검증
- [ ] 있으면: 원인 분석 후 재검토 요청 (이때는 이미 감염 분리 완료돼 승인 가능성 높음)

### U. 구 Google 계정 정리 검토

- [ ] 감염 도메인들 deindex 완료됐으면 계정 내 속성 제거
- [ ] 그 후 구 계정 자체는 유지 (완전 삭제는 12개월 후)

---

## ⚫ 12개월 후 (Month 12)

### V. 호스팅어 도메인 자연 만료

- [ ] 119개 도메인 auto-renewal OFF 상태에서 자연 만료 확인
- [ ] Hostinger 계정 완전 해지 여부 결정

### W. 구 Google 계정 완전 정리

- [ ] 감염 도메인 잔존 없으면 구 계정 폐기 가능
- [ ] 모든 Google 서비스(GSC, GA, Ads, Business Profile) 카더라 전용 새 계정 단일화

---

## ⚠️ 절대 하지 말 것

- ❌ 감염 사이트 복구 시도 (해커 재침입 반복)
- ❌ 감염 사이트 → 카더라 301 redirect (평판 전이)
- ❌ GSC 재검토 요청을 감염 상태에서 제출 (manual action 연장)
- ❌ 해킹된 도메인을 다른 프로젝트에 재활용 (과거 이력 계승)
- ❌ 구 Google 계정 6개월 이내 삭제 (기록 보존 필요)
- ❌ 해킹된 사이트 파일을 카더라에 직접 업로드 (cloaking PHP 혼재 가능)
- ❌ Solapi API Key/Secret 메모리 유지 (주간 작업에서 정리)

---

## 📋 체크리스트 진행 상황 기록

완료한 항목에 날짜 기입:

```
A. 비밀번호·2FA: ___________ 완료 (날짜)
B. Vercel env 주입: ___________
C. GSC 계정 분리: ___________
D. GSC URL Removal: ___________
E. 네이버 수집제외: ___________
F. boost-cache 추출: ___________
G. 감염 3사이트 Disable: ___________
H. 나머지 116개 Disable + auto-renewal OFF: ___________
I. Hostinger 다운그레이드 티켓: ___________
J. Whois 프라이버시: ___________
K. 소셜 프로필 업데이트: ___________
L. 개인정보 유출 리콜: ___________
M. Runtime Timeout 원인 규명: ___________
N~W. (Month 1~12 항목): ___________
```

---

**이 파일은 `docs/WEEKLY_CHECKLIST_HOSTINGER_SEPARATION.md`로 카더라 repo에 두고 완료 시마다 커밋 권장.**
