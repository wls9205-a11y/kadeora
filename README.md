# KADEORA 카더라

> 주식·부동산·청약 금융 특화 커뮤니티 웹앱

## Tech stack

- **Framework**: Next.js 15 (App Router, Server Components, Partial Prerendering)
- **Database**: Supabase (PostgreSQL 17, RLS, Realtime, Edge Functions)
- **Auth**: Supabase Auth (Kakao, Google OAuth, Phone OTP)
- **Hosting**: Vercel (Edge Network)
- **Rate Limiting**: Upstash Redis
- **Payment**: Toss Payments
- **Styling**: Tailwind CSS v4

## Local development

```bash
git clone https://github.com/wls9205-a11y/kadeora.git
cd kadeora
cp .env.example .env.local   # Fill in values
npm install
npm run dev                   # http://localhost:3000
```

## Environment variables

See `.env.example` for the full list. Required:

| Variable | Description | Where |
|----------|-------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service key | Supabase dashboard |
| `UPSTASH_REDIS_REST_URL` | Redis for rate limiting | Upstash console |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token | Upstash console |

## Project structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Login, callback
│   ├── (main)/             # Main app (feed, stock, discuss, etc.)
│   ├── api/                # API routes
│   ├── privacy/            # Legal pages
│   └── terms/
├── components/             # Shared React components
├── hooks/                  # Custom React hooks
├── lib/                    # Core utilities
│   ├── env.ts              # Environment validation (zod)
│   ├── errors.ts           # Structured error handling
│   ├── rate-limit.ts       # Upstash Redis rate limiter
│   ├── sanitize.ts         # DOMPurify XSS defense
│   ├── schemas.ts          # Zod API input validation
│   └── supabase-*.ts       # Supabase clients
├── types/                  # TypeScript type definitions
└── __tests__/              # Test files
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run type-check` | TypeScript validation |
| `npm run test` | Run unit + integration tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run gen-types` | Regenerate Supabase types |

## Testing

```bash
npm run test          # vitest (unit + integration)
npm run test:e2e      # playwright (E2E)
```

## Deployment

See `DEPLOY_GUIDE.md` for step-by-step instructions.
