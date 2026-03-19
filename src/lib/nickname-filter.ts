const BANNED_WORDS = [
  '씨발','시발','ㅅㅂ','개새끼','개새','ㄱㅅㄲ',
  '병신','ㅂㅅ','좆','보지','미친놈','미친년',
  '미친새끼','찐따','틀딱','급식충','맘충',
]

const RESERVED_WORDS = [
  'admin','운영자','관리자','카더라','kadeora','official','공식',
]

export interface NicknameValidation {
  valid: boolean
  error?: string
}

export function validateNickname(nick: string): NicknameValidation {
  const trimmed = nick.trim()

  if (trimmed.length < 2 || trimmed.length > 15) {
    return { valid: false, error: '닉네임은 2~15자여야 합니다.' }
  }

  if (!/^[가-힣a-zA-Z0-9_\-]+$/.test(trimmed)) {
    return { valid: false, error: '닉네임은 한글, 영문, 숫자, _, - 만 사용 가능합니다.' }
  }

  const lower = trimmed.toLowerCase()

  for (const word of BANNED_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      return { valid: false, error: '사용할 수 없는 단어가 포함되어 있습니다.' }
    }
  }

  for (const word of RESERVED_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      return { valid: false, error: '사용할 수 없는 닉네임입니다.' }
    }
  }

  return { valid: true }
}

export function containsBannedWord(content: string): boolean {
  const lower = content.toLowerCase()
  return BANNED_WORDS.some(word => lower.includes(word.toLowerCase()))
}
