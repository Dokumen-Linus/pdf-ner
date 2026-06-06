import { createServerFn } from "@tanstack/react-start"
import { lt } from "drizzle-orm"

import type { JsonbRecord, JsonbValue, NewMonitoringEvent } from "@/db/types"

export const MONITORING_RETENTION_DAYS = 180
export const MONITORING_RETENTION_SWEEP_INTERVAL_MS = 60 * 60 * 1000

type EventKind = "api_fn" | "db_fn" | "route"
type OperationType = "mutation" | "read"
type MonitoringStatus = "failure" | "success"

type ResourceHint<TArgs> = {
  type?: string
  getId?: (args: TArgs) => string | null | undefined
}

type MonitoringOptions<TArgs> = {
  eventName: string
  eventKind: EventKind
  operationType: OperationType
  source: string
  routeOrPath?: string
  method?: string
  resource?: ResourceHint<TArgs>
  getMetadata?: (args: TArgs, result?: unknown) => JsonbRecord | undefined
  getRawErrorPayload?: (args: TArgs) => JsonbRecord | undefined
}

export type MonitoringEventInput = Omit<NewMonitoringEvent, "createdAt" | "id">

type MonitoringSink = (event: NewMonitoringEvent) => Promise<void>
type ServerFnMethod = "GET" | "POST"
type MonitoringTable = typeof import("@/db/schemas/web/monitoring-events").monitoringEvents
type MonitoringDb = {
  delete(table: MonitoringTable): { where(condition: unknown): Promise<unknown> }
  insert(table: MonitoringTable): { values(row: NewMonitoringEvent): Promise<unknown> }
}

let customSink: MonitoringSink | null = null
let lastRetentionSweepAt = 0
const wrappedServerFnBuilders = new WeakSet<object>()

const SENSITIVE_KEY_RE =
  /authorization|cookie|password|passwd|secret|token|api.?key|client.?secret|stripe.?secret|session/i

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function setMonitoringEventSinkForTests(sink: MonitoringSink | null) {
  customSink = sink
  lastRetentionSweepAt = 0
}

export async function recordMonitoringEvent(event: MonitoringEventInput): Promise<void> {
  const row: NewMonitoringEvent = {
    ...event,
    metadata: sanitizeRecord(event.metadata ?? {}),
    rawErrorPayload: event.rawErrorPayload ? sanitizeRecord(event.rawErrorPayload) : undefined,
  }

  emitMonitoringLog(row)

  try {
    if (customSink) {
      await customSink(row)
      return
    }
    if (process.env.NODE_ENV === "test" && process.env.TEST_DB !== "true") return

    const [{ db }, { monitoringEvents }] = await Promise.all([
      import("@/db/client"),
      import("@/db/schemas/web/monitoring-events"),
    ])
    const monitoringDb = db as MonitoringDb
    await maybeEnforceMonitoringRetention(monitoringDb, monitoringEvents)
    await monitoringDb.insert(monitoringEvents).values(row)
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "dokumen-web",
        event_name: "web.monitoring.persist_failure",
        status: "failure",
        severity: "error",
        error_type: error instanceof Error ? error.name : typeof error,
        error_message: error instanceof Error ? error.message : String(error),
      }),
    )
  }
}

export function monitorDbFn<TArgs, TResult>(
  options: Omit<MonitoringOptions<TArgs>, "eventKind" | "source"> & { source?: string },
  handler: (args: TArgs) => Promise<TResult> | TResult,
) {
  return monitorFn(
    {
      ...options,
      eventKind: "db_fn",
      source: options.source ?? "web/src/db-fns",
    },
    handler,
  )
}

