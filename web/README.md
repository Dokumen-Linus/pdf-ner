# Dokumen AI Web App

## Setup

1 Install [Node.js v24](https://nodejs.org/en/download/) and [Bun.js](https://bun.sh/)
2 Clone repo and install dependencies:

```cmd
git clone https://github.com/optimalcharb/pdf-entity-labeling.git
```

```cmd
bun i
```

3 To setup playwright:

```cmd
bunx playwright install
```

4 Ensure .env is created following to .env.local.example

### Running the web app

1 Start the database server

```cmd
pg_ctl -D .\pgdata -l logfile start
```

2 Run the app (currently with Node.js, later will migrate to Bun.js)

```cmd
npm run dev
```

## Scripts

| Script       | Description                                                   |
| ------------ | ------------------------------------------------------------- |
| dev          | run site locally                                              |
| build        | build for prod                                                |
| preview      | preview prod build                                            |
| start        | start prod server                                             |
| tsc          | compile types without generating files                        |
| lint         | check for linting errors                                      |
| lint:fix     | fix some linting errors automatically                         |
| prettier     | check format                                                  |
| prettier:fix | fix format (.vscode/settings.json does this on every save)    |
| prepare      | auto-called by install, enforces Conventional Commits         |
| postinstall  | auto-called by install, patches packages                      |
| depcheck     | check for unused dependencies                                 |
| test         | run tests using Bun Test Runner + React Testing Library DOM   |
| test:db      | run database functions tests (must have db on)                |
| test:e2e     | run playwright end-to-end tests                               |

## Database

The database schemas are defined in:

1. ./db/migrations/ SQL scripts
2. ./src/db/schema/ Drizzle Typescript schemas
3. ./src/db-fns/ Zod validation schemas

- Any changes to the database schema must be made in all three locations
- Test ./src/db-fns/match-schemas.test.ts ensures that [2] Drizzle schemas equal the [3] Zod validation schemas
- There's no test to ensure that [1] SQL schemas equal the [2] Drizzle schemas

**Restriction on App Interactions with Database**: The frontend can only interact with database through db-fns to ensure that all database interactions are validated and consistent. db-fns must be created in a file named the same as the table they query. When you use db-fns, use types from ./src/db/types.d.ts whenever possible. db, db-fns, and types.d.ts must match and be complete.

**Schemas**: web_user has CRUD permissions on web schema and read permissions on api, workers, and public schemas

## Authentication + Authorization

- Authentication: [Better Auth](https://better-auth.com/docs/) library with tables defined in ../db/migrations/better-auth/setup.sql, config in ./src/lib/auth.ts, and client-side cookies-based tracking in ./src/lib/auth-client.ts
- User IDs: auth.user.id for authentication and web.users.id for authorization and other storage
- Organizations: each user is part of zero or one organizations which are defined in both auth.organization and web.organizations
- Teams: subcomponents of organizations which are defined in both auth.team and web.teams
- Projects: own the main functionality of the site including web.projects (project description) web.entity_types (the features to extract) and workers.pdfs (the files to extract from)
- Project ownership: projects are owned by a user if the user is not part of an organization otherwise they are owned by team (users are recommended to be in organizations)
- Authorization: use the require* functions in ./src/lib/authorization.server.ts, often needed to call api-fns or db-fns to ensure users are confined to their projects and db rows
- Billing: [Stripe Payments](https://docs.stripe.com/payments) using both [Stripe.js](https://docs.stripe.com/js) in the local API and [stripe-python](https://github.com/stripe/stripe-python) in the backend FastAPI

## Tech Stack

### Core Frontend

- Frontend framework: [Tanstack Start v0](https://tanstack.com/start/latest/docs/framework/react/overview) + [React](https://react.dev/)
- Language: [TypeScript](https://www.typescriptlang.org/) config by tsconfig.json
- Package manager: [Bun](https://bun.sh/docs/pm/cli/install) with [Patch-package](https://www.npmjs.com/package/patch-package) for extra fixes
- Build tool: [Vite](https://vite.dev/)
- Runtime: [Node.js v22](https://nodejs.org/en/download/), not Bun.js
- Environment variable management: [t3-env](https://github.com/t3-oss/t3-env), env variables loaded from .env (not from cross-env) **must** be imported from src/env.server.ts or src/env.client.ts
- Styles: [Tailwind CSS v4](https://tailwindcss.com/) and CSS defined in src/styles.css
- Linting: [ESlint 9](https://eslint.org/), config by eslint.config.mjs
- Formatting: [Prettier](https://prettier.io/), config by .prettierignore, .prettierrc (VSCode extension and settings.json does this on every save)
- Testing: [React Testing Library](https://testing-library.com/react) + [Bun Test Runner](https://bun.sh/docs/test/writing) which is based on Jest, name files as ".{spec,test}.{ts,tsx}"
- End-to-End Testing: [Playwright](https://playwright.dev/) inside test/e2e/ with files named as "*.e2e.ts"

### Backend for Frontend (BFF)

- Local API: [Tanstack Router](https://tanstack.com/router/latest/docs/overview) in src/routes/api/ which utilizes src/lib/observability/fetch.server.ts, [Tanstack Query](https://tanstack.com/query/latest/docs/overview) and/or [Axios](https://axios-http.com/docs/intro) for communication with the external APIs when appropriate
- Calls to FastAPI: must be executed in src/api-fns/ or src/routes/api depending on whether it can easily be separated as a server function instead of a route. must use api-json-call.server.ts or api-stream-proxy.server.ts. typically stream-proxy uses are in src/routes/api/
- Database Server Functions (db-fns): must interact with the database using functions in src/db-fns/ built with [Tanstack Start Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions), Zod validation, Drizzle ORM client, and PostgreSQL database connection
- ORM: [Drizzle](https://orm.drizzle.team/docs/overview) client in src/db/client.ts handles interaction between TS and SQL, Typescript schemas defined in src/db/schema
- ORM-created Scripts: SQL generated using [Drizzle-kit](https://orm.drizzle.team/docs/drizzle-kit) should only be used for testing to compare with ./db/schema.sql and should not be used for migration

### Key Files for Tanstack Framework

| File path from `./src/`     | Description                                                                         |
|-----------------------------|-------------------------------------------------------------------------------------|
| `./routes/routeTree.gen.ts` | Generated by the framework, never edit it, and never have it open while running dev |
| `./routes/__root.tsx`       | Layout applied to entire site                                                       |
| `./router.tsx`              | Required file to expose the routes                                                  |
| `./styles.css`              | Required file to define CSS applied to entire site                                  |
| `./start.ts`                | Define the instance of the Tanstack Start server                                    |
| `./client.tsx`              | Client entrypoint to site                                                           |
| `./server.tsx`              | Server entrypoint to site                                                           |
| `./env.client.tsx`          | Validation of client-side environment variables                                     |
| `./env.server.tsx`          | Validation of server-side environment variables                                     |
| `./routes/_public.tsx`      | Layout for public site (when no user is authenticated)                              |
| `./routes/_public/index.tsx`| Page displayed at base URL                                                          |

./tanstack-start-docs/* contains the most recent docs displayed on tanstack.com in Markdown

### Component Development

- Local state management: React useState
- Global state management: [Zustand](https://zustand.docs.pmnd.rs/guides/beginner-typescript)
- Generic components: [shadcn/ui](https://ui.shadcn.com/) stored in components/shadcn-ui and config by components.json

```cmd
npx shadcn@latest add --overwrite accordion alert-dialog alert aspect-ratio avatar badge breadcrumb button-group button calendar card carousel chart checkbox collapsible context-menu dropdown-menu empty field hover-card input-group input-otp input item kbd label menubar navigation-menu pagination popover progress radio-group resizable scroll-area select separator sheet sidebar skeleton slider sonner spinner switch table tabs textarea toggle-group toggle tooltip
```

- Forms: must be built using [Tanstack Form](https://tanstack.com/form/latest/docs/overview), a headless library to handle validation, and shadcn-ui components following the example of [Tanstack Form + shadcn-ui](https://tanstack.com/form/latest/docs/framework/react/guides/ui-libraries#usage-with-shadcnui)
- Icons: try to stick to [Lucide Icons](https://lucide.dev/icons/)

### PDF Rendering

- EmbedPDF: [GitHub](https://github.com/embedpdf/embed-pdf-viewer), [docs for @embedpdf/pdfium](https://www.embedpdf.com/docs/pdfium/introduction) the JS library to wrap the C++ engine, [docs for @embedpdf/core/react](https://www.embedpdf.com/docs/react/introduction)
- Plugins are built in consistent style defined by core (not using standard Redux style) and must have commented sections and same subfolders and filenames as existing local plugins
- PDF retrieval: currently from URL as defined by @embedpdf/plugin-loader

## Tests

- Three test setups: one with standard tests Bun and JSDOM, one with database tests, one with Playwright E2E tests
- Naming conventions: Unit test files should be named as ".test.{ts,tsx}" and Playwright test files should be named as ".e2e.ts"
