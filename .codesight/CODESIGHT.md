# pdf-ner — AI Context Map

> **Stack:** fastapi | drizzle | react | typescript

> 9 routes | 18 models | 53 components | 121 lib files | 34 env vars | 9 middleware | 1 events | 52% test coverage
> **Token savings:** this file is ~11,900 tokens. Without it, AI exploration would cost ~76,400 tokens. **Saves ~64,500 tokens per conversation.**

---

# Routes

- `POST` `/customer` params() → in: CreateCustomerRequest, out: None [db, payment]
- `GET` `/usage` params() → in: UUI, out: None [db, payment]
- `POST` `/subscription` params() → in: CreateCustomerRequest, out: None [db, payment]
- `DELETE` `/subscription` params() → in: CancelSubscriptionRequest, out: None [db, payment]
- `POST` `/report-to-stripe` params() → in: CreateCustomerRequest, out: None [db, payment]
- `POST` `/extract` params() → in: ExtractEntitiesRequest
- `POST` `/buckets` params() → in: CreateBucketRequest [upload]
- `POST` `/pdfs` params() → in: CreateBucketRequest [upload]
- `POST` `/highlight` params() → in: HighlightRequest

---

# Schema

### users
- id: uuid (pk)
- email: text (required)
- first_name: text
- last_name: text
- display_name: text
- employer: text
- job_title: text
- avatar_url: text

### aws_buckets
- id: uuid (pk)
- name: text (required)
- region: text (required)
- access_key_id: text (required, fk)
- secret_access_key: text (required)
- endpoint_url: text

### projects
- id: uuid (pk)
- owner_id: uuid (required, fk)
- name: text (required)
- description: text
- bucket_id: uuid (fk)

### std_entity_types
- id: bigint (pk)
- short_name: text (required)
- category: text (required)
- definition: text (required)
- format_description: text
- regex: text
- exact_length: integer
- like: 9 for ssn
  single_word boolean

### entity_types
- id: uuid (pk)
- project_id: uuid (required, fk)
- name: text (required)
- standard_entity_type_id: bigint (fk)
- user_format_description: text
- single_word: boolean
- exact_length: integer
- required: boolean (required)

### templates
- id: bigint (pk)
- txt: text (required)
- document_at_end: boolean (required)

### prompts
- id: uuid (pk)
- project_id: uuid (required, fk)
- template_id: bigint (fk)
- full_text: text

### pdfs
- id: uuid (pk)
- name: text
- bucket_id: uuid (required, fk)
- filepath: text (required)
- text_by_page: jsonb
- text_by_bookmarks: jsonb
- model: text
- prompt_id: uuid (fk)

### annotations
- id: uuid (pk)
- subtype: text (required)
- rect: jsonb (required)
- segment_rects: jsonb (required)
- page_index: integer (required)
- color: text
- opacity: real
- contents: text
- custom_entity_type: text
- author: text
- created: timestamp

### optimized_prompts
- id: uuid (pk)
- project_id: uuid (required, fk)
- full_text: text (required)

### prompt_evaluations
- id: uuid (pk)
- prompt_id: uuid (required, fk)
- overall_f1: real (required)
- per_entity_scores: jsonb (required)

