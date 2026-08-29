// I-3 — 현장 이미지 «성격 라벨».
//
// ── 왜 lib 인가 (Rule #116) ─────────────────────────────────────────────────
// 이건 표시·광고 판정이다. 조감도를 조감도라 말하지 않으면 «실물로 오인» 되고,
// 사진을 조감도라 말하면 그것도 거짓이다. 둘 다 §7-1 이 막으려는 것이라
// 매핑을 화면 안에 흩뿌리지 않고 한 곳에 두고 테스트로 잠근다.
//
// ── ⚠️ 스키마의 한계 (2026-08-29 실측) ──────────────────────────────────────
// `apt_sites.hero_image_source` 값은 «둘» 뿐이다: developer(180) · satellite(2).
// **조감도인지 현장 촬영인지 구분하는 필드가 없다.**
//
// 설계 I-3 는 「조감도(시행사 제공) — 실제와 다를 수 있음」을 요구하지만,
// 사진일 수도 있는 것을 조감도라 «단정하면» 그 자체가 거짓 표기다.
// ⛔ 그래서 «종류를 단정하지 않는다». 대신 라벨과 면책을 분리한다:
//      라벨   「시행사 제공」   — 출처는 확실히 안다
//      면책   「실제와 다를 수 있음」 — 종류를 몰라도 «안전한 쪽» 이다
//    면책은 한 방향으로만 위험하다 — 사진에 붙으면 군더더기일 뿐이지만,
//    조감도에 «빠지면» 표시광고 리스크다. 모를 때는 붙이는 쪽으로 간다.
// → 종류 필드(`hero_image_kind`)가 생기면 조감도에 한해 문구를 승격한다. 중단점 D 안건.

export type HeroImageKind = 'developer' | 'satellite' | 'card' | 'none';

export interface ImageCaption {
  /** 화면 우하단 출처 줄. 없으면 null(생성 카드는 «사진이 아니라» 출처가 없다). */
  credit: string | null;
  /** alt 텍스트. ⚠️ 화면 라벨과 «같은 말» 이어야 한다(I-3). */
  alt: string;
}

export function heroImageCaption(
  kind: HeroImageKind,
  opts: { name: string; region?: string | null; developerCredit?: string | null },
): ImageCaption {
  const { name, region, developerCredit } = opts;
  const where = [name, region].filter(Boolean).join(' ');

  switch (kind) {
    case 'satellite':
      // ⚠️ 「항공 이미지」라고 쓰고 있었다 — 코드 주석은 「위성 사진」이라 말하면서.
      //    I-3 어휘로 통일한다. VWorld 출처 표기는 이용조건상 유지한다.
      return {
        credit: '위성사진 · 국토교통부 공간정보 오픈플랫폼(VWorld)',
        alt: `${where} 위성사진`,
      };

    case 'developer': {
      // 제공자 이름이 있으면 밝힌다. 없으면 「시행사 제공」까지만.
      const who = developerCredit?.trim() ? `${developerCredit.trim()} 제공` : '시행사 제공';
      return {
        credit: `${who} — 실제와 다를 수 있음`,
        alt: `${where} 이미지 (${who})`,
      };
    }

    case 'card':
      // 생성 카드는 «현장 이미지가 아니다». 출처 줄을 만들지 않는다 —
      // 「카더라 제공」이라고 쓰면 우리가 찍은 사진처럼 읽힌다.
      return { credit: null, alt: `${where} 분양 정보 카드` };

    default:
      return { credit: null, alt: where };
  }
}
