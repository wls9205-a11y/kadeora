# Kakao Local Geocoding 403 — 세션 145 후속 차단

## 현황
세션 145에서 좌표 없는 신규 분양 8건 일회성 보강 시도 중 Kakao Local API가 전 쿼리에 HTTP 403 응답. 세션 146 착수 시점에서 작업 전체 취소.

## 대상 리스트 (apt_sites, address IS NOT NULL, latitude IS NULL)
| name | address |
|---|---|
| PH159 | 제주특별자치도 제주시 조천읍 북촌리 1938번지 외 2필지 |
| 고덕신도시 아테라 A-63블록 공공분양주택 | 경기도 평택시 고덕동, 고덕면 일원(평택고덕국제화계획지구 내 A-63BL) |
| 두산위브더제니스 구미(조합원취소분) | 경상북도 구미시 광평동 227번지 일원 |
| 경기광주역 롯데캐슬 시그니처 1단지 | 경기도 광주시 양벌동 산54-3번지 |
| 동탄 그웬 160 (동탄2 B11BL) | 경기도 화성특례시 동탄2 택지개발지구 B11BL (신동720) |
| 인천가정2지구 B2블록 공공분양주택(후속사업) | 인천광역시 서구 가정동, 청라동 일원 인천가정2 공공주택지구내 B2블록 |
| 용인 고림 동문 디 이스트 | 경기도 용인시 처인구 고림동 620번지 일원 |
| 옥정중앙역 대방 디에트르(중상1, 복합1BL) | 경기도 양주시 옥정동 962-9, 962-8번지(옥정지구 중상1, 복합1블럭) |

## 403 응답 증거
스크립트 `scripts/geocode-and-satellite-missing.mjs` DRY_RUN 실행 시 모든 쿼리 (원본 address / 꼬리 정리본 / 동+번지만 / 광역+시군구+동 / name keyword search) 에 대해:
```
(address API last HTTP 403)
```
- 사용 키: `KAKAO_REST_API_KEY` (.env.local 존재)
- 엔드포인트: `https://dapi.kakao.com/v2/local/search/address.json`, `.../keyword.json`
- 요청 헤더: `Authorization: KakaoAK {KEY}`
- 상태: HTTP 403 Forbidden (응답 body 미확인 — 향후 `res.text()` 로 정확한 에러코드 캡처 권장)

## Kakao REST 키 권한 체크리스트
1. [ ] https://developers.kakao.com/console/app 접속 → 해당 앱 선택
2. [ ] **제품 설정 → 카카오맵** 활성화 여부 확인 (Local API 요구)
3. [ ] **제품 설정 → 카카오맵 → 사용 동의** 상태 확인
4. [ ] **플랫폼 → Web 도메인** 에 `kadeora.app` 또는 로컬 개발 IP 등록 여부 (서버사이드 REST 호출은 도메인 제약 없음이 원칙이나 일부 앱 설정에서 차단 가능)
5. [ ] **앱 키 → REST API 키** 가 .env.local 의 `KAKAO_REST_API_KEY` 와 일치하는지 대조
6. [ ] **보안 → 카카오맵 Web SDK 키** 와 REST API 키 혼용 여부 점검 (별개)
7. [ ] **사용량 → 지도/로컬 API** 일일 쿼터 소진 여부 (무료 30만건/일)
8. [ ] 401 아닌 403 은 보통 "권한 미승인" 시그널 — 콘솔에서 "카카오맵" 약관 재동의 후 5분 대기

## 대안 경로 (우선순위)
1. **Kakao 권한 활성화** (최소 변경, 스크립트 재사용) — 위 체크리스트 통과 후 `node scripts/geocode-and-satellite-missing.mjs`
2. **VWorld Geocoder** — `VWORLD_API_KEY` Vercel env 에만 있고 .env.local 부재. 추가 필요
3. **Nominatim (OpenStreetMap)** — 무료, 키 불필요, rate limit 1 req/sec. 8건이면 충분
4. **수동 입력** — Google Maps 에서 8개 좌표 육안 확인 후 SQL UPDATE 8줄 직접 실행

## 파급
- /apt 페이지 상단 카드 중 8개가 여전히 /api/og 제네릭 렌더 유지
- pg_cron apt_satellite_crawl 은 `latitude NOT NULL AND longitude NOT NULL` 조건으로 이 8개는 영구 제외
- 세션 145 전체 목표(이미지 재오염 방어 + 우선순위 패치)는 달성, 이 건은 파생 보강 항목

## 재개 조건
위 체크리스트 1~8 중 원인 특정 → 해결 → 스크립트 재실행 → lat/lng DB UPDATE → pg_cron 다음 tick(30분 이내) 자동 satellite 생성.
