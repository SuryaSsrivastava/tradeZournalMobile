import { fetch as streamFetch } from "expo/fetch"
import { useEffect, useRef, useState } from "react"
import { api, apiServer, authHeader, type Candle } from "./api"

export const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const
export const FAST: readonly Frame[] = ["1m", "5m"]  // the plan's switch: Elite (or an admin) only
export type Frame = (typeof TIMEFRAMES)[number]
const MINUTES: Record<Frame, number> = { "1m": 1, "5m": 5, "15m": 15, "1h": 60, "4h": 240, "1d": 1440 }
const KEEP = 6000  // the newest this many bars are kept as older ones are paged in
const CHUNK = 300  // bars asked for in one go when paging back
const MAX_SPAN = 390 * 86_400_000  // the server refuses a range over 400 days

export type Feed = { candles: Candle[]; status: "loading" | "live" | "delayed" | "error"; error: string | null; reload: () => void; older: () => void; loadingMore: boolean; exhausted: boolean }

/** Merge newer bars into the list: a bar with a known time replaces it (the forming one moves), a newer one is added. */
const merge = (have: Candle[], bars: Candle[]) => {
  if (bars.length === 0) return have
  const by = new Map(have.map((c) => [c.time, c]))
  for (const b of bars) by.set(b.time, b)
  return [...by.values()].sort((a, b) => a.time - b.time).slice(-KEEP)
}

/**
 * Candles for a chart: the history from the server (/market/candles), then the forming candle streamed from our own server (/prices/stream, the price hub). The phone never talks to a
 * price provider itself. When the stream cannot be opened or drops, the newest candles are asked for every few seconds instead and the status says "delayed".
 */
export function useCandles(symbol: string, frame: Frame): Feed {
  const [candles, setCandles] = useState<Candle[]>([])
  const [status, setStatus] = useState<Feed["status"]>("loading")
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const have = useRef<Candle[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const gen = useRef(0)  // changes with the market and timeframe, so a late answer for the previous one is dropped
  const reach = useRef(0)  // the oldest moment (ms) asked for so far
  const empties = useRef(0)  // pieces in a row that came back empty: weekends and holidays have none, the start of the history ends it
  const busy = useRef(false)

  useEffect(() => {
    let alive = true
    let poll: ReturnType<typeof setInterval> | undefined
    let abort: AbortController | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    have.current = []; setCandles([]); setStatus("loading"); setError(null)
    gen.current += 1; reach.current = 0; empties.current = 0; busy.current = false; setExhausted(false); setLoadingMore(false)
    const put = (bars: Candle[]) => { if (alive) { have.current = merge(have.current, bars); setCandles(have.current) } }
    const recent = () => { const now = new Date(); return api.candles(symbol, frame, new Date(now.getTime() - MINUTES[frame] * 60_000 * 120), now, 120) }

    const startPolling = () => {
      if (poll || !alive) return
      setStatus("delayed")
      poll = setInterval(() => { recent().then(put).catch(() => {}) }, 5000)
    }
    const stream = async () => {
      abort = new AbortController()
      try {
        const res = await streamFetch(`${apiServer()}/prices/stream?${new URLSearchParams({ symbol, timeframe: frame })}`, { headers: { ...authHeader(), Accept: "text/event-stream" }, signal: abort.signal })
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`)
        if (alive) setStatus("live")
        const reader = res.body.getReader()
        const text = new TextDecoder()
        let buf = ""
        for (;;) {
          const { done, value } = await reader.read()
          if (done || !alive) break
          buf += text.decode(value, { stream: true })
          let at: number
          while ((at = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, at); buf = buf.slice(at + 2)
            const line = block.split("\n").find((l) => l.startsWith("data:"))
            if (!line) continue
            try { const m = JSON.parse(line.slice(5)) as { bars?: Candle[] }; if (m.bars) put(m.bars) } catch { /* a half message: the next one fixes it */ }
          }
        }
      } catch { /* dropped or refused: fall through to polling and try the stream again */ }
      if (!alive) return
      startPolling()
      retry = setTimeout(() => { if (alive) { if (poll) { clearInterval(poll); poll = undefined } void stream() } }, 8000)
    }

    const now = new Date()
    api.candles(symbol, frame, new Date(now.getTime() - MINUTES[frame] * 60_000 * 300), now, 300)
      .then((c) => { if (!alive) return; reach.current = c.length ? c[0].time * 1000 : now.getTime() - MINUTES[frame] * 60_000 * 300; put(c); void stream() })
      .catch((e) => { if (alive) { setError(e instanceof Error ? e.message : "Could not load the chart."); setStatus("error") } })
    return () => { alive = false; abort?.abort(); if (poll) clearInterval(poll); if (retry) clearTimeout(retry) }
  }, [symbol, frame, nonce])

  /** Older candles: one more piece back from the oldest held. Asked for when the chart is dragged near its left edge. */
  const older = () => {
    if (busy.current || exhausted || reach.current === 0) return
    const g = gen.current
    const end = reach.current
    const start = end - Math.min(MAX_SPAN, MINUTES[frame] * 60_000 * CHUNK * 1.4)
    busy.current = true; setLoadingMore(true)
    api.candles(symbol, frame, new Date(start), new Date(end), CHUNK + 50)
      .then((c) => {
        if (g !== gen.current) return
        reach.current = start
        empties.current = c.length === 0 ? empties.current + 1 : 0
        if (c.length) { have.current = merge(have.current, c); setCandles(have.current) }
        if (empties.current >= 6) setExhausted(true)
      })
      .catch(() => { /* asked for again the next time the left edge is reached */ })
      .finally(() => { if (g === gen.current) { busy.current = false; setLoadingMore(false) } })
  }

  return { candles, status, error, reload: () => setNonce((n) => n + 1), older, loadingMore, exhausted }
}
