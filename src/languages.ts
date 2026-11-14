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

/** What is added to a message so the answer comes back in the chosen language (nothing for English). */
export const replyIn = (l: Language) => (l.code === "en" ? "" : `\n\n(Reply in ${l.name} using ${l.name} script. Keep the same line-by-line format with "- " lines; keep stock names and numbers as they are.)`)
export const ROOM_FOR_REPLY_NOTE = 160  // characters of the 1000 the server accepts that this note may take
