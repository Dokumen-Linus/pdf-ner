# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**129 library files** across 4 modules

## Web (56 files)

- `web\src\components\pdf-container\plugin-annotation-2\lib\actions.ts` — initAnnotationState, cleanupAnnotationState, setActiveDocument, selectAnnotation, deselectAnnotation, setCreateAnnotationDefaults, …
- `web\src\components\pdf-container\plugin-interaction-manager-2\lib\actions.ts` — initInteractionState, cleanupInteractionState, setActiveDocument, activateMode, pauseInteraction, resumeInteraction, …
- `web\src\components\pdf-container\plugin-search-2\lib\actions.ts` — initSearchState, cleanupSearchState, startSearchSession, stopSearchSession, setSearchFlags, setShowAllResults, …
- `web\src\components\pdf-container\plugin-selection-2\lib\actions.ts` — initSelectionState, cleanupSelectionState, cachePageGeometry, setSelection, startSelection, endSelection, …
- `web\src\components\pdf-container\plugin-scroll-2\lib\actions.ts` — initScrollState, cleanupScrollState, updateDocumentScrollState, setScrollStrategy, InitScrollStateAction, CleanupScrollStateAction, …
- `web\src\components\pdf-container\plugin-zoom-2\lib\actions.ts` — initZoomState, cleanupZoomState, setActiveDocument, setZoomLevel, InitZoomStateAction, CleanupZoomStateAction, …
- `web\tests\bun-test-setup\mocks\index.ts` — setAuthenticated, setUnauthenticated, setSignInResult, setSignUpResult, setSignOutResult, setApiResponse, …
- `web\tests\bun-test-setup\mocks\state.ts` — resetAuthState, resetFetchState, MockUser, MockSessionRecord, MockSession, MockAuthError, …
- `web\src\components\pdf-container\plugin-annotation-2\lib\types.ts` — subtypeToEnum, isValidActiveSubtype, isHighlight, isUnderline, isStrikeout, isSquiggly, …
- `web\src\components\pdf-container\plugin-selection-2\lib\utils.ts` — glyphAt, sliceBounds, rectsWithinSlice, rectUnion, rectIntersect, rectIsEmpty, …
- `web\src\components\pdf-container\plugin-selection-2\lib\selectors.ts` — selectRectsForPage, selectBoundingRectForPage, selectRectsAndBoundingRectForPage, selectBoundingRectsForAllPages, getFormattedSelectionForPage, getFormattedSelection
- `web\security\make_full_package_json.py` — strip_caret_tilde, collect_packages, main
- `web\src\components\pdf-container\plugin-annotation-2\lib\annotation-plugin.ts` — AnnotationPlugin, AnnotationPluginConfig, AnnotationCapability
- `web\src\components\pdf-container\plugin-interaction-manager-2\lib\reducer.ts` — reducer, initialDocumentState, initialState
- `web\src\components\pdf-container\plugin-scroll-2\hooks\use-scroll.ts` — useScrollPlugin, useScrollCapability, useScroll
- `web\src\components\pdf-container\plugin-scroll-2\lib\reducer.ts` — scrollReducer, defaultPageChangeState, initialState
- `web\src\components\pdf-container\plugin-search-2\hooks\use-search.ts` — useSearchPlugin, useSearchCapability, useSearch
- `web\src\components\pdf-container\plugin-search-2\lib\reducer.ts` — searchReducer, initialSearchDocumentState, initialState
- `web\src\components\pdf-container\plugin-selection-2\lib\reducer.ts` — selectionReducer, initialSelectionDocumentState, initialState
- `web\src\components\pdf-container\plugin-zoom-2\hooks\use-zoom.ts` — useZoomCapability, useZoomPlugin, useZoom
- `web\src\components\pdf-container\plugin-zoom-2\lib\reducer.ts` — zoomReducer, initialDocumentState, initialState
- `web\src\components\pdf-container\plugin-zoom-2\utils\pinch-zoom-logic.ts` — setupZoomGestures, ZoomGestureOptions, ZoomGestureDeps
- `web\src\components\pdf-container\plugin-zoom-2\utils\zoom-gesture-logic.ts` — setupZoomGestures, ZoomGestureOptions, ZoomGestureDeps
- `web\src\db-fns\api\_helpers.ts` — requireUserId, requireProjectOwnership, apiRequest
- `web\public\example-pdfs\federal-register\get_first_page.py` — extract_first_page, main
- _…and 31 more files_

## Workers (36 files)

