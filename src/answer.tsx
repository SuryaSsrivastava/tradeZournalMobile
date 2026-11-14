import { Ionicons } from "@expo/vector-icons"
import { useState } from "react"
import { LayoutAnimation, Platform, Pressable, Text, UIManager, View } from "react-native"
import type { ScreenSpec } from "./api"
import { colors } from "./theme"
import { tick } from "./fx"
import { useT } from "./i18n"

if (Platform.OS === "android") UIManager.setLayoutAnimationEnabledExperimental?.(true)

/** The reply of the screener chat, split into the parts it is made of. Either "Here is what I did: <sentence>.\n- Title: why\n- Title: why\nA closing caution." or, when the model answers in plain sentences, the first sentence, the rest, and the caution. */
export function parseReply(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const isItem = (l: string) => /^[-•*]\s+/.test(l)
  const first = lines.findIndex(isItem)
  if (first < 0) {
    const sentences = text.replace(/^here is what i did:\s*/i, "").trim().split(/(?<=[.!?।])\s+/).filter(Boolean)
    const cautionAt = sentences.findIndex((x, i) => i > 0 && /research further|guarantee|not (a )?(financial |investment )?advice|no assurance/i.test(x))
    const note = cautionAt > 0 ? sentences.slice(cautionAt).join(" ") : ""
    const kept = cautionAt > 0 ? sentences.slice(0, cautionAt) : sentences
    return { lead: kept[0] ?? text.trim(), body: kept.slice(1).join(" "), items: [] as { title: string; why: string }[], note }
  }
  let last = first
  while (last + 1 < lines.length && isItem(lines[last + 1])) last++
  const lead = lines.slice(0, first).join(" ").replace(/^here is what i did:\s*/i, "").trim()
  const items = lines.slice(first, last + 1).map((l) => {
    const body = l.replace(/^[-•*]\s+/, "")
    const at = body.indexOf(": ")
    return at > 0 ? { title: body.slice(0, at).trim(), why: body.slice(at + 2).trim() } : { title: body, why: "" }
  })
  return { lead, body: "", items, note: lines.slice(last + 1).join(" ").trim() }
}

const OP: Record<string, string> = { gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "=", ne: "≠", contains: "has", in: "is" }
const num = (v: unknown) => (typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : Array.isArray(v) ? v.join(", ") : String(v))

/** The filters the screen actually used, as short labels ("P/E < 20", "Top 25"), from the spec the server ran (so they are right whatever the model wrote). `labels` maps a field key to its name. */
export function specChips(spec: ScreenSpec | undefined, labels: Record<string, string>): string[] {
  if (!spec) return []
  const name = (k: string) => labels[k] ?? k.replace(/_/g, " ")
  const out = (spec.filters ?? []).map((f) => `${name(f.field)} ${OP[f.op] ?? f.op} ${num(f.value)}`)
  if (spec.sort?.field) out.push(`${name(spec.sort.field)} ${spec.sort.dir === "asc" ? "↑" : "↓"}`)
  if (spec.limit) out.push(`Top ${spec.limit}`)
  if (spec.search) out.push(`"${spec.search}"`)
  return out
}

/** What the assistant says, laid out: the sentence that sums it up, the filters it used as chips (and, when the model explained each one, a tap to see why), the rest of the explanation, and the caution small at the bottom. */
export function AiReply({ text, spec, labels }: { text: string; spec?: ScreenSpec; labels?: Record<string, string> }) {
  const t = useT()
  const { lead, body, items, note } = parseReply(text)
  const chips = items.length ? items.map((i) => i.title) : specChips(spec, labels ?? {})
  const [open, setOpen] = useState(false)
  const toggle = () => { tick(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setOpen((v) => !v) }
  return (
    <View style={{ borderRadius: 18, borderTopLeftRadius: 6, backgroundColor: colors.cardHi, borderWidth: 1, borderColor: `${colors.green}33`, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: `${colors.green}22`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="sparkles" size={13} color={colors.green} />
        </View>
        <Text style={{ color: colors.green, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginLeft: 8 }}>{t("did")}</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: "600" }}>{lead || text}</Text>
      {body ? <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>{body}</Text> : null}

      {chips.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {chips.map((c, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: `${colors.green}14`, borderWidth: 1, borderColor: `${colors.green}44`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Ionicons name="funnel" size={10} color={colors.green} />
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{c}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {items.length ? (
        <>
          {open ? (
            <View style={{ marginTop: 12, gap: 10 }}>
              {items.map((it, i) => it.why ? (
                <View key={i} style={{ flexDirection: "row" }}>
                  <View style={{ width: 2, borderRadius: 1, backgroundColor: `${colors.green}66`, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{it.title}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 1 }}>{it.why}</Text>
                  </View>
                </View>
              ) : null)}
            </View>
          ) : null}
          {items.some((i) => i.why) ? (
            <Pressable onPress={toggle} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", marginTop: 12, alignSelf: "flex-start" }}>
              <Text style={{ color: colors.green, fontSize: 12.5, fontWeight: "800" }}>{open ? t("hide") : t("why")}</Text>
              <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.green} style={{ marginLeft: 4 }} />
            </Pressable>
          ) : null}
        </>
      ) : null}

      {note ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12, backgroundColor: `${colors.amber}12`, borderRadius: 12, padding: 10 }}>
          <Ionicons name="information-circle-outline" size={15} color={colors.amber} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, color: colors.muted, fontSize: 11.5, lineHeight: 16 }}>{note}</Text>
        </View>
      ) : null}
    </View>
  )
}

/** What the member asked, as a bubble on the right. */
export function AskBubble({ text }: { text: string }) {
  return (
    <View style={{ alignSelf: "flex-end", maxWidth: "88%", backgroundColor: `${colors.green}24`, borderWidth: 1, borderColor: `${colors.green}55`, borderRadius: 18, borderTopRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 10 }}>
      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  )
}
