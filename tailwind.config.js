/** @type {import('tailwindcss').Config} */
// s273-cc Issue C: .ts 와 .js 둘 다 존재 — Tailwind 가 .js 를 우선 로드해서
// .ts 의 darkMode 'class' 설정이 무시됨. .js 도 동일하게 추가.
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
};
