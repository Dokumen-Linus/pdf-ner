# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**17 library files** across 3 modules

## Web (12 files)

- `web/src/db-fns/web/annotations.ts` — LabellingLockLostError, CreateAnnotationSchema, createAnnotation, getAnnotationById, getAnnotationsByPdfId, getAnnotationsByPdfIds, …
- `web/src/db-fns/api/_helpers.ts` — requireUserId, requireProjectOwnership, requirePdfOwnership, apiRequest
- `web/security/make_full_package_json.py` — strip_caret_tilde, collect_packages, main
- `web/public/example-pdfs/federal-register/get_first_page.py` — extract_first_page, main
- `web/src/db/rect.ts` — toEmbedRect, toEmbedRects
- `web/src/db-fns/api/storage.ts` — createBucket, getPdfPresignedUrl
- `web/src/hooks/mouse-events/use-double-press-props.ts` — useDoublePressProps
- `web/src/hooks/shadcn-ui/use-mobile.ts` — useIsMobile
- `web/src/hooks/use-labelling-lock.ts` — useLabellingLock
- `web/src/lib/cookies/getCookie.ts` — getCookie
- `web/src/lib/misc/uuid.ts` — isUuidV4
- `web/src/lib/shadcn-ui/utils.ts` — cn

## Db (3 files)

- `db/seeds/insert_teemplate_seed.py` — extract_inserts, escape_sql_string, format_sql_array, make_seed_for_template
- `db/seeds/update_template_seed.py` — extract_inserts, escape_sql_string, format_sql_array, make_seed_for_template
- `db/generate_roles_sh.py` — env_var_for_role, transform, main

## Llm_shared (2 files)

- `llm_shared/dokumen_llm_shared/adapters.py` — call_openai, call_anthropic, call_google_genai
- `llm_shared/dokumen_llm_shared/types.py` — LLMResponseData

---
_Back to [overview.md](./overview.md)_