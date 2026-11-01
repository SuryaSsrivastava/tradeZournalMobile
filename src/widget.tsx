import { FlexWidget, TextWidget, registerWidgetTaskHandler, requestWidgetUpdate } from "react-native-android-widget"
import { api, restoreSession, type LiveView } from "./api"
import { money } from "./format"
import { journalStats } from "./journal"

/**
 * The home-screen widget (Android): today's result and the trades that are open, without opening the app. Android asks it to refresh about every 30 minutes, and the app refreshes it
 * whenever Home loads. It runs with no screen, so it signs in again from the phone's secure storage like the live-notification service does.
 *
 * Only builds made with WIDGET=1 contain it (eas profile "widget"); the plugin and this file are inert otherwise.
 */
const GREEN = "#22d38a", RED = "#f4566e", TEXT = "#e8eaf0", MUTED = "#8b93a7", BG = "#131722"

type Data = { today: number; count: number; open: number; floating: number; currency: string } | null

async function load(): Promise<Data> {
  try {
    await restoreSession()
    const [trades, accounts] = await Promise.all([api.journalTrades(300), api.accounts().catch(() => ({ accounts: [] }))])
    const st = journalStats(trades)
    const lives = await Promise.all(accounts.accounts.slice(0, 5).map((a) => api.accountLive(a.id).catch(() => null)))
    const views = lives.filter((v): v is LiveView => !!v && v.state === "live")
    const positions = views.flatMap((v) => v.positions ?? [])
    const todayCount = trades.filter((t) => new Date(t.opened_at).toDateString() === new Date().toDateString()).length
    return { today: st.today, count: todayCount, open: positions.length, floating: positions.reduce((s, p) => s + p.profit, 0), currency: views[0]?.currency ?? "USD" }
  } catch { return null }
}

function Today({ d }: { d: Data }) {
  const c = d && d.today < 0 ? RED : GREEN
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ height: "match_parent", width: "match_parent", backgroundColor: BG, borderRadius: 22, padding: 14, flexDirection: "column", justifyContent: "space-between" }}>
      <TextWidget text="TRADEZOURNAL · TODAY" style={{ fontSize: 10, color: MUTED, fontWeight: "bold", letterSpacing: 1 }} />
      {d ? (
        <FlexWidget style={{ flexDirection: "column" }}>
          <TextWidget text={money(d.today, "USD", true)} style={{ fontSize: 30, color: c, fontWeight: "bold" }} />
          <TextWidget text={d.count === 0 ? "No trades yet today" : `${d.count} trade${d.count === 1 ? "" : "s"} today`} style={{ fontSize: 12, color: MUTED }} />
        </FlexWidget>
      ) : <TextWidget text="Open TradeZournal to sign in" style={{ fontSize: 13, color: MUTED }} />}
      {d && d.open > 0 ? (
        <TextWidget text={`● ${d.open} open · ${money(d.floating, d.currency === "USD" ? "USD" : d.currency, true)}`} style={{ fontSize: 12, color: d.floating >= 0 ? GREEN : RED, fontWeight: "bold" }} />
      ) : <TextWidget text={d ? "No open trades" : ""} style={{ fontSize: 12, color: MUTED }} />}
    </FlexWidget>
  )
}

export function registerWidget() {
  registerWidgetTaskHandler(async ({ widgetAction, renderWidget }) => {
    if (widgetAction === "WIDGET_DELETED") return
    renderWidget(<Today d={await load()} />)
  })
}

/** Called by the app while it is open: redraw the widget with fresh numbers. */
export async function refreshWidget(): Promise<void> {
  try { await requestWidgetUpdate({ widgetName: "Today", renderWidget: async () => <Today d={await load()} /> }) } catch { /* no widget on the home screen, or not an Android build with it */ }
}
