import { useEffect, useState } from "react"
import { api, ApiError, type NewTrade, type TradeEdit } from "./api"
import { read, write } from "./store"
import { markOffline } from "./net"

/** Changes made with no connection, kept on the phone and sent in order as soon as EdgeLabHub can be reached again. */
export type Op = { type: "addTrade"; body: NewTrade } | { type: "editTrade"; id: number; body: TradeEdit }
const KEY = "outbox"
let queue: Op[] = []
let loaded = false
let flushing = false
let failed = 0  // changes the server refused (nothing to retry); told to the member once
const listeners = new Set<() => void>()
const tell = () => listeners.forEach((l) => l())

async function load() { if (!loaded) { queue = (await read<Op[]>(KEY)) ?? []; loaded = true; tell() } }
const save = () => write(KEY, queue)

export async function resetOutbox() { queue = []; loaded = false; failed = 0; tell() }

/** Keep a change for later. Returns how many are waiting. */
export async function enqueue(op: Op): Promise<number> {
  await load()
  queue.push(op)
  await save(); tell()
  return queue.length
}

/** Try to send everything waiting. Stops at the first failure to connect and tries again next time. Returns how many went through. */
export async function flushOutbox(): Promise<number> {
  await load()
  if (flushing || queue.length === 0) return 0
  flushing = true
  let sent = 0
  try {
    while (queue.length) {
      const op = queue[0]
      try {
        if (op.type === "addTrade") await api.addJournalTrade(op.body)
        else await api.editJournalTrade(op.id, op.body)
        sent++
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) { markOffline(true); break }  // still no connection
        if (e instanceof ApiError && e.status === 401) break  // signed out: keep them for the next sign-in
        failed++  // the server said no (for example the trade was deleted): there is nothing to retry
      }
      queue.shift()
      await save(); tell()
    }
  } finally { flushing = false }
  return sent
}

export const takeFailed = () => { const n = failed; failed = 0; return n }

export function useOutboxCount(): number {
  const [n, setN] = useState(queue.length)
  useEffect(() => {
    const l = () => setN(queue.length)
    listeners.add(l)
    void load().then(l)
    return () => { listeners.delete(l) }
  }, [])
  return n
}

/** A network failure: the member should be told their change was kept, not lost. */
export const isOfflineError = (e: unknown) => e instanceof ApiError && e.status === 0