### llm_usage
- id: uuid (pk)
- user_id: uuid (fk)
- project_id: uuid (fk)
- provider: text (required)
- model: text (required)
- source: text (required)
- task_name: text
- input_tokens: integer (required)
- output_tokens: integer (required)
- cost_usd: numeric(12
- stripe_reported: boolean (required)
- stripe_usage_event_id: text (fk)

### stripe_customers
- id: uuid (pk)
- user_id: uuid (required, fk)
- stripe_customer_id: text (required, fk)
- stripe_subscription_id: text (fk)
- stripe_subscription_item_id: text (fk)

### models
- id: text (pk)
- provider: text (required)
- usd_per_1m_input: numeric(10
- usd_per_1m_output: numeric(10
- release_date: timestamp(tz) (required)
- available_date: timestamp(tz) (required)
- end_available_date: timestamp(tz)

### user
- id: text (pk, required)
- name: text (required)
- email: text (required)
- emailVerified: boolean (required)
- image: text

### session
- id: text (pk, required)
- expiresAt: timestamp(tz) (required)
- token: text (required)
- ipAddress: text
- userAgent: text
- userId: text (required, fk)

### account
- id: text (pk, required)
- accountId: text (required, fk)
- providerId: text (required, fk)
- userId: text (required, fk)
- accessToken: text
- refreshToken: text
- idToken: text
- accessTokenExpiresAt: timestamp(tz)
- refreshTokenExpiresAt: timestamp(tz)
- scope: text
- password: text

### verification
- id: text (pk, required)
- identifier: text (required)
- value: text (required)
- expiresAt: timestamp(tz) (required)

---

# Components

- **ColorPicker** — props: value, onChange — `web\src\components\custom\color-picker.tsx`
- **EntityTable** — `web\src\components\entity-table\components\entity-table.tsx`
- **NotFound** — `web\src\components\not-found.tsx`
- **Toolbar** — props: canRotate — `web\src\components\pdf-container\dev\toolbar-dev.tsx`
- **PDFContainer** — props: initalDocuments, author, exportName, canRotate — `web\src\components\pdf-container\pdf-container.tsx`
- **PDFLoading** — `web\src\components\pdf-container\pdf-loading.tsx`
- **AnnotationContainer** — props: documentId, scale, rotation, annotation, isSelected, onDoubleClick, onSelect, selectionOutline, style — `web\src\components\pdf-container\plugin-annotation-2\components\annotation-container\annotation-container.tsx`
- **CounterRotate** — `web\src\components\pdf-container\plugin-annotation-2\components\annotation-container\counter-rotate.tsx`
- **SelectedMenu** — props: documentId, annotation, menuWrapperProps, selected, rect — `web\src\components\pdf-container\plugin-annotation-2\components\annotation-container\selected-menu.tsx`
- **AnnotationLayer** — props: documentId, pageIndex, overrideScale, overrideRotation, selectionOutline, style — `web\src\components\pdf-container\plugin-annotation-2\components\annotation-layer.tsx`
- **Annotations** — props: documentId, pageIndex, scale, rotation, selectionOutline — `web\src\components\pdf-container\plugin-annotation-2\components\annotations.tsx`
- **Highlight** — props: color, opacity, segmentRects, rect, scale, onClick, style — `web\src\components\pdf-container\plugin-annotation-2\components\text-markup\highlight.tsx`
- **TextMarkupPreview** — props: documentId, pageIndex, scale — `web\src\components\pdf-container\plugin-annotation-2\components\text-markup\preview.tsx`
- **Squiggly** — props: color, opacity, segmentRects, rect, scale, onClick, style — `web\src\components\pdf-container\plugin-annotation-2\components\text-markup\squiggly.tsx`
- **Strikeout** — props: color, opacity, segmentRects, rect, scale, onClick, style — `web\src\components\pdf-container\plugin-annotation-2\components\text-markup\strikeout.tsx`
- **Underline** — props: color, opacity, segmentRects, rect, scale, onClick, style — `web\src\components\pdf-container\plugin-annotation-2\components\text-markup\underline.tsx`
- **GlobalPointerProvider** — props: documentId, style — `web\src\components\pdf-container\plugin-interaction-manager-2\components\global-pointer-provider.tsx`
- **PagePointerProvider** — props: documentId, pageIndex, rotationOverride, scaleOverride, convertEventToPoint, style — `web\src\components\pdf-container\plugin-interaction-manager-2\components\page-pointer-provider.tsx`
- **Scroller** — props: documentId, renderPage — `web\src\components\pdf-container\plugin-scroll-2\components\scroller.tsx`
- **SearchLayer** — props: documentId, pageIndex, scaleOverride, style, highlightColor, activeHighlightColor — `web\src\components\pdf-container\plugin-search-2\components\search-layer.tsx`
- **CopyToClipboard** — `web\src\components\pdf-container\plugin-selection-2\components\copy-to-clipboard.tsx`
- **MarqueeSelection** — props: documentId, pageIndex, scale, className, background, borderColor, borderStyle, stroke, fill — `web\src\components\pdf-container\plugin-selection-2\components\marquee-selection.tsx`
- **SelectionLayer** — props: documentId, pageIndex, scale, rotation, background, textStyle, marqueeStyle, marqueeClassName, selectionMenu — `web\src\components\pdf-container\plugin-selection-2\components\selection-layer.tsx`
- **TextSelection** — props: documentId, pageIndex, scaleOverride, rotationOverride, background, selectionMenu — `web\src\components\pdf-container\plugin-selection-2\components\text-selection.tsx`
- **ZoomGestureWrapper** — props: documentId, style, enablePinch, enableWheel — `web\src\components\pdf-container\plugin-zoom-2\components\zoom-gesture-wrapper.tsx`
- **RotateWrapper** — props: enabled, documentId, pageIndex, style — `web\src\components\pdf-container\rotate-wrapper.tsx`
- **Toolbar** — props: canRotate — `web\src\components\pdf-container\toolbar.tsx`
- **PluginStoreTable** — `web\src\components\plugin-store\components\dev\plugin-store-table.tsx`
- **Footer** — `web\src\components\public-site\footer.tsx`
- **Header** — `web\src\components\public-site\header.tsx`
- **ButtonGroup** — props: className, orientation — `web\src\components\shadcn-ui\button-group.tsx`
- **Empty** — props: className — `web\src\components\shadcn-ui\empty.tsx`
- **FieldSet** — props: className — `web\src\components\shadcn-ui\field.tsx`
- **InputGroup** — props: className — `web\src\components\shadcn-ui\input-group.tsx`
- **ItemGroup** — props: className — `web\src\components\shadcn-ui\item.tsx`
- **Kbd** — props: className — `web\src\components\shadcn-ui\kbd.tsx`
- **Spinner** — props: className — `web\src\components\shadcn-ui\spinner.tsx`
- **Provider** — props: queryClient — `web\src\integrations\tanstack-query\root-provider.tsx`
- **Route** — `web\src\routes\_auth\signin.tsx`
- **Route** — `web\src\routes\_auth\signout.tsx`
- **Route** — `web\src\routes\_auth\signup.tsx`
- **Route** — `web\src\routes\_auth.tsx`
- **Route** — `web\src\routes\_private\billing.tsx`
- **Route** — `web\src\routes\_private\profile.tsx`
- **Route** — `web\src\routes\_private\projects.$projectId.tsx`
- **Route** — `web\src\routes\_private\projects.$projectId_.dashboard.tsx`
- **Route** — `web\src\routes\_private\projects.$projectId_.documents.tsx`
- **Route** — `web\src\routes\_private\projects.index.tsx`
- **Route** — `web\src\routes\_private.tsx`
- **Route** — `web\src\routes\_public\demo.tsx`
- **Route** — `web\src\routes\_public\index.tsx`
- **Route** — `web\src\routes\_public.tsx`
- **Route** — `web\src\routes\__root.tsx`

---

# Libraries

- `api\app\core\config.py`
  - function get_settings: () -> Settings
  - class Environment
  - class Settings
- `api\app\core\db.py` — function get_pool: (request) -> asyncpg.Pool
- `api\app\core\dependencies.py` — function get_llm_clients: (request) -> dict
- `api\app\core\exceptions.py` — function register_exception_handlers: (app) -> None, function unhandled_exception_handler: (request, exc) -> JSONResponse
- `api\app\core\lifespan.py` — function lifespan: (app) -> AsyncIterator[None]
- `api\app\core\logging.py` — function configure_logging: () -> None
- `api\app\core\middleware.py` — class RequestIDMiddleware, class RequestLoggingMiddleware
- `api\app\domains\billing\repository.py`
  - function get_usage_summary: (conn, user_id, days) -> dict
  - function get_usage_by_model: (conn, user_id, days) -> list[asyncpg.Record]
  - function get_usage_by_day: (conn, user_id, days) -> list[asyncpg.Record]
  - function get_stripe_customer: (conn, user_id) -> asyncpg.Record | None
  - function upsert_stripe_customer: (conn, user_id, stripe_customer_id) -> None
  - function update_stripe_subscription: (conn, user_id, subscription_id, subscription_item_id) -> None
  - _...2 more_
- `api\app\domains\billing\schemas.py`
  - class UsageByModel
  - class DailyUsage
  - class UsageSummary
  - class StripeCustomerResponse
  - class CreateCustomerRequest
  - class CreateSubscriptionRequest
  - _...1 more_
- `api\app\domains\billing\service.py`
  - function get_stripe: () -> stripe.Stripe
  - function get_or_create_stripe_customer: (conn, user_id, email, name) -> str
  - function create_metered_subscription: (conn, user_id, price_id) -> dict
  - function cancel_subscription: (conn, user_id) -> None
  - function get_usage_summary: (conn, user_id, days) -> UsageSummary
  - function report_usage_to_stripe: (conn) -> dict
- `api\app\domains\llm_ner\repository.py`
  - function fetch_project: (conn, project_id) -> asyncpg.Record | None
  - function fetch_entity_types: (conn, project_id) -> list[asyncpg.Record]
  - function fetch_template: (conn, template_id) -> asyncpg.Record | None
  - function fetch_pdf_text: (conn, pdf_id, project_id) -> tuple[bool, str | None]
  - function insert_prompt: (conn, project_id, template_id, full_text) -> UUID
- `api\app\domains\llm_ner\schemas.py` — class ExtractEntitiesRequest
- `api\app\domains\llm_ner\service.py`
  - function build_prompt_from_template: (template_txt, project_description, entity_types) -> str
  - function validate_json: (response_text) -> dict
  - function call_llm: (clients, provider, model, system_prompt, user_prompt) -> LLMResponseData
  - function record_llm_usage: (conn, user_id, project_id, provider, model, input_tokens, output_tokens) -> None
  - function extract_entities: (conn, clients, request) -> dict
- `api\app\domains\pdf_storage\repository.py`
  - function insert_bucket: (conn, name, region, access_key_id, secret_access_key, endpoint_url) -> UUID
  - function insert_pdf: (conn, project_id, bucket_id, filepath, name) -> UUID
  - function delete_bucket: (conn, bucket_id) -> None
  - function delete_pdf: (conn, pdf_id) -> None
- `api\app\domains\pdf_storage\schemas.py` — class CreateBucketRequest, class UploadPdfResponse
- `api\app\domains\pdf_storage\service.py` — function create_bucket: (conn, request) -> dict, function upload_pdf: (conn, bucket_id, project_id, filename, file_bytes) -> dict
- `api\app\domains\pdf_utils\pdfium_utils.py`
  - function find_text_objects: (pdf, search_text, page_idx) -> list[dict]
  - function parse_hex_color: (hex_color) -> tuple[int, int, int]
  - function highlight_phrases: (pdf_bytes, phrases, str]) -> tuple[bytes, list[PhraseHighlightResult]]
  - class PhraseHighlightResult
- `api\app\domains\pdf_utils\repository.py` — function fetch_pdf: (conn, pdf_id) -> asyncpg.Record | None
- `api\app\domains\pdf_utils\schemas.py`
  - class HighlightRequest
  - class HighlightTask
  - class PdfTask
- `api\app\domains\pdf_utils\service.py` — function parallel_pdf_tasks: (pdf_tasks) -> list[list], function highlight: (conn, request) -> dict
- `api\app\domains\shared\repository.py` — function fetch_model_cost: (conn, model, input_tokens, output_tokens) -> Decimal, function fetch_bucket_by_id: (conn, bucket_id) -> asyncpg.Record | None
- `api\app\domains\shared\schemas.py` — class LLMResponseData
- `api\app\integrations\anthropic.py` — function call_anthropic_async: (client, model, system_prompt, user_prompt, temp, max_tokens) -> LLMResponseData
- `api\app\integrations\gemini.py` — function call_google_ai_async: (client, model, system_prompt, user_prompt, json_response, temp, max_tokens) -> LLMResponseData
- `api\app\integrations\openai.py` — function call_openai_async: (client, model, system_prompt, user_prompt, schema, schema_name, temp, max_tokens) -> LLMResponseData
- `api\app\integrations\s3.py` — function get_object_bytes: (s3_client, bucket, key) -> bytes, function put_object_bytes: (s3_client, bucket, key, data) -> None
- `api\tests\conftest.py`
  - function mock_anthropic_client: ()
  - function mock_openai_client: ()
  - function mock_google_client: ()
  - function mock_clients: (mock_anthropic_client, mock_openai_client, mock_google_client)
  - function mock_conn: ()
  - function mock_redis: ()
  - _...3 more_
- `api\tests\domains\pdf_utils\conftest.py`
  - function empty_pdf_bytes: () -> bytes
  - function three_page_pdf_bytes: () -> bytes
  - function sample_request: () -> HighlightRequest
- `api\tests\domains\pdf_utils\test_pdfium_utils.py` — class TestParseHexColor, class TestHighlightPhrases
- `api\tests\domains\pdf_utils\test_service.py`
  - function sample_row: ()
  - function sample_request: ()
  - class TestHighlight
- `api\tests\domains\test_llm_ner.py`
  - class TestBuildPrompt
  - class TestValidateJson
  - class TestCallLlm
  - class TestExtractEntities
  - class TestExtractEntitiesRequestSchema
- `api\tests\domains\test_pdf_storage.py`
  - function storage_client: (mock_conn, mock_redis)
  - class TestCreateBucket
  - class TestUploadPdf
  - class TestCreateBucketDuplicateName
  - class TestCreateBucketS3Rollback
  - class TestUploadPdfS3Rollback
  - _...1 more_
- `db\generate_roles_sh.py`
  - function env_var_for_role: (role) -> str
  - function transform: (sql) -> str
  - function main: () -> None
- `db\seeds\insert_teemplate_seed.py`
  - function extract_inserts: (text) -> list[str]
  - function escape_sql_string: (text) -> str
  - function format_sql_array: (items) -> str
  - function make_seed_for_template: (template_number, document_at_end) -> None
- `db\seeds\update_template_seed.py`
  - function extract_inserts: (text) -> list[str]
  - function escape_sql_string: (text) -> str
  - function format_sql_array: (items) -> str
  - function make_seed_for_template: (template_number, document_at_end) -> None
- `web\public\example-pdfs\federal-register\get_first_page.py` — function extract_first_page: (input_path), function main: ()
- `web\security\make_full_package_json.py`
  - function strip_caret_tilde: (version) -> str
  - function collect_packages: (node_modules) -> dict[str, str]
  - function main: () -> None
- `web\src\components\pdf-container\plugin-annotation-2\hooks\use-annotation.ts` — function useAnnotationCapability
- `web\src\components\pdf-container\plugin-annotation-2\lib\actions.ts`
  - function initAnnotationState: (documentId, state) => InitAnnotationStateAction
  - function cleanupAnnotationState: (documentId) => CleanupAnnotationStateAction
  - function setActiveDocument: (documentId) => SetActiveDocumentAction
  - function selectAnnotation
  - function deselectAnnotation
  - function setCreateAnnotationDefaults
  - _...38 more_
- `web\src\components\pdf-container\plugin-annotation-2\lib\annotation-plugin.ts`
  - class AnnotationPlugin
  - interface AnnotationPluginConfig
  - interface AnnotationCapability
- `web\src\components\pdf-container\plugin-annotation-2\lib\types.ts`
  - function subtypeToEnum: (subtype) => PdfAnnotationSubtype
  - function isValidActiveSubtype: (subtype) => boolean
  - function isHighlight: (a) => a is AnnoOf<PdfAnnotationSubtype.HIGHLIGHT>
  - function isUnderline: (a) => a is AnnoOf<PdfAnnotationSubtype.UNDERLINE>
  - function isStrikeout: (a) => a is AnnoOf<PdfAnnotationSubtype.STRIKEOUT>
  - function isSquiggly: (a) => a is AnnoOf<PdfAnnotationSubtype.SQUIGGLY>
  - _...5 more_
- `web\src\components\pdf-container\plugin-interaction-manager-2\components\utils.ts` — function createPointerProvider: (cap, scope, element, convertEventToPoint?, host) => void
- `web\src\components\pdf-container\plugin-interaction-manager-2\hooks\use-cursor.ts` — function useCursor: (documentId) => void
- `web\src\components\pdf-container\plugin-interaction-manager-2\hooks\use-interaction-manager.ts` — function useInteractionManagerCapability
- `web\src\components\pdf-container\plugin-interaction-manager-2\hooks\use-is-page-exclusive.ts` — function useIsPageExclusive: (documentId) => void
- `web\src\components\pdf-container\plugin-interaction-manager-2\hooks\use-pointer-handlers.ts` — function usePointerHandlers: ({...}, pageIndex, documentId }) => void
- `web\src\components\pdf-container\plugin-interaction-manager-2\lib\actions.ts`
  - function initInteractionState: (documentId, state) => InitInteractionStateAction
  - function cleanupInteractionState: (documentId) => CleanupInteractionStateAction
  - function setActiveDocument: (documentId) => SetActiveDocumentAction
  - function activateMode: (documentId, mode) => ActivateModeAction
  - function pauseInteraction: (documentId) => PauseInteractionAction
  - function resumeInteraction: (documentId) => ResumeInteractionAction
  - _...34 more_
- `web\src\components\pdf-container\plugin-interaction-manager-2\lib\helper.ts` — function mergeHandlers: (list) => PointerEventHandlers
- `web\src\components\pdf-container\plugin-interaction-manager-2\lib\interaction-manager-plugin.ts` — class InteractionManagerPlugin
- `web\src\components\pdf-container\plugin-interaction-manager-2\lib\reducer.ts`
  - function reducer
  - const initialDocumentState: InteractionDocumentState
  - const initialState: InteractionManagerState
- `web\src\components\pdf-container\plugin-scroll-2\hooks\use-scroll.ts`
  - function useScrollPlugin
  - function useScrollCapability
  - function useScroll
- `web\src\components\pdf-container\plugin-scroll-2\lib\actions.ts`
  - function initScrollState: (documentId, state) => InitScrollStateAction
  - function cleanupScrollState: (documentId) => CleanupScrollStateAction
  - function updateDocumentScrollState: (documentId, state) => UpdateDocumentScrollStateAction
  - function setScrollStrategy: (documentId, strategy) => SetScrollStrategyAction
  - interface InitScrollStateAction
  - interface CleanupScrollStateAction
  - _...7 more_
- `web\src\components\pdf-container\plugin-scroll-2\lib\reducer.ts`
  - function scrollReducer
  - const defaultPageChangeState: PageChangeState
  - const initialState: (coreState: CoreState, config: ScrollPluginConfig)
- `web\src\components\pdf-container\plugin-scroll-2\lib\scroll-plugin.ts` — class ScrollPlugin
- `web\src\components\pdf-container\plugin-scroll-2\lib\selectors.ts` — function getScrollerLayout
- `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\base-strategy.ts` — class BaseScrollStrategy, interface ScrollStrategyConfig
- `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\horizontal-strategy.ts` — class HorizontalScrollStrategy
- `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\vertical-strategy.ts` — class VerticalScrollStrategy
- `web\src\components\pdf-container\plugin-search-2\hooks\use-search.ts`
  - function useSearchPlugin
  - function useSearchCapability
  - function useSearch
- `web\src\components\pdf-container\plugin-search-2\lib\actions.ts`
  - function initSearchState: (documentId, state) => InitSearchStateAction
  - function cleanupSearchState: (documentId) => CleanupSearchStateAction
  - function startSearchSession: (documentId) => StartSearchSessionAction
  - function stopSearchSession: (documentId) => StopSearchSessionAction
  - function setSearchFlags: (documentId, flags) => SetSearchFlagsAction
  - function setShowAllResults: (documentId, showAll) => SetShowAllResultsAction
  - _...25 more_
- `web\src\components\pdf-container\plugin-search-2\lib\reducer.ts`
  - function searchReducer
  - const initialSearchDocumentState: SearchDocumentState
  - const initialState: SearchState
- `web\src\components\pdf-container\plugin-search-2\lib\search-plugin.ts` — class SearchPlugin
- `web\src\components\pdf-container\plugin-selection-2\hooks\use-selection.ts` — function useSelectionCapability, function useSelectionPlugin
- `web\src\components\pdf-container\plugin-selection-2\lib\actions.ts`
  - function initSelectionState
  - function cleanupSelectionState
  - function cachePageGeometry
  - function setSelection
  - function startSelection
  - function endSelection
  - _...25 more_
- `web\src\components\pdf-container\plugin-selection-2\lib\handlers\marquee-selection.handler.ts` — function createMarqueeSelectionHandler: (opts) => PointerEventHandlersWithLifecycle<EmbedPdfPointerEvent>, interface MarqueeSelectionHandlerOptions
- `web\src\components\pdf-container\plugin-selection-2\lib\handlers\text-selection.handler.ts` — function createTextSelectionHandler: (opts) => PointerEventHandlersWithLifecycle<EmbedPdfPointerEvent>, interface TextSelectionHandlerOptions
- `web\src\components\pdf-container\plugin-selection-2\lib\reducer.ts`
  - function selectionReducer
  - const initialSelectionDocumentState: SelectionDocumentState
  - const initialState: SelectionState
- `web\src\components\pdf-container\plugin-selection-2\lib\selection-plugin.ts` — class SelectionPlugin
- `web\src\components\pdf-container\plugin-selection-2\lib\selectors.ts`
  - function selectRectsForPage: (state, page) => void
  - function selectBoundingRectForPage: (state, page) => void
  - function selectRectsAndBoundingRectForPage: (state, page) => void
  - function selectBoundingRectsForAllPages: (state) => void
  - function getFormattedSelectionForPage: (state, page) => FormattedSelection | null
  - function getFormattedSelection: (state) => void
- `web\src\components\pdf-container\plugin-selection-2\lib\utils.ts`
  - function glyphAt: (geo, pt) => void
  - function sliceBounds: (sel, geo, page) => void
  - function rectsWithinSlice: (geo, from, to, merge) => Rect[]
  - function rectUnion: (rect1, rect2) => Rect
  - function rectIntersect: (rect1, rect2) => Rect
  - function rectIsEmpty: (rect) => boolean
  - _...4 more_
- `web\src\components\pdf-container\plugin-zoom-2\hooks\use-pinch-zoom.ts` — function useZoomGesture: (documentId, options) => void
- `web\src\components\pdf-container\plugin-zoom-2\hooks\use-zoom-gesture.ts` — function useZoomGesture: (documentId, options) => void
- `web\src\components\pdf-container\plugin-zoom-2\hooks\use-zoom.ts`
  - function useZoomCapability
  - function useZoomPlugin
  - function useZoom
- `web\src\components\pdf-container\plugin-zoom-2\lib\actions.ts`
  - function initZoomState: (documentId, state) => InitZoomStateAction
  - function cleanupZoomState: (documentId) => CleanupZoomStateAction
  - function setActiveDocument: (documentId) => SetActiveDocumentAction
  - function setZoomLevel: (documentId, zoomLevel, currentZoomLevel) => SetZoomLevelAction
  - interface InitZoomStateAction
  - interface CleanupZoomStateAction
  - _...7 more_
- `web\src\components\pdf-container\plugin-zoom-2\lib\reducer.ts`
  - function zoomReducer
  - const initialDocumentState: ZoomDocumentState
  - const initialState: ZoomState
- `web\src\components\pdf-container\plugin-zoom-2\lib\zoom-plugin.ts` — class ZoomPlugin
- `web\src\components\pdf-container\plugin-zoom-2\utils\pinch-zoom-logic.ts`
  - function setupZoomGestures: ({...}, container, documentId, viewportProvides, zoomProvides, options, }) => void
  - interface ZoomGestureOptions
  - interface ZoomGestureDeps
