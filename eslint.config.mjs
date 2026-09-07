import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/* H5-D2 — 「인라인 fontSize 리터럴 금지」는 «신규 파일에만» 건다.
 *
 * 기존 2,590곳을 한꺼번에 토큰으로 바꾸는 것은 금지돼 있다(S4-3 인라인 스케일링
 * 사고 이력 — 굵기·크기·접근성 규칙이 얽혀 있어 한 번에 손대면 원인을 못 가린다).
 * 그래서 전역 규칙으로 걸면 2,590개 에러가 나서 lint 자체가 무의미해진다.
 *
 * ⚠️ 목록에 파일을 «추가만» 한다. 빼는 건 규칙을 없애는 것과 같다.
 */
const H5_NEW_FILES = [
  "src/components/home/HeroSearch.tsx",
  "src/components/apt/RegionTileGrid.tsx",
  "src/components/apt/StageSummaryStrip.tsx",
  "src/lib/region/cookie.ts",
];

const NO_PX = [
  "error",
  {
    // fontSize: '14px'  ·  fontSize: "1.5rem"  — 문자열 리터럴 크기
    selector:
      "Property:matches([key.name='fontSize'],[key.value='fontSize']) > Literal[value=/^[0-9.]+(px|rem|em)$/]",
    message:
      "H5-D2: 새 컴포넌트는 fontSize 를 하드코딩하지 않는다. var(--fs-*) 를 쓸 것 " +
      "(--fs-xs~2xl · --fs-display/title/lead). 사용자의 글씨 크기 설정이 안 먹는다.",
  },
  {
    // fontSize: 14 — 숫자 리터럴(React 가 px 로 붙인다).
    // ⚠️ value 가 아니라 raw 로 잡는다. esquery 의 정규식 속성 매칭은 «문자열 값에만»
    //    붙어서 [value=/^[0-9.]+$/] 는 숫자 리터럴을 못 잡는다(2026-08-27 실측).
    selector:
      "Property:matches([key.name='fontSize'],[key.value='fontSize']) > Literal[raw=/^[0-9.]+$/]",
    message:
      "H5-D2: 새 컴포넌트는 fontSize 를 하드코딩하지 않는다. var(--fs-*) 를 쓸 것.",
  },
];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: H5_NEW_FILES,
    rules: { "no-restricted-syntax": NO_PX },
  },

  /* ⛔ AD-0(2026-09-07) — CI 초록 복원.
   *
   * ci.yml 의 quality 잡이 400 런 넘게 연속 실패해 있었고(test·e2e·build 는 그 뒤로
   * needs 에 걸려 통째로 skip), 원인은 전부 npm run lint 의 error 였다. 아래 둘은
   * 「코드를 고쳐서」가 아니라 「규칙이 이 리포에 안 맞아서」 남은 잔여분이다.
   *
   * ① src/_legacy/** — 롤백 참조용 스냅샷 보관소(임포트 0 실측). 첫 줄 @ts-nocheck 가
   *    바로 그 의도다. 보관물에 lint 를 강제하는 건 목적과 모순이라 대상에서 뺀다.
   *
   * ② @next/next/no-html-link-for-pages — Pages Router 전용 규칙인데 이 리포엔 pages/
   *    가 없다(App Router 전용, 실측). 걸린 27곳은 전부 «의도된» <a> 다:
   *      · error.tsx 2곳 — 깨진 React 트리를 버리려면 하드 내비게이션이어야 한다.
   *      · ClientShell 푸터 9곳 — A4·H6-5 주석대로 크롤 예산을 손으로 관리하는 링크.
   *        <Link> 로 바꾸면 전 페이지에 프리페치가 붙는다.
   *    즉 규칙을 만족시키는 유일한 길이 «동작 변경» 이라 규칙을 내린다.
   *    off 가 아니라 warn 이다 — 새로 생기는 <a> 는 로그에 계속 남아야 한다.
   */
  { ignores: ["src/_legacy/**"] },
  {
    rules: { "@next/next/no-html-link-for-pages": "warn" },
  },
];

export default eslintConfig;