export function createMonitoredDbFn<TArgs = unknown>({
  eventName,
  getMetadata,
  getRawErrorPayload,
  method,
  resource,
  routeOrPath,
  source,
}: {
  eventName: string
  getMetadata?: (args: TArgs, result?: unknown) => JsonbRecord | undefined
  getRawErrorPayload?: (args: TArgs) => JsonbRecord | undefined
  method: ServerFnMethod
  resource?: ResourceHint<TArgs>
  routeOrPath?: string
  source?: string
}) {
  const serverFn = createServerFn({ method })
  const operationType = method === "GET" ? "read" : "mutation"
  return wrapServerFnBuilder(serverFn, (handler) =>
    monitorDbFn<unknown, unknown>(
      {
        eventName,
        getMetadata: getMetadata as
          | ((args: unknown, result?: unknown) => JsonbRecord | undefined)
          | undefined,
        getRawErrorPayload: getRawErrorPayload as
          | ((args: unknown) => JsonbRecord | undefined)
          | undefined,
        method,
        operationType,
        resource: resource as ResourceHint<unknown> | undefined,
        routeOrPath,
        source,
      },
      handler as (args: unknown) => unknown,
    ),
  )
}

export function monitorApiFn<TArgs, TResult>(
  options: Omit<MonitoringOptions<TArgs>, "eventKind" | "source"> & { source?: string },
  handler: (args: TArgs) => Promise<TResult> | TResult,
) {
  return monitorFn(
    {
      ...options,
      eventKind: "api_fn",
      source: options.source ?? "web/src/api-fns",
    },
    handler,
  )
}

export function createMonitoredApiFn<TArgs = unknown>({
  eventName,
  getMetadata,
  getRawErrorPayload,
  method,
  resource,
  routeOrPath,
  source,
}: {
  eventName: string
  getMetadata?: (args: TArgs, result?: unknown) => JsonbRecord | undefined
  getRawErrorPayload?: (args: TArgs) => JsonbRecord | undefined
  method: ServerFnMethod
  resource?: ResourceHint<TArgs>
  routeOrPath?: string
  source?: string
}) {
  const serverFn = createServerFn({ method })
  const operationType = method === "GET" ? "read" : "mutation"
  return wrapServerFnBuilder(serverFn, (handler) =>
    monitorApiFn<unknown, unknown>(
      {
        eventName,
        getMetadata: getMetadata as
          | ((args: unknown, result?: unknown) => JsonbRecord | undefined)
          | undefined,
        getRawErrorPayload: getRawErrorPayload as
          | ((args: unknown) => JsonbRecord | undefined)
          | undefined,
        method,
        operationType,
        resource: resource as ResourceHint<unknown> | undefined,
        routeOrPath,
        source,
      },
      handler as (args: unknown) => unknown,
    ),
  )
}

export function monitorRouteHandler<TArgs, TResult>(
  options: Omit<MonitoringOptions<TArgs>, "eventKind" | "source"> & { source?: string },
  handler: (args: TArgs) => Promise<TResult> | TResult,
) {
  return monitorFn(
    {
      ...options,
      eventKind: "route",
      source: options.source ?? "web/src/routes/api",
    },
    handler,
  )
}

function wrapServerFnBuilder<TBuilder>(
  builder: TBuilder,
  wrapHandler: (handler: (args: unknown) => unknown) => (args: unknown) => Promise<unknown>,
): TBuilder {
  if (typeof builder === "object" && builder !== null) {
    if (wrappedServerFnBuilders.has(builder)) return builder
    wrappedServerFnBuilders.add(builder)
  }

  const original = builder as {
    handler?: (handler: (args: unknown) => unknown) => unknown
    inputValidator?: (...args: unknown[]) => unknown
  }

  if (typeof original.handler === "function") {
    const originalHandler = original.handler.bind(builder)
    original.handler = ((handler: (args: unknown) => unknown) =>
      originalHandler(wrapHandler(handler))) as typeof original.handler
  }

  if (typeof original.inputValidator === "function") {
    const originalInputValidator = original.inputValidator.bind(builder)
    original.inputValidator = ((...args: unknown[]) => {
      const nextBuilder = originalInputValidator(...args)
      return wrapServerFnBuilder(nextBuilder, wrapHandler)
    }) as typeof original.inputValidator
  }

  return builder
}