- `web\src\components\pdf-container\plugin-zoom-2\utils\zoom-gesture-logic.ts`
  - function setupZoomGestures: ({...}, container, documentId, zoomProvides, viewportGap, options, }) => void
  - interface ZoomGestureOptions
  - interface ZoomGestureDeps
- `web\src\components\plugin-store\hooks\use-plugin-store.ts` — function usePluginCapabilities
- `web\src\db-fns\api\storage.ts` — function createBucket: (name) => Promise<, const uploadPdf
- `web\src\hooks\mouse-events\use-double-press-props.ts` — function useDoublePressProps: (onDouble?, {...}, tolerancePx) => DoubleProps<T>
- `web\src\hooks\shadcn-ui\use-mobile.ts` — function useIsMobile: () => void
- `web\src\lib\cookies\getCookie.ts` — function getCookie: (name, defaultValue?) => void
- `web\src\lib\misc\uuid.ts` — function isUuidV4: (value) => boolean
- `web\src\lib\shadcn-ui\utils.ts` — function cn: (...inputs) => void
- `workers\app\core\config.py`
  - function get_settings: () -> Settings
  - class Environment
  - class Settings
- `workers\app\core\logging.py` — function configure_logging: () -> None
- `workers\app\domains\billing\application\workflows.py` — function report_usage_to_stripe: () -> dict
- `workers\app\domains\billing\domain\services.py` — function cost_to_microdollars: (cost_usd) -> int
- `workers\app\domains\billing\infrastructure\repository.py`
  - function fetch_model_cost: (conn, model, input_tokens, output_tokens) -> Decimal
  - function record_llm_usage: (conn, provider, model, input_tokens, output_tokens, project_id, user_id, task_name) -> None
  - function get_unreported_batches: (conn, limit)
  - function mark_reported: (conn, usage_ids, event_id) -> None
