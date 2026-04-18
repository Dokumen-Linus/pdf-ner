# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**30 library files** across 5 modules

## Web (17 files)

- `web/src/db-fns/web/annotations.ts` — LabellingLockLostError, CreateAnnotationSchema, createAnnotation, getAnnotationById, getAnnotationsByPdfId, getAnnotationsByPdfIds, …
- `web/src/db-fns/api/authorization.server.ts` — requireWorkspaceUser, requireUserId, getProjectAccessForCurrentUser, requireProjectAccess, requireProjectOwnership, requirePdfAccess, …
- `web/scripts/generate_full_package_json.py` — strip_caret_tilde, collect_packages, main
- `web/tanstack-start-docs/download_tanstack_guide.py` — gh_get, download_dir, main
- `web/public/example-pdfs/federal-register/get_first_page.py` — extract_first_page, main
- `web/src/api-fns/api-stream-proxy.server.ts` — streamProxy, StreamProxyOptions
- `web/src/db/rect.ts` — toEmbedRect, toEmbedRects
- `web/src/lib/auth-redirects.ts` — getPostVerificationRedirect, DEFAULT_POST_VERIFICATION_REDIRECT
- `web/src/lib/observability/fetch.server.ts` — withObservedRequest, withObservedResponse
- `web/src/lib/observability/fetch.ts` — buildObservedHeaders, observedApiFetch
- `web/src/api-fns/api-json-call.server.ts` — jsonCall
- `web/src/hooks/mouse-events/use-double-press-props.ts` — useDoublePressProps
- `web/src/hooks/shadcn-ui/use-mobile.ts` — useIsMobile
- `web/src/hooks/use-labelling-lock.ts` — useLabellingLock
- `web/src/lib/cookies/getCookie.ts` — getCookie
- `web/src/lib/misc/uuid.ts` — isUuidV4
- `web/src/lib/shadcn-ui/utils.ts` — cn

## Otel_py (6 files)

- `packages/otel_py/otel_py/instrumentation.py` — record_http_request, record_celery_task_event, record_llm_call, observe_postgres_operation, observe_redis_operation
- `packages/otel_py/otel_py/context.py` — bind_context, clear_context, get_context, get_context_value
- `packages/otel_py/otel_py/tracing.py` — extract_carrier, inject_carrier, trace_headers, start_span
- `packages/otel_py/otel_py/logging.py` — configure_logging, JsonLogFormatter, PlainLogFormatter
- `packages/otel_py/otel_py/metrics.py` — get_metrics_registry, MetricsRegistry
- `packages/otel_py/otel_py/config.py` — ObservabilityConfig

## Db (4 files)

- `db/seeds/insert_teemplate_seed.py` — extract_inserts, escape_sql_string, format_sql_array, make_seed_for_template
- `db/seeds/update_template_seed.py` — extract_inserts, escape_sql_string, format_sql_array, make_seed_for_template
- `db/generate_roles_sh.py` — env_var_for_role, transform, main
- `db/init/generate_roles_sh.py` — main

## Llm_providers (2 files)

- `packages/llm_providers/dokumen_llm_providers/adapters.py` — call_openai, call_anthropic, call_google_genai
- `packages/llm_providers/dokumen_llm_providers/types.py` — LLMResponseData

## Infra (1 files)

- `infra/generate_env_example.py` — main

---
_Back to [overview.md](./overview.md)_