# Dokumen AI Web App

## Quickstart

1 Install [Node.js v22](https://nodejs.org/en/download/) and [Bun.js](https://bun.sh/)
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
| storybook    | view storybook workshop                                       |
| test         | run tests using Bun Test Runner, React Testing Library DOM    |
| test:db      | run database functions tests, must have database on           |
| test:e2e     | run playwright end-to-end tests                               |

## Version Control

- DevOps CI/CD: [GitHub Actions](https://github.com/features/actions) with workflows for check - currently disabled
- Changelog generation: [Semantic Release](https://github.com/semantic-release/semantic-release) config by .releaserc and ran by .github/workflows/semantic-release.yml
- [Conventional Commits](https://www.conventionalcommits.org/) enforced by [husky](https://github.com/typicode/husky) config by .commitlintrc.json, commit messages must start with a prefix in the table below, the workflow edits CHANGELOG.md on any version bump

| commit prefix | version bump           | definition                                 |
| ------------- | ---------------------- | ------------------------------------------ |
| type!:        | major (0.0.0 -> 1.0.0) | breaking changes (`feat!:`, `perf!:`, ...) |
| feat:         | minor (0.0.0 -> 0.1.0) | new feature                                |
| perf:         | patch (0.0.0 -> 0.0.1) | performance improvement                    |
| fix:          | patch (0.0.0 -> 0.0.1) | bug fix                                    |
| docs:         | none                   | documentation changes                      |
| test:         | none                   | adding or updating tests                   |
| ci:           | none                   | CI/CD configuration changes                |
| revert:       | none                   | reverting previous commits                 |
| style:        | none                   | formatting without code changes            |
| refactor:     | none                   | reorganizing code without changes          |
| chore:        | none                   | maintenance tasks                          |
| build:        | none                   | build system or dependencies               |

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

- API: [Tanstack Router](https://tanstack.com/router/latest/docs/overview) in src/routes/api/ which utilizes [Tanstack Query](https://tanstack.com/query/latest/docs/overview) and [Axios](https://axios-http.com/docs/intro) for communication with the external backend REST API
- Database Server Functions (db-fns): must interact with the database using functions in src/db-fns/ built with [Tanstack Start Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions), Zod validation, Drizzle ORM client, and PostgreSQL database connection
- ORM: [Drizzle](https://orm.drizzle.team/docs/overview) client in src/db/client.ts handles interaction between TS and SQL, Typescript schemas defined in src/db/schema
- Database: defined in SQL for easy migration to standalone instance and integration with other apps
- ORM-created Scripts: SQL generated using [Drizzle-kit](https://orm.drizzle.team/docs/drizzle-kit) should only be used for testing to compare with ./db/schema.sql and should not be used for migration
- Better Auth tables: in addition to the custom tables that consumer programs must use via db-fns, Better Auth has its own tables

### Key Files for Tanstack Framework

| File path from `./src/`     | Description                                                                         |
|-----------------------------|-------------------------------------------------------------------------------------|
| `./routes/routeTree.gen.ts` | Generated by the framework, never edit it, and never have it open while running dev |
| `./routes/__root.tsx`       | Layout applied to entire site                                                       |
| `./router.tsx`              | Required file to expose the routes                                                  |
| `./styles.css`              | Required file to define CSS applied to entire site                                  |
| `./client.tsx`              | Client entrypoint to site                                                           |
| `./server.tsx`              | Server entrypoint to site                                                           |
| `./env.client.tsx`          | Validaiton of client-side environment variables                                     |
| `./env.server.tsx`          | Validaiton of server-side environment variables                                     |
| `./routes/_public.tsx`      | Layout for public site (when no user is authenticated)                              |
| `./routes/_public/index.tsx`| Page displayed at base URL                                                          |
| `./routes/_auth.tsx`        | Layout for authentication pages                                                     |

### Component Development

- Local state management: React useState
- Global state management: [Zustand](https://zustand.docs.pmnd.rs/guides/beginner-typescript)
- Component workshop: [Storybook](https://storybook.js.org/) using *.stories.tsx files inside src/components
- Generic components: [shadcn/ui](https://ui.shadcn.com/) stored in components/shadcn-ui and config by components.json

```cmd
npx shadcn@latest add --overwrite accordion alert-dialog alert aspect-ratio avatar badge breadcrumb button-group button calendar card carousel chart checkbox collapsible context-menu dropdown-menu empty field hover-card input-group input-otp input item kbd label menubar navigation-menu pagination popover progress radio-group resizable scroll-area select separator sheet sidebar skeleton slider sonner spinner switch table tabs textarea toggle-group toggle tooltip
```

### Other Frontend

- Authentication: Better Auth setup using [Installation](https://www.better-auth.com/docs/installation) and [Tanstack Integration](https://www.better-auth.com/docs/integrations/tanstack) docs
- Forms: must be built using [Tanstack Form](https://tanstack.com/form/latest/docs/overview), a headless library to handle validation, and shadcn-ui components following the example of [Tanstack Form + shadcn-ui](https://tanstack.com/form/latest/docs/framework/react/guides/ui-libraries#usage-with-shadcnui)
- Icons: try to stick to [Lucide Icons](https://lucide.dev/icons/)

### PDF Rendering

- EmbedPDF: [GitHub](https://github.com/embedpdf/embed-pdf-viewer), [docs for @embedpdf/pdfium](https://www.embedpdf.com/docs/pdfium/introduction) the JS library to wrap the C++ engine, [docs for @embedpdf/core/react](https://www.embedpdf.com/docs/react/introduction)
- Plugins are built in consitent style defined by core (not using standard Redux style) and must have commented sections and same subfolders and filenames as existing local plugins
- PDF retrieval: currently from URL as defined by @embedpdf/plugin-loader

### Color Pickers

- TailwindCSS: [tailcolors](https://tailcolors.com/)
- Hex color codes: [HTML Color Codes](https://html-color.codes/)

## Database

### Start Instructions

Must start the database server before running test:db or dev. Should run dev in a separate terminal so that terminating dev does not terminate the database and you can run dev again without running pg_ctl start again.

```cmd
pg_ctl -D .\pgdata -l logfile start
```

### Schemas

#### Auth Schema

Contains all tables for Better Auth. Created by "bun x @better-auth/cli@latest generate" and modifying to use shema auth and user auth_role. This way Better Auth can only edit auth schema and other users can't edit auth schema.

#### Web Schema

Contains all tables for the app defined in ./db/migrations/web. Role web_owner owns the schema so it can be used in migrations. Role web_user can only edit tables so that Drizzle can't create or delete tables etc.

#### Api Schema

Contains all tables for the backend API defined in ./db/migrations/api. Role web_user has read-only access.

#### Workers Schema

Contains all tables for the backend workers defined in ./db/migrations/workers. Role web_user has read-only access.

### How Database is Exposed to App

The database schemas are defined in:

1. ./db/migrations/ SQL scripts
2. ./src/db/schema/ Drizzle Typescript schemas
3. ./src/db-fns/ Zod validation schemas

- Any changes to the database schema must be made in all three locations
- Test ./src/db-fns/match-schemas.test.ts ensures that [2] Drizzle schemas equal the [3] Zod validation schemas
- There's no test to ensure that [1] SQL schemas equal the [2] Drizzle schemas

**Restriction on App Interactions with Database**: The frontend can only interact with database through db-fns to ensure that all database interactions are validated and consistent.
