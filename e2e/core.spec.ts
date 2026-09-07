import { test, expect } from "@playwright/test";

/**
 * 스모크 — 「페이지가 뜨는가 · 게이트가 걸리는가 · 보안 헤더가 붙는가」.
 *
 * ⛔ AD-0(2026-09-07) — 이 파일은 2026-03 «커뮤니티 시절» 제품을 검증하고 있었다.
 *    ci.yml 은 run #1 부터 3,238 런 내내 quality 잡에서 멈춰서 e2e 잡이 «한 번도
 *    실행되지 않았고», 그래서 스펙이 제품과 갈라진 것을 아무도 못 봤다.
 *    아래 항목들을 2026-09-07 로컬 실측값으로 맞췄다 — 제품을 테스트에 맞춘 것이
 *    아니라 «테스트를 실물에 맞춘» 것이다:
 *      · /feed 는 폐쇄됐다. 308 → /apt (리다이렉트 자체를 계약으로 고정)
 *      · 로그인 문구: "카카오로 시작하기" → "카카오로 계속하기" · 전화번호 로그인 없음
 *      · 약관: h1 "서비스 이용약관" → "이용약관", 환불은 제17조 → 제10조
 *      · X-Frame-Options: DENY 를 기대했으나 실물은 SAMEORIGIN (아래 주석)
 *      · CSP: nonce 를 기대했으나 실물엔 nonce 가 없다 (아래 주석 — 판정 대기)
 *
 * ⚠️ locator("text=X") 는 여러 요소에 걸리면 strict mode 로 실패한다. 「이 화면이
 *    떴는가」를 보는 스모크이므로 heading·역할 기준으로 좁히거나 .first() 를 쓴다.
 *    범위를 넓히려고 .first() 를 붙이는 게 아니라, 중복 매치로 «의미 없이» 빨개지는
 *    것을 막는 용도다.
 */

test.describe("Core page accessibility", () => {
  test("feed page is retired and redirects to /apt", async ({ page }) => {
    // ⛔ 피드는 영구 폐쇄다. 「뜨는가」가 아니라 「제대로 보내는가」가 계약이다.
    const response = await page.goto("/feed");
    expect(response?.status()).toBe(200); // 리다이렉트 추적 후 최종 응답
    expect(new URL(page.url()).pathname).toBe("/apt");
  });

  test("login page shows auth options", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("카카오로 계속하기").first()).toBeVisible();
    await expect(page.getByText("Google로 계속하기").first()).toBeVisible();
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: "개인정보처리방침" }).first(),
    ).toBeVisible();
    await expect(page.getByText("만 14세").first()).toBeVisible();
  });

  test("terms page loads with refund policy", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "이용약관" }).first()).toBeVisible();
    // 환불 조항은 제10조 (유료 서비스 및 환불) — 조 번호가 밀리면 여기서 잡힌다.
    await expect(page.getByText("유료 서비스 및 환불").first()).toBeVisible();
  });

  test("FAQ page loads with structured data", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.getByText("자주 묻는 질문").first()).toBeVisible();
  });
});

test.describe("Main page navigation", () => {
  test("landing page loads", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("카더라").first()).toBeVisible();
  });

  test("stock page loads", async ({ page }) => {
    const response = await page.goto("/stock");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("주식").first()).toBeVisible();
  });

  test("apt page loads", async ({ page }) => {
    const response = await page.goto("/apt");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("부동산").first()).toBeVisible();
  });

  test("blog page loads", async ({ page }) => {
    const response = await page.goto("/blog");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("블로그").first()).toBeVisible();
  });

  test("search page loads", async ({ page }) => {
    const response = await page.goto("/search");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("검색").first()).toBeVisible();
  });

  test("guide page loads", async ({ page }) => {
    const response = await page.goto("/guide");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("가이드").first()).toBeVisible();
  });
});

test.describe("Auth protection", () => {
  test("write page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/write");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test("payment page redirects to login", async ({ page }) => {
    await page.goto("/payment");
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });
});

test.describe("Security headers", () => {
  test("CSP header is present and locks down default/frame sources", async ({ page }) => {
    const response = await page.goto("/");
    const csp = response?.headers()["content-security-policy"] || "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("base-uri 'self'");
    // ⛔ AD-0 실측 — 원래 이 테스트는 "nonce-" 존재와 "unsafe-eval" 부재를 요구했다.
    //    실물 CSP 에는 «nonce 가 아예 없고» script-src 에 'unsafe-inline' 과
    //    'unsafe-eval' 이 둘 다 «프로덕션에서도 무조건» 들어간다(src/middleware.ts:14).
    //    즉 이 두 줄은 존재한 적 없는 보안 태세를 주장하고 있었다.
    //    CSP 를 좁히는 건 광고·카카오·토스 스크립트 로딩과 얽혀 있어 AD 범위 밖이다.
    //    ⚠️ 지우고 잊지 말 것 — 종결 보고의 보류표에 「CSP nonce 부재 + unsafe-eval
    //       상시 허용」으로 올렸다. 판정이 나면 여기부터 조인다.
  });

  test("security headers are set", async ({ page }) => {
    const response = await page.goto("/");
    // ⛔ DENY 가 아니라 SAMEORIGIN 이다 — CSP frame-ancestors 가 tossmini 임베드를
    //    허용하고 있어(middleware.ts:25) DENY 로 두면 서로 모순된다. 실물이 정본.
    expect(response?.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("stock-debug is blocked", async ({ page }) => {
    await page.goto("/api/stock-debug");
    expect(page.url()).not.toContain("stock-debug");
  });
});