function monitorFn<TArgs, TResult>(
  options: MonitoringOptions<TArgs>,
  handler: (args: TArgs) => Promise<TResult> | TResult,
) {
  return async (args: TArgs): Promise<TResult> => {
    const startedAt = performance.now()
    try {
      const result = await handler(args)
      if (result instanceof Response && !result.ok) {
        await recordMonitoringEvent(
          buildMonitoringEvent({
            args,
            durationMs: elapsedMs(startedAt),
            error: await responseError(result),
            options,
            status: "failure",
          }),
        )
      } else if (options.operationType === "mutation") {
        await recordMonitoringEvent(
          buildMonitoringEvent({
            args,
            durationMs: elapsedMs(startedAt),
            options,
            result,
            status: "success",
          }),
        )
      }
      return result
    } catch (error) {
      await recordMonitoringEvent(
        buildMonitoringEvent({
          args,
          durationMs: elapsedMs(startedAt),
          error,
          options,
          status: "failure",
        }),
      )
      throw error
    }
  }
}

async function responseError(response: Response) {
  const body = await safeResponseBody(response)
  return new Error(body ? `HTTP ${response.status}: ${body}` : `HTTP ${response.status}`)
}

async function safeResponseBody(response: Response) {
  try {
    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.includes("application/json") && !contentType.startsWith("text/")) {
      return null
    }
    const text = await response.clone().text()
    return text.length > 500 ? `${text.slice(0, 500)}...` : text
  } catch {
    return null
  }
}

function buildMonitoringEvent<TArgs>({
  args,
  durationMs,
  error,
  options,
  result,
  status,
}: {
  args: TArgs
  durationMs: number
  error?: unknown
  options: MonitoringOptions<TArgs>
  result?: unknown
  status: MonitoringStatus
}): MonitoringEventInput {
  const metadata = options.getMetadata?.(args, result) ?? defaultMetadata(args)
  const requestContext = getRequestContext(args)
  const ids = extractIds(args)
  const resourceId = options.resource?.getId?.(args) ?? ids.resourceId
  const errorInfo = error == null ? {} : getErrorInfo(error)

  return {
    eventName: options.eventName,
    eventKind: options.eventKind,
    operationType: options.operationType,
    source: options.source,
    status,
    severity: status === "failure" ? "error" : "info",
    actorUserId: ids.actorUserId,
    actorAuthUserId: ids.actorAuthUserId,
    organizationId: ids.organizationId,
    projectId: ids.projectId,
    resourceType: options.resource?.type ?? ids.resourceType,
    resourceId,
    requestId: requestContext.requestId,
    traceId: requestContext.traceId,
    routeOrPath: options.routeOrPath ?? requestContext.routeOrPath,
    method: options.method ?? requestContext.method,
    durationMs,
    metadata,
    rawErrorPayload:
      status === "failure"
        ? (options.getRawErrorPayload?.(args) ?? defaultRawErrorPayload(args))
        : undefined,
    ...errorInfo,
  }
}

async function maybeEnforceMonitoringRetention(db: MonitoringDb, table: MonitoringTable) {
  const now = Date.now()
  if (now - lastRetentionSweepAt < MONITORING_RETENTION_SWEEP_INTERVAL_MS) return
  lastRetentionSweepAt = now

  const cutoff = new Date(now - MONITORING_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  await db.delete(table).where(lt(table.createdAt, cutoff))
}

function elapsedMs(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt))
}

function emitMonitoringLog(event: NewMonitoringEvent) {
  const line = JSON.stringify({
    service: "dokumen-web",
    event_name: event.eventName,
    event_kind: event.eventKind,
    operation_type: event.operationType,
    status: event.status,
    severity: event.severity,
    request_id: event.requestId,
    trace_id: event.traceId,
    actor_user_id: event.actorUserId,
    project_id: event.projectId,
    duration_ms: event.durationMs,
    error_type: event.errorType,
    error_message: event.errorMessage,
  })
  if (event.status === "failure") console.error(line)
  else console.log(line)
}

