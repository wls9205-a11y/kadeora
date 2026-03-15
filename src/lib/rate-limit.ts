interface RateLimitEntry { count: number; resetAt: number }
const store = new Map<string, RateLimitEntry>()
function cleanup() { const now=Date.now(); for(const [k,e] of store.entries()) if(e.resetAt<now) store.delete(k) }
export interface RateLimitConfig { windowMs: number; max: number }
export interface RateLimitResult { success: boolean; limit: number; remaining: number; resetAt: number }
export function rateLimit(id: string, cfg: RateLimitConfig): RateLimitResult {
  if(Math.random()<0.01) cleanup()
  const now=Date.now(), e=store.get(id)
  if(!e||e.resetAt<now){const n={count:1,resetAt:now+cfg.windowMs};store.set(id,n);return{success:true,limit:cfg.max,remaining:cfg.max-1,resetAt:n.resetAt}}
  if(e.count>=cfg.max) return{success:false,limit:cfg.max,remaining:0,resetAt:e.resetAt}
  e.count++; return{success:true,limit:cfg.max,remaining:cfg.max-e.count,resetAt:e.resetAt}
}
export function getIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'unknown'
}
export function rateLimitResponse(r: RateLimitResult): Response {
  return new Response(JSON.stringify({error:'요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'}),{status:429,headers:{'Content-Type':'application/json','Retry-After':Math.ceil((r.resetAt-Date.now())/1000).toString()}})
}
export const RATE_LIMITS = {
  write:   {windowMs:60_000, max:10},
  action:  {windowMs:60_000, max:30},
  search:  {windowMs:60_000, max:20},
  auth:    {windowMs:300_000,max:5},
  default: {windowMs:60_000, max:60},
} as const