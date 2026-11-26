import { useFocusEffect } from "expo-router"
import { fetch as streamFetch } from "expo/fetch"
import { useCallback, useEffect, useState } from "react"
import { AppState } from "react-native"
import { apiServer, authHeader, type LiveView } from "./api"

/**
 * An account's open trades pushed as they change: the server relays the broker's own live updates (the same stream the website's Watch live uses), so a price or the floating profit moves the moment the broker
 * sends it, instead of at the next look every few seconds. `streaming` is true while it is flowing; the screen asks the old way (a look every few seconds) whenever it is not, so a refused or dropped stream costs
 * nothing but speed. It is opened only while the screen is in front and the app is open, and closed after that, so the account is not kept hot for nobody.
 */
export function useLiveStream(id: number | null) {
  const [view, setView] = useState<LiveView | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [active, setActive] = useState(AppState.currentState === "active")
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setActive(s === "active"))
    return () => sub.remove()
  }, [])
  useFocusEffect(useCallback(() => {
    if (id === null || !active) return
    let alive = true
    let abort: AbortController | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let wait = 2000
    const open = async () => {
      abort = new AbortController()
      let ended = false  // the server ended it on purpose (nothing open for a while, or a reason given): do not hammer it
      try {
        const res = await streamFetch(`${apiServer()}/accounts/${id}/live/stream`, { headers: { ...authHeader(), Accept: "text/event-stream", "x-tz-Client": "mobile" }, signal: abort.signal })
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`)
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
            const lines = block.split("\n")
            const kind = lines.find((l) => l.startsWith("event:"))?.slice(6).trim()
            const data = lines.filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n")
            if (kind === "live" && data) {
              try {
                const { closed_tickets: _closed, streamed: _streamed, ...v } = JSON.parse(data) as LiveView & { closed_tickets?: string[]; streamed?: boolean }
                if (alive) { setView(v); setStreaming(true); wait = 2000 }
              } catch { /* a half message: the next one fixes it */ }
            } else if (kind === "idle" || kind === "error") { ended = true; break }
          }
          if (ended) break
        }
      } catch { /* dropped or refused: fall back to asking, and try the stream again */ }
      if (!alive) return
      setStreaming(false)
      if (ended) return  // the screen's own looks say why (or that nothing is open)
      retry = setTimeout(() => { if (alive) void open() }, wait)
      wait = Math.min(wait * 2, 20_000)
    }
    void open()
    return () => { alive = false; abort?.abort(); if (retry) clearTimeout(retry); setStreaming(false) }
  }, [id, active]))
  return { view: streaming ? view : null, streaming }
}