function getRequestContext(args: unknown) {
  const request = getRequestFromArgs(args)
  if (!request) {
    return {
      requestId: undefined,
      traceId: undefined,
      routeOrPath: undefined,
      method: undefined,
    }
  }

  const url = safeUrl(request.url)
  return {
    requestId:
      request.headers.get("x-request-id") ??
      request.headers.get("x-amzn-trace-id") ??
      request.headers.get("cf-ray") ??
      undefined,
    traceId:
      request.headers.get("traceparent") ?? request.headers.get("x-amzn-trace-id") ?? undefined,
    routeOrPath: url?.pathname,
    method: request.method,
  }
}

function getRequestFromArgs(args: unknown): Request | null {
  if (args instanceof Request) return args
  if (isRecord(args) && args.request instanceof Request) return args.request
  return null
}

function safeUrl(url: string) {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function getErrorInfo(error: unknown) {
  if (error instanceof Error) {
    return {
      errorType: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    }
  }

  return {
    errorType: typeof error,
    errorMessage: String(error),
    errorStack: undefined,
  }
}

function defaultMetadata(args: unknown): JsonbRecord {
  const data = getDataFromArgs(args)
  const sanitized = sanitizeValue(data)
  return isRecord(sanitized) ? sanitized : { value: sanitized }
}

function defaultRawErrorPayload(args: unknown): JsonbRecord | undefined {
  const request = getRequestFromArgs(args)
  if (request) return requestMetadata(request)

  const data = getDataFromArgs(args)
  if (isBinaryLike(data)) return { omitted: "binary_payload" }
  const sanitized = sanitizeValue(data)
  return isRecord(sanitized) ? sanitized : { value: sanitized }
}

export function requestMetadata(request: Request): JsonbRecord {
  const url = safeUrl(request.url)
  const contentLength = request.headers.get("content-length")
  return sanitizeRecord({
    contentType: request.headers.get("content-type"),
    contentLength: contentLength == null ? null : Number(contentLength),
    filename: request.headers.get("x-filename"),
    projectId: url?.searchParams.get("project_id"),
    bucketId: url?.searchParams.get("bucket_id"),
    path: url?.pathname,
    method: request.method,
    omitted: "request_body",
  })
}

function getDataFromArgs(args: unknown): unknown {
  if (isRecord(args) && "data" in args) return args.data
  return args
}

function extractIds(args: unknown) {
  const data = getDataFromArgs(args)
  const record = isRecord(data) ? data : {}
  const projectId = firstUuid(record.projectId, record.project_id)
  const pdfId = firstString(record.pdfId, record.pdf_id)
  const userId = firstString(record.userId, record.user_id, record.id)

  return {
    actorUserId: firstString(record.actorUserId, record.userId, record.user_id),
    actorAuthUserId: firstString(record.actorAuthUserId, record.authUserId, record.auth_user_id),
    organizationId: firstString(record.organizationId, record.organization_id),
    projectId,
    resourceType: pdfId ? "pdf" : projectId ? "project" : userId ? "user" : undefined,
    resourceId: pdfId ?? projectId ?? userId,
  }
}

function firstUuid(...values: unknown[]) {
  const value = firstString(...values)
  return value && UUID_RE.test(value) ? value : undefined
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.length > 0)
}

function sanitizeRecord(record: Record<string, unknown>): JsonbRecord {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !SENSITIVE_KEY_RE.test(key))
      .map(([key, value]) => [key, sanitizeValue(value)]),
  )
}

function sanitizeValue(value: unknown, depth = 0): JsonbValue {
  if (value == null) return null
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }
  if (depth > 5) return "[MaxDepth]"
  if (isBinaryLike(value)) return "[BinaryPayloadOmitted]"
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1))
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY_RE.test(key))
        .map(([key, nested]) => [key, sanitizeValue(nested, depth + 1)]),
    )
  }
  return String(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isBinaryLike(value: unknown) {
  return (
    value instanceof ArrayBuffer ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof ReadableStream ||
    ArrayBuffer.isView(value)
  )
}
