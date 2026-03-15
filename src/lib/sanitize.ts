const DANGEROUS = [/<script[\s\S]*?>[\s\S]*?<\/script>/gi,/<iframe[\s\S]*?>/gi,/javascript:/gi,/on\w+\s*=/gi,/vbscript:/gi,/<object[\s\S]*?>/gi,/<embed[\s\S]*?>/gi]
export function sanitizeText(input: unknown): string {
  if(typeof input!=='string') return ''
  let s=input.trim(); for(const p of DANGEROUS) s=s.replace(p,''); return s
}
export function sanitizeNickname(input: unknown): string {
  if(typeof input!=='string') return ''
  return input.trim().replace(/[^\p{L}\p{N}_\-\s]/gu,'').replace(/\s+/g,' ').slice(0,20)
}
export function sanitizeUrl(input: unknown): string {
  if(typeof input!=='string') return ''
  const t=input.trim(); if(/^(javascript|vbscript|data):/i.test(t)) return ''; return t
}
const CATS=['stock','apt','free','discuss','notice'] as const
type Category=(typeof CATS)[number]
export function sanitizeCategory(input: unknown): Category|null {
  if(typeof input!=='string') return null
  const l=input.toLowerCase() as Category; return CATS.includes(l)?l:null
}
export function sanitizePostInput(data: Record<string,unknown>) {
  return {title:sanitizeText(data.title).slice(0,100),content:sanitizeText(data.content).slice(0,5000),category:sanitizeCategory(data.category)}
}
export function sanitizeCommentInput(data: Record<string,unknown>) {
  return {content:sanitizeText(data.content).slice(0,1000)}
}
export function sanitizeId(input: unknown): number|null {
  const n=Number(input); if(!Number.isInteger(n)||n<=0) return null; return n
}