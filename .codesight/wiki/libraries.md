# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**47 library files** across 8 modules

## Web (22 files)

- `web/src/db-fns/web/annotations.ts` — LabelingLockLostError, CreateAnnotationSchema, createAnnotation, getAnnotationById, getAnnotationsByPdfId, getAnnotationsByPdfIds, …
- `web/src/lib/auth-i18n.ts` — normalizeAuthLocale, detectAuthLocaleFromHeaders, getLocalizedAuthApiMessage, getAuthErrorPageCopy, getLocalizedAuthRedirectError, AuthLocale, …
- `web/src/db-fns/web/test-fixtures.ts` — createFixtureTracker, cleanupFixtures, seedUser, seedOrganization, seedOrganizationMember, seedTeam, …
- `web/src/lib/project-authorization.server.ts` — requireWorkspaceUser, requireUserId, getProjectAccessForCurrentUser, requireProjectAccess, requireProjectOwnership, requirePdfAccess, …
- `web/src/lib/role-authorization.server.ts` — canUsePermission, requirePermission, requireProjectPermission, AppPermission
- `web/scripts/generate_full_package_json.py` — strip_caret_tilde, collect_packages, main
- `web/tanstack-start-docs/download_tanstack_guide.py` — gh_get, download_dir, main
- `web/public/example-pdfs/federal-register/get_first_page.py` — extract_first_page, main
- `web/src/api-fns/api-stream-proxy.server.ts` — streamProxy, StreamProxyOptions
- `web/src/db/rect.ts` — toEmbedRect, toEmbedRects
- `web/src/lib/auth-redirects.ts` — getPostVerificationRedirect, DEFAULT_POST_VERIFICATION_REDIRECT
- `web/src/lib/observability/fetch.server.ts` — withObservedRequest, withObservedResponse
- `web/src/lib/observability/fetch.ts` — buildObservedHeaders, observedApiFetch
- `web/src/lib/stripe.server.ts` — getStripe, STRIPE_API_VERSION
- `web/src/api-fns/api-json-call.server.ts` — jsonCall
- `web/src/db-fns/health.ts` — checkWebDatabase
- `web/src/hooks/mouse-events/use-double-press-props.ts` — useDoublePressProps
- `web/src/hooks/shadcn-ui/use-mobile.ts` — useIsMobile
- `web/src/hooks/use-labeling-lock.ts` — useLabelingLock
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

## Pdf_ocr_utils (6 files)

- `packages/pdf_ocr_utils/pdf_ocr_utils/pipelines/extract.py` — extract_text_from_pdf, extract_text_from_pdf_by_page, extract_text_from_pdf_via_image_bytes, extract_text_from_pdf_by_page_via_image_bytes, RendererProtocol, OcrEngineProtocol, …
- `packages/pdf_ocr_utils/pdf_ocr_utils/ocr/runpod.py` — make_runpod_ocr_client, extract_text_from_runpod_image_bytes, RunpodOcrEndpointConfig, RunpodOcrClient
- `packages/pdf_ocr_utils/pdf_ocr_utils/exceptions.py` — PdfOcrError, PdfRenderError, OcrExecutionError
- `packages/pdf_ocr_utils/pdf_ocr_utils/renderers/pdfium.py` — render_pdf_page_to_array, render_pdf_page_to_png_bytes, PdfiumRenderer
- `packages/pdf_ocr_utils/pdf_ocr_utils/types.py` — RenderConfig, OcrConfig, PageTextResult
- `packages/pdf_ocr_utils/pdf_ocr_utils/ocr/tesseract.py` — extract_text_from_array, TesseractOcrEngine

## Gpu (4 files)

- `gpu/shared/runpod_http.py` — require_bearer_token, readiness_response, ensure_ready, normalize_text, run_app
- `gpu/shared/ocr.py` — resize_longest_dimension, image_to_base64_png, split_yaml_front_matter, read_png_image
- `gpu/deepseek-ocr/app.py` — lifespan, ping, ocr
- `gpu/olm-ocr2/app.py` — lifespan, ping, ocr

## Db (3 files)

- `db/seeds/insert_teemplate_seed.py` — extract_inserts, escape_sql_string, format_sql_array, make_seed_for_template
- `db/seeds/update_template_seed.py` — extract_inserts, escape_sql_string, format_sql_array, make_seed_for_template
- `db/generate_roles_sh.py` — env_var_for_role, transform, main

## Pdfium_utils (3 files)

- `packages/pdfium_utils/pdfium_utils/annotate.py` — normalize_hex_color, parse_hex_color, extract_text_by_page, extract_text, create_text_markup_annotations, TextMarkupAnnotationRequest, …
- `packages/pdfium_utils/pdfium_utils/search_and_annotate.py` — highlight_phrases, PhraseHighlightResult
- `packages/pdfium_utils/pdfium_utils/search.py` — find_text_objects

## Llm_providers (2 files)

- `packages/llm_providers/dokumen_llm_providers/adapters.py` — call_openai, call_anthropic, call_google_genai
- `packages/llm_providers/dokumen_llm_providers/types.py` — LLMResponseData

## Aws_secrets_config (1 files)

- `packages/aws_secrets_config/dokumen_aws_secrets/config.py` — load_secret_json, load_stage_groups, SecretConfigError

---
_Back to [overview.md](./overview.md)_