- `workers\app\domains\billing\tasks.py` — function report_usage_to_stripe_task: (self)
- `workers\app\domains\context_engineering\application\commands.py` — class OptimizePrompt
- `workers\app\domains\context_engineering\application\handlers.py` — function handle_optimize_prompt: (cmd) -> dict
- `workers\app\domains\context_engineering\application\workflows.py` — function prompt_optimization_workflow: (conn, openai_client, cmd) -> dict
- `workers\app\domains\context_engineering\domain\entities.py`
  - class EntityTypeInfo
  - class LabeledAnnotation
  - class LabeledPdf
  - class PromptCandidate
  - class EvaluationResult
- `workers\app\domains\context_engineering\domain\events.py` — class PromptOptimizationCompleted, class EvaluationRoundCompleted
- `workers\app\domains\context_engineering\domain\services.py`
  - function build_json_schema: (entity_types) -> dict
  - function build_base_system_prompt: (project_description, entity_types) -> str
  - function format_few_shot_examples: (labeled_pdfs, max_examples) -> str
  - function generate_prompt_variants: (base_prompt, entity_types, project_description) -> list[str]
  - function build_refinement_prompt: (current_prompt, error_analysis, entity_types) -> str
  - function evaluate_predictions: (predicted, ground_truth, list[str]], entity_types) -> EvaluationResult
  - _...1 more_
