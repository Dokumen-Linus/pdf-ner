# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**20 library files** across 4 modules

## Web (13 files)

- `web/src/db-fns/web/annotations.ts` — LabellingLockLostError, CreateAnnotationSchema, createAnnotation, getAnnotationById, getAnnotationsByPdfId, getAnnotationsByPdfIds, …
- `web/src/db-fns/api/_helpers.server.ts` — requireUserId, requireProjectOwnership, requirePdfOwnership, apiRequest
- `web/scripts/generate_full_package_json.py` — strip_caret_tilde, collect_packages, main
- `web/tanstack-start-docs/download_tanstack_guide.py` — gh_get, download_dir, main
- `web/public/example-pdfs/federal-register/get_first_page.py` — extract_first_page, main
- `web/src/db/rect.ts` — toEmbedRect, toEmbedRects
- `web/src/lib/auth-redirects.ts` — getPostVerificationRedirect, DEFAULT_POST_VERIFICATION_REDIRECT
- `web/src/hooks/mouse-events/use-double-press-props.ts` — useDoublePressProps
- `web/src/hooks/shadcn-ui/use-mobile.ts` — useIsMobile
- `web/src/hooks/use-labelling-lock.ts` — useLabellingLock
- `web/src/lib/cookies/getCookie.ts` — getCookie
- `web/src/lib/misc/uuid.ts` — isUuidV4
- `web/src/lib/shadcn-ui/utils.ts` — cn

## Db (4 files)

- `db/seeds/insert_teemplate_seed.py` — extract_inserts, escape_sql_string, format_sql_array, make_seed_for_template
- `db/seeds/update_template_seed.py` — extract_inserts, escape_sql_string, format_sql_array, make_seed_for_template
- `db/generate_roles_sh.py` — env_var_for_role, transform, main
- `db/init/generate_roles_sh.py` — main

## Llm_shared (2 files)

- `llm_shared/dokumen_llm_shared/adapters.py` — call_openai, call_anthropic, call_google_genai
- `llm_shared/dokumen_llm_shared/types.py` — LLMResponseData

## Infra (1 files)

- `infra/generate_env_example.py` — main

---
_Back to [overview.md](./overview.md)_