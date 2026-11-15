let hide = false
/** Whether the member asked to hide the amounts of their own money (balances, profit and loss); a price on the market is never hidden. */
export const setHideAmounts = (v: boolean) => { hide = v }
export const amountsHidden = () => hide

/** An amount of the member's own money: masked when they chose to hide amounts. */
export const money = (n: number | null | undefined, currency = "USD", sign = false) => (hide && n != null && !Number.isNaN(n) ? "••••" : quote(n, currency, sign))

/** A price or figure of the market (a stock's price, a day's high): shown whatever the privacy choice. */
export const quote = (n: number | null | undefined, currency = "USD", sign = false) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "-"
  const s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sym = currency === "USD" ? "$" : currency === "INR" ? "₹" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : ""
  const body = `${sym}${s}${sym ? "" : ` ${currency}`}`
  return n < 0 ? `-${body}` : sign && n > 0 ? `+${body}` : body
}

export const price = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "-"
  const d = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 10 ? 3 : 5
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
}

export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })

export const dayLabel = (iso: string) => {
  const d = new Date(iso), now = new Date()
  const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
  const day = 86_400_000
  if (key(d) === key(now)) return "Today"
  if (key(d) === key(new Date(now.getTime() + day))) return "Tomorrow"
  if (key(d) === key(new Date(now.getTime() - day))) return "Yesterday"
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })
}

export const ago = (iso: string) => {
  const m = Math.round((Date.now() - +new Date(iso)) / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

export const until = (iso: string) => {
  const s = Math.max(0, Math.round((+new Date(iso) - Date.now()) / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`
}

export const fullTime = (iso: string) => { const d = new Date(iso); return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · ${clock(iso)}` }