- `workers\app\domains\context_engineering\domain\value_objects.py` — class F1Score, class EntityMatch
- `workers\app\domains\context_engineering\infrastructure\repositories.py`
  - function fetch_project: (conn, project_id) -> asyncpg.Record | None
  - function fetch_entity_types_with_std: (conn, project_id) -> list[EntityTypeInfo]
  - function fetch_labeled_pdfs: (conn, project_id) -> list[LabeledPdf]
  - function insert_optimized_prompt: (conn, project_id, full_text) -> UUID
  - function insert_evaluation: (conn, prompt_id, overall_f1, per_entity_scores) -> None
- `workers\app\domains\context_engineering\tasks.py` — function optimize_prompt_task: (self, project_id, max_iterations, model)
- `workers\app\integrations\openai.py` — function call_openai: (client, model, system_prompt, user_prompt, schema, schema_name, temp, max_tokens) -> LLMResponseData
- `workers\app\shared\domain\DomainEvent.py` — class DomainEvent
- `workers\app\shared\domain\LLMResponseData.py` — class LLMResponseData
- `workers\app\shared\infrastructure\db.py`
  - function get_pool: () -> asyncpg.Pool
  - function close_pool: () -> None
  - function get_connection: () -> asyncpg.Connection
  - function release_connection: (connection) -> None
