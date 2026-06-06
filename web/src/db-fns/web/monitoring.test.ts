import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test"

import {
  monitorApiFn,
  monitorDbFn,
  MONITORING_RETENTION_DAYS,
  monitorRouteHandler,
  requestMetadata,
  setMonitoringEventSinkForTests,
} from "./monitoring"

import type { NewMonitoringEvent } from "@/db/types"

const events: NewMonitoringEvent[] = []

beforeEach(() => {
  events.length = 0
  setMonitoringEventSinkForTests(async (event) => {
    events.push(event)
  })
})

afterEach(() => {
  setMonitoringEventSinkForTests(null)
  mock.restore()
})

describe("monitoring helper", () => {
  it("records successful mutations", async () => {
    const log = spyOn(console, "log").mockImplementation(() => undefined)
    const handler = monitorDbFn(
      { eventName: "web.project.create", operationType: "mutation" },
      async ({ data }: { data: { projectId: string; name: string } }) => ({ id: data.projectId }),
    )

    await expect(
      handler({
        data: { projectId: "11111111-1111-4111-8111-111111111111", name: "Alpha" },
      }),
    ).resolves.toEqual({ id: "11111111-1111-4111-8111-111111111111" })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      eventName: "web.project.create",
      eventKind: "db_fn",
      operationType: "mutation",
      status: "success",
      projectId: "11111111-1111-4111-8111-111111111111",
    })
    expect(log).toHaveBeenCalledTimes(1)
  })

  it("skips successful reads", async () => {
    const handler = monitorDbFn(
      { eventName: "web.project.read", operationType: "read" },
      async () => ({
        ok: true,
      }),
    )

    await handler({ data: { id: "project-1" } })

    expect(events).toHaveLength(0)
  })

  it("records failed reads and failed mutations", async () => {
    const errorLog = spyOn(console, "error").mockImplementation(() => undefined)
    const read = monitorDbFn({ eventName: "web.project.read", operationType: "read" }, async () => {
      throw new Error("read failed")
    })
    const mutation = monitorDbFn(
      { eventName: "web.project.update", operationType: "mutation" },
      async () => {
        throw new TypeError("update failed")
      },
    )

    await expect(read({ data: { id: "p1" } })).rejects.toThrow("read failed")
    await expect(mutation({ data: { id: "p1" } })).rejects.toThrow("update failed")

    expect(events.map((event) => event.status)).toEqual(["failure", "failure"])
    expect(events.map((event) => event.errorType)).toEqual(["Error", "TypeError"])
    expect(errorLog).toHaveBeenCalledTimes(2)
  })

  it("stores metadata-only success payloads", async () => {
    const handler = monitorApiFn(
      {
        eventName: "api.worker_dispatch.optimize_prompt",
        operationType: "mutation",
        getMetadata: ({ data }: { data: { projectId: string; secretToken: string } }) => ({
          projectId: data.projectId,
          secretToken: data.secretToken,
        }),
      },
      async () => ({ taskId: "task-1" }),
    )

    await handler({
      data: {
        projectId: "11111111-1111-4111-8111-111111111111",
        secretToken: "do-not-store",
      },
    })

    expect(events[0].metadata).toEqual({
      projectId: "11111111-1111-4111-8111-111111111111",
    })
    expect(events[0].rawErrorPayload).toBeUndefined()
  })

  it("stores raw non-binary error payloads and omits sensitive keys", async () => {
    const handler = monitorApiFn(
      { eventName: "api.storage.create_bucket", operationType: "mutation" },
      async () => {
        throw new Error("nope")
      },
    )

    await expect(
      handler({ data: { name: "bucket", apiKey: "secret", nested: { cookie: "secret" } } }),
    ).rejects.toThrow("nope")

    expect(events[0].rawErrorPayload).toEqual({ name: "bucket", nested: {} })
  })

  it("omits binary upload bodies and includes request ids", async () => {
    const request = new Request(
      "https://example.test/api/pdf-upload?project_id=11111111-1111-4111-8111-111111111111&bucket_id=22222222-2222-4222-8222-222222222222",
      {
        method: "POST",
        body: new Blob(["pdf-bytes"], { type: "application/pdf" }),
        headers: {
          "content-type": "application/pdf",
          "content-length": "9",
          "x-filename": "file.pdf",
          "x-request-id": "req-1",
          traceparent: "trace-1",
        },
      },
    )
    const handler = monitorRouteHandler(
      {
        eventName: "web.pdf.upload",
        operationType: "mutation",
        routeOrPath: "/api/pdf-upload",
        getMetadata: ({ request }: { request: Request }) => requestMetadata(request),
        getRawErrorPayload: ({ request }: { request: Request }) => requestMetadata(request),
      },
      async () => {
        throw new Error("upload failed")
      },
    )

    await expect(handler({ request })).rejects.toThrow("upload failed")

    expect(events[0]).toMatchObject({
      requestId: "req-1",
      traceId: "trace-1",
      routeOrPath: "/api/pdf-upload",
      method: "POST",
    })
    expect(events[0].rawErrorPayload).toEqual({
      contentType: "application/pdf",
      contentLength: 9,
      filename: "file.pdf",
      projectId: "11111111-1111-4111-8111-111111111111",
      bucketId: "22222222-2222-4222-8222-222222222222",
      path: "/api/pdf-upload",
      method: "POST",
      omitted: "request_body",
    })
  })

  it("keeps retention policy in one exported constant", () => {
    expect(MONITORING_RETENTION_DAYS).toBe(180)
  })
})