- `workers\tests\conftest.py` — name_entity_type, ssn_entity_type, phone_entity_type, amount_entity_type, count_entity_type, entity_types, …
- `workers\tests\domain\test_services.py` — TestBuildJsonSchema, TestDatatypeToJsonType, TestBuildBaseSystemPrompt, TestBuildConstraintText, TestFormatFewShotExamples, TestGeneratePromptVariants, …
- `workers\app\domains\context_engineering\domain\services.py` — build_json_schema, build_base_system_prompt, format_few_shot_examples, generate_prompt_variants, build_refinement_prompt, evaluate_predictions, …
- `workers\app\shared\infrastructure\redis.py` — get_redis, close_redis, set_cache, get_cache, delete_cache, set_job_status, …
- `workers\app\domains\context_engineering\domain\entities.py` — EntityTypeInfo, LabeledAnnotation, LabeledPdf, PromptCandidate, EvaluationResult
- `workers\app\domains\context_engineering\infrastructure\repositories.py` — fetch_project, fetch_entity_types_with_std, fetch_labeled_pdfs, insert_optimized_prompt, insert_evaluation
- `workers\tests\infrastructure\test_repositories.py` — TestFetchProject, TestFetchEntityTypesWithStd, TestFetchLabeledPdfs, TestInsertOptimizedPrompt, TestInsertEvaluation
- `workers\app\domains\billing\infrastructure\repository.py` — fetch_model_cost, record_llm_usage, get_unreported_batches, mark_reported
- `workers\app\shared\infrastructure\db.py` — get_pool, close_pool, get_connection, release_connection
- `workers\app\core\config.py` — get_settings, Environment, Settings
- `workers\app\shared\infrastructure\s3.py` — make_s3_client, download_pdf_bytes, upload_pdf_bytes
- `workers\app\shared\infrastructure\time.py` — Clock, SystemClock, FrozenClock
- `workers\tests\application\test_workflows.py` — TestAvgScore, TestEvaluatePromptOnPdfs, TestPromptOptimizationWorkflow
- `workers\tests\domain\test_entities.py` — TestEntityTypeInfo, TestLabeledPdf, TestPromptCandidate
- `workers\tests\domain\test_events.py` — TestDomainEvent, TestPromptOptimizationCompleted, TestEvaluationRoundCompleted
- `workers\tests\infrastructure\test_s3.py` — TestMakeS3Client, TestDownloadPdfBytes, TestUploadPdfBytes
- `workers\app\domains\context_engineering\domain\events.py` — PromptOptimizationCompleted, EvaluationRoundCompleted
- `workers\app\domains\context_engineering\domain\value_objects.py` — F1Score, EntityMatch
- `workers\tests\domain\test_value_objects.py` — TestF1Score, TestEntityMatch
- `workers\tests\shared\test_time.py` — TestSystemClock, TestFrozenClock
- `workers\tests\tasks\test_celery_tasks.py` — task, TestOptimizePromptTask
- `workers\app\core\logging.py` — configure_logging
- `workers\app\domains\billing\application\workflows.py` — report_usage_to_stripe
- `workers\app\domains\billing\domain\services.py` — cost_to_microdollars
- `workers\app\domains\billing\tasks.py` — report_usage_to_stripe_task
- _…and 11 more files_

## Api (34 files)

- `api\tests\conftest.py` — mock_anthropic_client, mock_openai_client, mock_google_client, mock_clients, mock_conn, mock_redis, …
- `api\app\domains\billing\repository.py` — get_usage_summary, get_usage_by_model, get_usage_by_day, get_stripe_customer, upsert_stripe_customer, update_stripe_subscription, …
- `api\app\domains\billing\schemas.py` — UsageByModel, DailyUsage, UsageSummary, StripeCustomerResponse, CreateCustomerRequest, CreateSubscriptionRequest, …
- `api\tests\domains\test_pdf_storage.py` — storage_client, TestCreateBucket, TestUploadPdf, TestCreateBucketDuplicateName, TestCreateBucketS3Rollback, TestUploadPdfS3Rollback, …
- `api\app\domains\billing\service.py` — get_stripe, get_or_create_stripe_customer, create_metered_subscription, cancel_subscription, get_usage_summary, report_usage_to_stripe
- `api\tests\domains\test_llm_ner.py` — TestBuildPrompt, TestValidateJson, TestCallLlm, TestExtractEntities, TestExtractEntitiesRequestSchema, TestOptimizePromptAuthorization
- `api\app\domains\llm_ner\repository.py` — fetch_project, fetch_entity_types, fetch_template, fetch_pdf_text, insert_prompt
- `api\app\domains\llm_ner\service.py` — build_prompt_from_template, validate_json, call_llm, record_llm_usage, extract_entities
- `api\app\domains\pdf_storage\repository.py` — insert_bucket, insert_pdf, delete_bucket, delete_pdf
- `api\app\domains\pdf_utils\pdfium_utils.py` — find_text_objects, parse_hex_color, highlight_phrases, PhraseHighlightResult
- `api\app\core\config.py` — get_settings, Environment, Settings
- `api\app\domains\pdf_utils\schemas.py` — HighlightRequest, HighlightTask, PdfTask
- `api\tests\domains\pdf_utils\conftest.py` — empty_pdf_bytes, three_page_pdf_bytes, sample_request
- `api\tests\domains\pdf_utils\test_service.py` — sample_row, sample_request, TestHighlight
- `api\app\core\exceptions.py` — register_exception_handlers, unhandled_exception_handler
- `api\app\core\middleware.py` — RequestIDMiddleware, RequestLoggingMiddleware
- `api\app\domains\llm_ner\events.py` — dispatch_optimize_prompt, get_task_status
- `api\app\domains\llm_ner\schemas.py` — OptimizePromptRequest, ExtractEntitiesRequest
- `api\app\domains\pdf_storage\schemas.py` — CreateBucketRequest, UploadPdfResponse
- `api\app\domains\pdf_storage\service.py` — create_bucket, upload_pdf
- `api\app\domains\pdf_utils\service.py` — parallel_pdf_tasks, highlight
- `api\app\domains\shared\repository.py` — fetch_model_cost, fetch_bucket_by_id
- `api\app\integrations\s3.py` — get_object_bytes, put_object_bytes
- `api\tests\domains\pdf_utils\test_pdfium_utils.py` — TestParseHexColor, TestHighlightPhrases
- `api\app\core\db.py` — get_pool
- _…and 9 more files_

## Db (3 files)

- `db\seeds\insert_teemplate_seed.py` — extract_inserts, escape_sql_string, format_sql_array, make_seed_for_template
- `db\seeds\update_template_seed.py` — extract_inserts, escape_sql_string, format_sql_array, make_seed_for_template
- `db\generate_roles_sh.py` — env_var_for_role, transform, main

---
_Back to [overview.md](./overview.md)_