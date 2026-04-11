# Config

## Environment Variables

- `ANTHROPIC_API_KEY` **required** — workers\.env.example
- `API_KEY` (has default) — web\.env
- `API_URL` (has default) — web\.env
- `API_USER_PASSWORD` (has default) — infra\.env.example
- `AUTH_DATABASE_URL` (has default) — web\.env
- `AUTH_ROLE_PASSWORD` (has default) — infra\.env.example
- `AWS_ACCESS_KEY_ID` (has default) — web\.env
- `AWS_SECRET_ACCESS_KEY` (has default) — web\.env
- `BASE_URL` (has default) — web\.env
- `BETTER_AUTH_SECRET` (has default) — web\.env
- `BETTER_AUTH_URL` (has default) — web\.env
- `CI` **required** — web\playwright.config.ts
- `DATABASE_URL` (has default) — web\.env
- `DEV` **required** — web\src\client.tsx
- `FROM_EMAIL` (has default) — web\.env
- `GITHUB_PERSONAL_ACCESS_TOKEN` (has default) — .env
- `GOOGLE_AI_API_KEY` **required** — workers\.env.example
- `MY_EMAIL` (has default) — web\.env
- `OPENAI_API_KEY` **required** — workers\.env.example
- `OWNER_ROLE_PASSWORD` (has default) — infra\.env.example
- `POSTGRES_PASSWORD` (has default) — infra\.env.example
- `REDIS_URL` (has default) — workers\.env.example
- `RESEND_API_KEY` (has default) — web\.env
- `SSR` **required** — web\src\routes\_private.tsx
- `STRIPE_SECRET_KEY` **required** — workers\.env.example
- `SUPERMEMORY_API_KEY` (has default) — web\.env
- `TEST_DB` **required** — web\src\db\drizzle-client.test.ts
- `UPLOADTHING_TOKEN` (has default) — web\.env
- `VITE_BASE_URL` (has default) — web\.env
- `VITE_STRIPE_PUBLISHABLE_KEY` (has default) — infra\.env.example
- `WEB_DATABASE_URL` (has default) — web\.env
- `WEB_USER_PASSWORD` (has default) — infra\.env.example
- `WORKERS_DATABASE_URL` (has default) — workers\.env.example
- `WORKERS_USER_PASSWORD` (has default) — infra\.env.example

## Config Files

- `infra\.env.example`
- `web\drizzle.config.ts`
- `web\vite.config.ts`
- `workers\.env.example`
