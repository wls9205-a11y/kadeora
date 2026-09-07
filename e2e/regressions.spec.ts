import { test, expect } from "@playwright/test";

/**
 * 회귀 스펙 — AD-9(2026-09-07) 신설.
 *
 * 기존 e2e 는 스모크 11종뿐이었고, 그마저 3,238 런 동안 «한 번도 실행되지 않았다»
 * (ci.yml 이 quality 에서 막혀 있었다 — AD-0). 올해 사고 계보 중 「같은 모양으로
 * 또 날 수 있는 것」을 여기에 회귀로 고정한다.
 *
 * ⚠️ 설계 원칙 — 이 파일은 «실 자격증명 없이도 돈다».
 *    Supabase 3종 키는 존재 여부만 검증되므로 CI 는 플레이스홀더로 서버를 띄운다.
 *    그 상태에서 DB 조회는 fallback 으로 떨어지는데, 아래 4종 중 3종은 그래도
 *    성립한다(없는 slug 는 여전히 404 여야 하고, 어드민 게이트는 미들웨어가 건다).
 *    실데이터가 있어야만 되는 1종은 «조건부 skip» 으로 두고 사유를 남긴다 —
 *    조용히 통과시키지 않는다.
 */

/* ── ① soft-404 계보 ────────────────────────────────────────────────────────
   G-2: loading.tsx 를 가진 세그먼트는 셸이 먼저 흘러 notFound() 가 404 를 만들지
   못하고 200 + 소프트 리다이렉트로 강등된다(DS_RULES#5-6). 그러면 «없는 대상의
   무한 변형 URL» 이 전부 색인 후보가 된다. 상태코드 자체를 계약으로 고정한다. */
test.describe("회귀 — 없는 대상은 200 이 아니라 404 다", () => {
  test("없는 apt slug 는 404", async ({ page }) => {
    const res = await page.goto("/apt/이런-단지는-없다-ad9-regression");
    expect(res?.status()).toBe(404);
  });

  test("없는 blog slug 는 404", async ({ page }) => {
    const res = await page.goto("/blog/이런-글은-없다-ad9-regression");
    expect(res?.status()).toBe(404);
  });
});

/* ── ② 무반응 CTA 계보 ──────────────────────────────────────────────────────
   리드폼은 이 제품의 «유일한 전환 지점» 이다. 폼이 안 뜨거나 필수 필드가 사라지면
   화면은 멀쩡해 보이는데 아무것도 들어오지 않는다 — 그게 무반응 CTA 사고의 모양이다. */
test.describe("회귀 — 현장 상세의 리드폼", () => {
  test("#lead-form 과 이름·연락처 필드가 렌더된다", async ({ page }) => {
    // ⚠️ 이 slug 는 «픽스처» 다. DB 에서 사라지면 이 테스트는 조용히 죽는 대신
    //    아래 skip 사유를 달고 건너뛴다. 그때는 살아 있는 현장 slug 로 교체할 것.
    const res = await page.goto("/apt/엄궁역-트라비스-하늘채");

    test.skip(
      res?.status() !== 200,
      "실 Supabase 자격증명이 없으면 현장 상세가 404 다(로컬·CI 플레이스홀더 환경). " +
        "폼 회귀는 시크릿이 등록된 환경에서만 판정한다 — 통과로 세지 않는다.",
    );

    await expect(page.locator("#lead-form")).toBeVisible();
    await expect(page.locator("#kd-lead-name")).toBeVisible();
    await expect(page.locator("#kd-lead-phone")).toBeVisible();

    // ⛔ 제출하지 않는다. 이 폼의 제출은 외부 Apps Script 로 «실전송» 되고,
    //    그 끝에 사람이 받는 리드가 쌓인다. 렌더까지만 본다.
  });
});

/* ── ③ 게이트 우회 계보 ─────────────────────────────────────────────────────
   /admin 은 미들웨어(로그인 + is_admin)가 유일한 문이다. 그 문이 열려 버리면
   화면상으로는 아무 일도 안 일어난 것처럼 보인다. */
test.describe("회귀 — 어드민 게이트", () => {
  test("비로그인 /admin 은 /login 으로 보낸다", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/login/);
    expect(new URL(page.url()).pathname).toBe("/login");
    // 어디로 가려 했는지도 잃지 않아야 한다 — 로그인 후 복귀 동선.
    expect(page.url()).toContain("redirect=%2Fadmin");
  });
});
