import { test, expect } from "@playwright/test";

/**
 * Kent C. Dodds: "결제 플로우 E2E 테스트 필수"
 */

test.describe("Core page accessibility", () => {
  test("feed page loads and shows navigation", async ({ page }) => {
    await page.goto("/feed");
    await expect(page.locator("text=카더라")).toBeVisible();
    await expect(page.locator("text=피드")).toBeVisible();
  });

  test("login page shows auth options", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=카카오로 시작하기")).toBeVisible();
    await expect(page.locator("text=구글로 시작하기")).toBeVisible();
    await expect(page.locator("text=전화번호로 시작하기")).toBeVisible();
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("text=개인정보처리방침")).toBeVisible();
    await expect(page.locator("text=만 14세")).toBeVisible();
  });

  test("terms page loads with refund policy", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("text=서비스 이용약관")).toBeVisible();
    await expect(page.locator("text=제17조")).toBeVisible();
  });

  test("FAQ page loads with structured data", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.locator("text=자주 묻는 질문")).toBeVisible();
  });
});

test.describe("Main page navigation", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=카더라")).toBeVisible();
  });

  test("stock page loads", async ({ page }) => {
    await page.goto("/stock");
    await expect(page.locator("text=주식")).toBeVisible();
  });

  test("apt page loads", async ({ page }) => {
    await page.goto("/apt");
    await expect(page.locator("text=부동산")).toBeVisible();
  });

  test("blog page loads", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.locator("text=블로그")).toBeVisible();
  });

  test("search page loads", async ({ page }) => {
    await page.goto("/search");
    await expect(page.locator("text=검색")).toBeVisible();
  });

  test("guide page loads", async ({ page }) => {
    await page.goto("/guide");
    await expect(page.locator("text=가이드")).toBeVisible();
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
  test("CSP header is present with nonce", async ({ page }) => {
    const response = await page.goto("/feed");
    const csp = response?.headers()["content-security-policy"] || "";
    expect(csp).toContain("nonce-");
    expect(csp).not.toContain("unsafe-eval");
  });

  test("security headers are set", async ({ page }) => {
    const response = await page.goto("/feed");
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("stock-debug is blocked", async ({ page }) => {
    await page.goto("/api/stock-debug");
    expect(page.url()).not.toContain("stock-debug");
  });
});