- `workers\app\shared\infrastructure\redis.py`
  - function get_redis: () -> redis.Redis
  - function close_redis: () -> None
  - function set_cache: (key, value, ttl) -> None
  - function get_cache: (key) -> str | None
  - function delete_cache: (key) -> bool
  - function set_job_status: (job_id, status, ttl) -> None
  - _...1 more_
- `workers\app\shared\infrastructure\repository.py` — function fetch_pdf_bucket_info: (conn, pdf_id) -> asyncpg.Record | None
- `workers\app\shared\infrastructure\s3.py`
  - function make_s3_client: (access_key_id, secret_access_key, region, endpoint_url)
  - function download_pdf_bytes: (conn, pdf_id) -> tuple[bytes, str]
  - function upload_pdf_bytes: (conn, pdf_id, data) -> None
- `workers\app\shared\infrastructure\time.py`
  - class Clock
  - class SystemClock
  - class FrozenClock
- `workers\tests\application\test_commands.py` — class TestOptimizePrompt
- `workers\tests\application\test_handlers.py` — class TestHandleOptimizePrompt
- `workers\tests\application\test_workflows.py`
  - class TestAvgScore
  - class TestEvaluatePromptOnPdfs
  - class TestPromptOptimizationWorkflow
- `workers\tests\conftest.py`
  - function name_entity_type: () -> EntityTypeInfo
  - function ssn_entity_type: () -> EntityTypeInfo
  - function phone_entity_type: () -> EntityTypeInfo
  - function amount_entity_type: () -> EntityTypeInfo
  - function count_entity_type: () -> EntityTypeInfo
  - function entity_types: (name_entity_type, ssn_entity_type, phone_entity_type) -> list[EntityTypeInfo]
  - _...9 more_
