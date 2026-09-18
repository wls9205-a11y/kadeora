import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * FB-3 매트릭스 7항 — 우하단 FAB(부정공 단톡방) 교체 검증.
 *
 * 정본: FINAL_TYFB_20260918 §3 (원 지시서 UI_INSTRUCTION_20260910 은 리포 부재 —
 * 이 7항이 채팅 기록 재구성 정본이다).
 *
 * ⚠️ 실행처 — 기본은 config baseURL(로컬 `next build` + `next start`).
 *    프리뷰(*.vercel.app)는 SSO 보호 벽이라 자동화가 못 들어간다. 프로덕션 재검은
 *    `FAB_BASE_URL=https://kadeora.app`(커스텀 도메인 = 보호 밖)로 같은 spec 을 돌린다.
 * ⚠️ 프로젝트 분담 — 모바일 항목은 `mobile`(iPhone 14), 데스크톱 항목은 `chromium`.
 *    반대 프로젝트에서는 skip 한다(통과로 세지 않는다 — 7항 판정은 담당 프로젝트 결과로만).
 * ⛔ FAB 를 «클릭하지 않는다». 실클릭은 카카오 오픈채팅으로 실네비하고
 *    user_events(banner_click·slot=fab)를 오염시킨다. 배선은 소스 단언으로 본다.
 */

const BASE = process.env.FAB_BASE_URL?.replace(/\/$/, "") ?? "";
const url = (p: string) => `${BASE}${p}`;

const FAB = "a.kd-talk-fab";
const TALK_HREF = 'a[href*="open.kakao.com/o/gk8TBGyh"][target="_blank"]';
/** 현장 상세 픽스처 — regressions.spec 과 같은 slug. */
const SITE_DETAIL = "/apt/엄궁역-트라비스-하늘채";

async function gotoOk(page: Page, path: string) {
  const res = await page.goto(url(path), { waitUntil: "domcontentloaded" });
  expect(res?.status(), `${path} 응답`).toBeLessThan(400);
  return res;
}

test.describe("FB — 우하단 FAB 는 부정공 단톡방이다", () => {
  test("1 [mobile] FAB 노출 · 카카오 옐로 · 글쓰기 FAB 아님", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "모바일 항목");
    await gotoOk(page, "/feed");
    const fab = page.locator(FAB);
    await expect(fab).toBeVisible();
    await expect(fab).toHaveCSS("background-color", "rgb(254, 229, 0)"); // #FEE500
    await expect(fab).toHaveAttribute("href", /open\.kakao\.com\/o\/gk8TBGyh/);
    // 걷어낸 글쓰기 FAB(position:fixed · href=/write) 가 남아 있지 않다.
    const fixedWrite = await page.$$eval('a[href="/write"]', (els) =>
      els.filter((e) => getComputedStyle(e).position === "fixed").length,
    );
    expect(fixedWrite).toBe(0);
  });

  test("2 [mobile] 스크롤하면 접히고 최상단에서 다시 펼쳐진다", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "모바일 항목");
    await gotoOk(page, "/feed");
    const fab = page.locator(FAB);
    await expect(fab).toHaveAttribute("data-collapsed", "false");
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(fab).toHaveAttribute("data-collapsed", "true");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(fab).toHaveAttribute("data-collapsed", "false");
  });

  test("3 [chromium] 데스크톱은 확장형 필 — 라벨 노출", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "데스크톱 항목");
    await gotoOk(page, "/feed");
    const fab = page.locator(FAB);
    await expect(fab).toBeVisible();
    await expect(fab).toHaveAttribute("data-collapsed", "false");
    await expect(fab.locator(".kd-talk-fab__label")).toBeVisible();
    await expect(fab.locator(".kd-talk-fab__label")).toHaveText("부정공 단톡방");
  });

  test("4 링크 단언 + trackTalkClick('fab') 배선 — 클릭 없이", async ({ page }) => {
    await gotoOk(page, "/feed");
    await expect(page.locator(`${FAB}${TALK_HREF.slice(1)}`)).toHaveCount(1);
    const src = readFileSync(join(process.cwd(), "src/components/banner/TalkFab.tsx"), "utf8");
    expect(src).toMatch(/onClick=\{\(\)\s*=>\s*trackTalkClick\('fab'\)\}/);
    expect(src).toMatch(/href=\{KAKAO_TALK_URL\}/);
  });

  test("5 피드 목록 상단 글쓰기 진입점이 있고 /write 로 보낸다", async ({ page }) => {
    await gotoOk(page, "/feed");
    const btn = page.getByRole("button", { name: "글쓰기" });
    await expect(btn).toBeVisible();
    await btn.click();
    // 게스트는 /write 에서 로그인으로 넘어갈 수 있다 — 어느 쪽이든 «동작» 이다.
    await page.waitForURL(/\/(write|login)/, { timeout: 15_000 });
  });

  test("6 현장 상세에서는 FAB 를 렌더하지 않는다", async ({ page }) => {
    const res = await page.goto(url(SITE_DETAIL), { waitUntil: "domcontentloaded" });
    expect(res?.status(), "현장 상세 픽스처 응답").toBe(200);
    await page.waitForLoadState("load");
    await expect(page.locator(FAB)).toHaveCount(0);
    // 대조군 — 허브(/apt)에서는 뜬다.
    await gotoOk(page, "/apt");
    await expect(page.locator(FAB)).toHaveCount(1);
  });

  test("7 회귀 — 탭바 md:hidden · 히어로 라운드 · FAB 인라인 display 0", async ({ page }, info) => {
    const desktop = info.project.name === "chromium";
    await gotoOk(page, "/");
    // 모바일 하단 탭바: 데스크톱에서는 보이지 않는다(인라인 display 가 md:hidden 을 이기던 계보).
    const tabbar = page.locator("nav.md\\:hidden").first();
    if (desktop) await expect(tabbar).toBeHidden();
    else await expect(tabbar).toBeVisible();
    // 히어로 라운드 — 모바일 22 / 데스크톱 26.
    await expect(page.locator(".kd-home-hero").first()).toHaveCSS(
      "border-top-left-radius",
      desktop ? "26px" : "22px",
    );
    // FAB 인라인 style 에 display 가 없다.
    const inline = await page.locator(FAB).getAttribute("style");
    expect(inline ?? "").not.toMatch(/display\s*:/);
  });
});
