import { useCallback, useEffect, useRef, useState } from "react"
import { heartbeatLabellingLock, releaseLabellingLock } from "@/db-fns/web/pdfs"

// How often the client refreshes its lock on the server. Must be well under
// the server's stale threshold (120s - see LABELLING_LOCK_STALE_SECONDS).
const HEARTBEAT_INTERVAL_MS = 30_000

interface UseLabellingLockArgs {
  /** Current pdfId being labelled. Null when no doc is selected. */
  pdfId: string | null
  /** Current user's id. Null while auth resolves. */
  userId: string | null
  /**
   * Endpoint that receives navigator.sendBeacon POSTs on tab-close. The
   * endpoint should call releaseLabellingLock with {pdfId, userId} from
   * the body. See routes/api/release-lock.ts.
   */
  releaseBeaconPath?: string
}

interface UseLabellingLockResult {
  /** True once we've confirmed the lock is no longer held (stolen or expired). */
  isLockLost: boolean
  /** Imperatively mark lock as lost (e.g. after save rejection). */
  markLockLost: () => void
  /** Reset the lock-lost flag - used after re-acquiring. */
  resetLockLost: () => void
}

/**
 * Heartbeat hook for the labelling lock.
 *
 *  - Fires `heartbeatLabellingLock` every 30s while pdfId+userId are present.
 *  - On the first `{stillHeld: false}` response, flips isLockLost -> true and
 *    stops further heartbeats until the caller calls resetLockLost.
 *  - Releases the lock on both tab-close and effect cleanup so in-app
 *    navigation does not strand the lock until the stale timeout.
 *
 * No acquire here - acquire happens in the route loader so the page knows
 * synchronously whether to render the editor or the "locked by X" card.
 */
export function useLabellingLock({
  pdfId,
  userId,
  releaseBeaconPath = "/api/release-lock",
}: UseLabellingLockArgs): UseLabellingLockResult {
  const [isLockLost, setIsLockLost] = useState(false)
  const isLockLostRef = useRef(false)
  const releasedRef = useRef<string | null>(null)

  const releaseLockBestEffort = useCallback(
    (documentId: string, currentUserId: string) => {
      const releaseKey = `${documentId}:${currentUserId}`
      if (releasedRef.current === releaseKey) return
      releasedRef.current = releaseKey

      try {
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          const payload = new Blob([JSON.stringify({ pdfId: documentId, userId: currentUserId })], {
            type: "application/json",
          })
          navigator.sendBeacon(releaseBeaconPath, payload)
          return
        }
      } catch {
        // Fall through to the server-function release below.
      }

      void releaseLabellingLock({ data: { pdfId: documentId, userId: currentUserId } }).catch(
        (err) => {
          console.warn("[use-labelling-lock] release failed", err)
        },
      )
    },
    [releaseBeaconPath],
  )

  // Keep the ref in sync so the interval callback reads the latest value
  // without us needing to tear down + recreate the interval on every flip.
  useEffect(() => {
    isLockLostRef.current = isLockLost
  }, [isLockLost])

  // Heartbeat loop.
  useEffect(() => {
    if (!pdfId || !userId) return

    let cancelled = false
    const tick = async () => {
      if (cancelled || isLockLostRef.current) return
      try {
        const res = await heartbeatLabellingLock({ data: { pdfId, userId } })
        if (cancelled) return
        if (!res.stillHeld) {
          setIsLockLost(true)
        }
      } catch (err) {
        // Network flake - ignore. Next tick retries. If the lock legitimately
        // expired, the next successful heartbeat will report stillHeld:false.
        console.warn("[use-labelling-lock] heartbeat failed", err)
      }
    }

    const interval = window.setInterval(tick, HEARTBEAT_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [pdfId, userId])

  // Release on unload and on in-app unmount. The releasedRef guard prevents
  // double sends when cleanup and beforeunload both fire for the same lock.
  useEffect(() => {
    if (!pdfId || !userId) return
    releasedRef.current = null

    const onUnload = () => {
      releaseLockBestEffort(pdfId, userId)
    }

    window.addEventListener("beforeunload", onUnload)
    return () => {
      window.removeEventListener("beforeunload", onUnload)
      releaseLockBestEffort(pdfId, userId)
    }
  }, [pdfId, userId, releaseBeaconPath, releaseLockBestEffort])

  return {
    isLockLost,
    markLockLost: () => setIsLockLost(true),
    resetLockLost: () => setIsLockLost(false),
  }
}