- `workers\tests\domain\test_entities.py`
  - class TestEntityTypeInfo
  - class TestLabeledPdf
  - class TestPromptCandidate
- `workers\tests\domain\test_events.py`
  - class TestDomainEvent
  - class TestPromptOptimizationCompleted
  - class TestEvaluationRoundCompleted
- `workers\tests\domain\test_services.py`
  - class TestBuildJsonSchema
  - class TestDatatypeToJsonType
  - class TestBuildBaseSystemPrompt
  - class TestBuildConstraintText
  - class TestFormatFewShotExamples
  - class TestGeneratePromptVariants
  - _...6 more_
- `workers\tests\domain\test_value_objects.py` — class TestF1Score, class TestEntityMatch
- `workers\tests\infrastructure\test_repositories.py`
  - class TestFetchProject
  - class TestFetchEntityTypesWithStd
  - class TestFetchLabeledPdfs
  - class TestInsertOptimizedPrompt
  - class TestInsertEvaluation
- `workers\tests\infrastructure\test_s3.py`
  - class TestMakeS3Client
  - class TestDownloadPdfBytes
  - class TestUploadPdfBytes
- `workers\tests\integrations\test_openai.py` — class TestCallOpenai
- `workers\tests\shared\test_time.py` — class TestSystemClock, class TestFrozenClock
- `workers\tests\tasks\test_celery_tasks.py` — function task: (), class TestOptimizePromptTask

---

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

---

# Middleware

## logging
- middleware — `api\app\core\middleware.py`

## custom
- generate_roles_sh — `db\generate_roles_sh.py`
- horizontal-strategy — `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\horizontal-strategy.ts`
- vertical-strategy — `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\vertical-strategy.ts`

## auth
- base-strategy — `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\base-strategy.ts`
- auth-client — `web\src\lib\auth-client.ts`
- auth — `web\src\lib\auth.ts`
- auth — `web\src\middleware\auth.ts`
- auth.e2e — `web\tests\e2e\auth.e2e.ts`

---

# Dependency Graph

## Most Imported Files (change these carefully)

