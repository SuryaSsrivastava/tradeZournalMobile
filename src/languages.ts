/** The languages a member can speak and read answers in. `speech` is the code the phone's speech recogniser understands; `name` is how the AI is told which language to answer in. */
export type Language = { code: string; speech: string; name: string; native: string }

export const LANGUAGES: Language[] = [
  { code: "en", speech: "en-IN", name: "English", native: "English" },
  { code: "hi", speech: "hi-IN", name: "Hindi", native: "हिन्दी" },
  { code: "bn", speech: "bn-IN", name: "Bengali", native: "বাংলা" },
  { code: "mr", speech: "mr-IN", name: "Marathi", native: "मराठी" },
  { code: "ta", speech: "ta-IN", name: "Tamil", native: "தமிழ்" },
  { code: "te", speech: "te-IN", name: "Telugu", native: "తెలుగు" },
  { code: "gu", speech: "gu-IN", name: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", speech: "kn-IN", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", speech: "ml-IN", name: "Malayalam", native: "മലയാളം" },
  { code: "pa", speech: "pa-IN", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ur", speech: "ur-IN", name: "Urdu", native: "اردو" },
  { code: "es", speech: "es-ES", name: "Spanish", native: "Español" },
  { code: "ar", speech: "ar-SA", name: "Arabic", native: "العربية" },
]

export const languageOf = (code: string | null | undefined): Language => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]

/**
 * What is added to every message: the shape the answer should have (a summing-up line, one "- " line per filter with why it matters, a closing caution), which the answer card lays out, and
 * for a language other than English the language to write it in. Without it the model often answers in one plain paragraph.
 */
const SHAPE = 'Write the reply as: one first line saying what you did; then one line per filter, each starting with "- ", giving the threshold and in a few words why it matters; then a last line (not starting with "- ") saying these are screens to research further, not guaranteed winners.'
export const replyIn = (l: Language) => `\n\n(${l.code === "en" ? "" : `Reply in ${l.name} using ${l.name} script; keep stock names and numbers as they are. `}${SHAPE})`
export const ROOM_FOR_REPLY_NOTE = 380  // characters of the 1000 the server accepts that this note may take (the longest, with a language, is about 365)
