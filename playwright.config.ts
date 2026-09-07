import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 14"] } },
  ],
  /* ⛔ AD-0(2026-09-07) — timeout 을 명시한다.
   * 기본값이 60초인데 CI 의 turbopack 콜드 스타트는 그 안에 못 끝낼 수 있다.
   * e2e 잡은 3,238 런 동안 한 번도 실행된 적이 없어서(quality 에서 막힘) 이
   * 여유가 충분한지 원격에서 확인된 적이 없다 — 넉넉히 잡아 둔다. */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
