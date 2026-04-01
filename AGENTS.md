# AGENTS.md

Agent configuration for Dokumen AI — a PDF entity labeling / NER monorepo.

Stack: TanStack Start (SSR) · TanStack Router (file-based) · TanStack Query · TanStack Form · FastAPI · asyncpg · PostgreSQL · Celery · shadcn/ui · Tailwind CSS v4.

<!-- intent-skills:start -->
# Skill mappings - when working in these areas, load the linked skill file into context.
skills:
  # ── TanStack ──────────────────────────────────────────────────────────────
  # NOTE: @tanstack/react-start v1.159.5 does not yet ship embedded Agent Skills.
  # When `npx @tanstack/intent@latest list` starts returning TanStack skills,
  # replace the comments below with:
  #   load: "web/node_modules/@tanstack/<package>/skills/<skill>/SKILL.md"

  - task: "building or modifying SSR routes, server functions, middleware, or the TanStack Start app shell"
    # To load this skill, run: npx @tanstack/intent@latest list | grep tanstack-start
    # Claude Code equivalent: invoke the `tanstack-start-best-practices` skill

  - task: "adding routes, loaders, search params, navigation, or file-based routing with TanStack Router"
    # To load this skill, run: npx @tanstack/intent@latest list | grep tanstack-router
    # Claude Code equivalent: invoke the `tanstack-router-best-practices` skill

  - task: "data fetching, caching, mutations, or server state with TanStack Query"
    # To load this skill, run: npx @tanstack/intent@latest list | grep tanstack-query
    # Claude Code equivalent: invoke the `tanstack-query-best-practices` skill

  - task: "integrating TanStack Query with TanStack Router and TanStack Start (SSR prefetch, loaders, deferred data)"
    # To load this skill, run: npx @tanstack/intent@latest list | grep tanstack-integration
    # Claude Code equivalent: invoke the `tanstack-integration-best-practices` skill

  - task: "building data tables with pagination, filtering, or sorting"
    # To load this skill, run: npx @tanstack/intent@latest list | grep tanstack-table
    # Claude Code equivalent: invoke the `tanstack-table` skill

  # ── @tanstack/intent meta-tooling (available now) ─────────────────────────

  - task: "generating or updating a SKILL.md for a library"
    load: "web/node_modules/@tanstack/intent/meta/generate-skill/SKILL.md"

  - task: "discovering capability domains and structuring agent-facing knowledge for a library"
    load: "web/node_modules/@tanstack/intent/meta/domain-discovery/SKILL.md"

  - task: "checking whether an existing SKILL.md is stale after library changes"
    load: "web/node_modules/@tanstack/intent/meta/skill-staleness-check/SKILL.md"

  # ── @tanstack/start-client-core (available now) ───────────────────────────

  - task: "configuring the TanStack Start Vite plugin, getRouter factory, or root app setup"
    load: "web/node_modules/@tanstack/start-client-core/skills/start-core/SKILL.md"

  - task: "deploying TanStack Start to Cloudflare Workers, Netlify, Vercel, Node.js, Bun, or Railway"
    load: "web/node_modules/@tanstack/start-client-core/skills/start-core/deployment/SKILL.md"

  - task: "understanding the isomorphic execution model, createServerFn, or createClientFn environment boundaries"
    load: "web/node_modules/@tanstack/start-client-core/skills/start-core/execution-model/SKILL.md"

  - task: "creating or using middleware with createMiddleware, request middleware, or server function middleware"
    load: "web/node_modules/@tanstack/start-client-core/skills/start-core/middleware/SKILL.md"

  - task: "writing server functions with createServerFn, Zod validators, or useServerFn"
    load: "web/node_modules/@tanstack/start-client-core/skills/start-core/server-functions/SKILL.md"

  - task: "creating server-side API endpoints using the server property on createFileRoute"
    load: "web/node_modules/@tanstack/start-client-core/skills/start-core/server-routes/SKILL.md"

  # ── @tanstack/start-server-core (available now) ───────────────────────────

  - task: "working with createStartHandler, server-side request/response utilities, or the Start server runtime"
    load: "web/node_modules/@tanstack/start-server-core/skills/start-server-core/SKILL.md"

  # ── @tanstack/router-plugin (available now) ───────────────────────────────

  - task: "configuring the TanStack Router bundler plugin for route generation or code splitting in Vite"
    load: "web/node_modules/@tanstack/router-plugin/skills/router-plugin/SKILL.md"

  # ── @tanstack/virtual-file-routes (available now) ─────────────────────────

  - task: "building a programmatic route tree with rootRoute(), route(), or index() instead of filesystem conventions"
    load: "web/node_modules/@tanstack/virtual-file-routes/skills/virtual-file-routes/SKILL.md"

  # ── @tanstack/cli (available now) ─────────────────────────────────────────

  - task: "scaffolding a new TanStack app with tanstack create"
    load: "web/node_modules/@tanstack/cli/skills/create-app-scaffold/SKILL.md"

  - task: "adding integrations or add-ons to an existing TanStack project with tanstack add"
    load: "web/node_modules/@tanstack/cli/skills/add-addons-existing-app/SKILL.md"

  - task: "choosing which TanStack ecosystem integrations or partner libraries to install"
    load: "web/node_modules/@tanstack/cli/skills/choose-ecosystem-integrations/SKILL.md"

  - task: "building or iterating on custom TanStack add-ons or templates in dev/watch mode"
    load: "web/node_modules/@tanstack/cli/skills/maintain-custom-addons-dev-watch/SKILL.md"

  - task: "querying TanStack docs, library metadata, or available add-on ids from the CLI"
    load: "web/node_modules/@tanstack/cli/skills/query-docs-library-metadata/SKILL.md"

  # ── @rolder-kit/tanstack (available now) ──────────────────────────────────

  - task: "reading or setting cookies isomorphically (server and client) in TanStack Start"
    load: "web/node_modules/@rolder-kit/tanstack/skills/cookies/SKILL.md"
<!-- intent-skills:end -->