- `web\src\components\pdf-container\plugin-annotation-2\lib\types.ts` — imported by **10** files
- `web\src\components\pdf-container\plugin-scroll-2\lib\types.ts` — imported by **7** files
- `web\src\components\pdf-container\plugin-selection-2\lib\types.ts` — imported by **7** files
- `web\src\db\schemas\web\projects.ts` — imported by **7** files
- `/schemas.py` — imported by **6** files
- `web\src\components\pdf-container\plugin-annotation-2\lib\state.ts` — imported by **6** files
- `web\src\components\pdf-container\plugin-interaction-manager-2\lib\types.ts` — imported by **6** files
- `web\src\components\pdf-container\plugin-scroll-2\lib\types\virtual-item.ts` — imported by **6** files
- `web\src\db\schemas\web\schema.ts` — imported by **6** files
- `web\src\components\plugin-store\hooks\use-plugin-store.ts` — imported by **5** files
- `web\src\components\pdf-container\plugin-search-2\lib\types.ts` — imported by **5** files
- `web\src\components\pdf-container\plugin-zoom-2\lib\types.ts` — imported by **5** files
- `web\src\components\pdf-container\plugin-interaction-manager-2\hooks\use-interaction-manager.ts` — imported by **4** files
- `web\src\db\schemas\workers\schema.ts` — imported by **4** files
- `/config.py` — imported by **3** files
- `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\base-strategy.ts` — imported by **3** files
- `web\src\components\pdf-container\plugin-selection-2\components\types.ts` — imported by **3** files
- `web\src\components\pdf-container\plugin-selection-2\lib\utils.ts` — imported by **3** files
- `web\src\components\pdf-container\plugin-zoom-2\hooks\use-zoom.ts` — imported by **3** files
- `web\src\db\schemas\api\schema.ts` — imported by **3** files

## Import Map (who imports what)

- `web\src\components\pdf-container\plugin-annotation-2\lib\types.ts` ← `web\src\components\pdf-container\plugin-annotation-2\components\annotation-container\annotation-container.tsx`, `web\src\components\pdf-container\plugin-annotation-2\components\annotation-container\selected-menu.tsx`, `web\src\components\pdf-container\plugin-annotation-2\components\annotations.tsx`, `web\src\components\pdf-container\plugin-annotation-2\components\text-markup\preview.tsx`, `web\src\components\pdf-container\plugin-annotation-2\lib\actions.ts` +5 more
- `web\src\components\pdf-container\plugin-scroll-2\lib\types.ts` ← `web\src\components\pdf-container\plugin-scroll-2\lib\actions.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\index.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\index.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\manifest.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\reducer.ts` +2 more
- `web\src\components\pdf-container\plugin-selection-2\lib\types.ts` ← `web\src\components\pdf-container\plugin-selection-2\lib\actions.ts`, `web\src\components\pdf-container\plugin-selection-2\lib\index.ts`, `web\src\components\pdf-container\plugin-selection-2\lib\index.ts`, `web\src\components\pdf-container\plugin-selection-2\lib\manifest.ts`, `web\src\components\pdf-container\plugin-selection-2\lib\reducer.ts` +2 more
- `web\src\db\schemas\web\projects.ts` ← `web\src\db\schemas\api\prompts.ts`, `web\src\db\schemas\web\entity-types.ts`, `web\src\db\schemas\web\index.ts`, `web\src\db\schemas\web\users.ts`, `web\src\db\schemas\workers\billing.ts` +2 more
- `/schemas.py` ← `api\app\domains\billing\router.py`, `api\app\domains\billing\service.py`, `api\app\domains\llm_ner\router.py`, `api\app\domains\llm_ner\service.py`, `api\app\domains\pdf_utils\router.py` +1 more
- `web\src\components\pdf-container\plugin-annotation-2\lib\state.ts` ← `web\src\components\pdf-container\plugin-annotation-2\components\annotations.tsx`, `web\src\components\pdf-container\plugin-annotation-2\lib\actions.ts`, `web\src\components\pdf-container\plugin-annotation-2\lib\annotation-plugin.ts`, `web\src\components\pdf-container\plugin-annotation-2\lib\annotation-plugin.ts`, `web\src\components\pdf-container\plugin-annotation-2\lib\index.ts` +1 more
- `web\src\components\pdf-container\plugin-interaction-manager-2\lib\types.ts` ← `web\src\components\pdf-container\plugin-interaction-manager-2\lib\actions.ts`, `web\src\components\pdf-container\plugin-interaction-manager-2\lib\helper.ts`, `web\src\components\pdf-container\plugin-interaction-manager-2\lib\index.ts`, `web\src\components\pdf-container\plugin-interaction-manager-2\lib\index.ts`, `web\src\components\pdf-container\plugin-interaction-manager-2\lib\manifest.ts` +1 more
- `web\src\components\pdf-container\plugin-scroll-2\lib\types\virtual-item.ts` ← `web\src\components\pdf-container\plugin-scroll-2\lib\index.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\scroll-plugin.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\base-strategy.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\horizontal-strategy.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\vertical-strategy.ts` +1 more
- `web\src\db\schemas\web\schema.ts` ← `web\src\db\schemas\web\annotations.ts`, `web\src\db\schemas\web\entity-types.ts`, `web\src\db\schemas\web\index.ts`, `web\src\db\schemas\web\pdfs.ts`, `web\src\db\schemas\web\projects.ts` +1 more
- `web\src\components\plugin-store\hooks\use-plugin-store.ts` ← `web\src\components\entity-table\components\entity-table.tsx`, `web\src\components\pdf-container\dev\toolbar-dev.tsx`, `web\src\components\pdf-container\toolbar.tsx`, `web\src\components\plugin-store\components\dev\plugin-store-table.tsx`, `web\src\components\plugin-store\components\plugin-store-sync.tsx`

---

# Events & Queues

- `optimize_prompt_task` [queue] → celery-task — `workers/app/domains/context_engineering/tasks.py`

---

# Test Coverage

> **52%** of routes and models are covered by tests
> 35 test files found

## Covered Models

- users
- aws_buckets
- projects
- std_entity_types
- entity_types
- templates
- prompts
- pdfs
- annotations
- llm_usage
- stripe_customers
- models
- user
- session

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_