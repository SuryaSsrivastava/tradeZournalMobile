import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { apiServer, resendCode, saveServer, validServer, type CodeChallenge } from "../src/api"
import { useAuth } from "../src/auth"
import { colors, radius, themed } from "../src/theme"
import { Brand, Button, ErrorNote } from "../src/ui"

export default function Login() {
  const { signIn, register, verify, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [creating, setCreating] = useState(false)  // "Create account" instead of "Sign in"
  const [again2, setAgain2] = useState("")
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const [server, setServer] = useState(apiServer())
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null)
  const [code, setCode] = useState("")
  const [note, setNote] = useState<string | null>(null)
  const [wait, setWait] = useState(0) // seconds until another code may be asked for (the server holds the same 45 seconds)
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  const google = async () => {
    setGoogleBusy(true); setError(null)
    try { await signInWithGoogle() } catch (e) { setError(e instanceof Error ? e.message : "Google sign-in did not work. Try again.") } finally { setGoogleBusy(false) }
  }

  const submit = async () => {
    if (!email.trim() || !password) { setError("Enter your email and password."); return }
    if (creating && password.length < 8) { setError("Use at least 8 characters for the password."); return }
    if (creating && password !== again2) { setError("The two passwords are not the same."); return }
    setBusy(true); setError(null)
    try {
      if (__DEV__ && advanced) {
        if (!validServer(server)) { setError("The server must be a full address, like https://tradezournal.com/api/v1"); return }
        await saveServer(server)
      }
      const c = creating ? await register(email, password) : await signIn(email, password)
      if (c) { setChallenge(c); setWait(45) }
    } catch (e) {
      setError(e instanceof Error ? e.message : creating ? "Could not create the account." : "Could not sign in.")
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async () => {
    if (!challenge || code.length !== 6) return
    setBusy(true); setError(null)
    try { await verify(challenge.challenge, code) } catch (e) { setError(e instanceof Error ? e.message : "That code did not work.") } finally { setBusy(false) }
  }

  const again = async () => {
    if (!challenge || wait > 0) return
    setError(null); setNote(null)
    try { const r = await resendCode(challenge.challenge); setChallenge({ ...challenge, challenge: r.challenge }); setWait(45); setNote("A new code is on its way.") } catch (e) { setError(e instanceof Error ? e.message : "Could not send a new code.") }
  }

  if (challenge) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.wrap}>
          <Text style={s.h1}>Check your email</Text>
          <Text style={s.p}>We sent a 6-digit code to {challenge.email}. We ask for it to confirm your address, and whenever you sign in from a phone we have not seen, so a stolen password alone cannot open your account.</Text>
          <View style={{ height: 22 }} />
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          {note ? <Text style={{ color: colors.green, fontSize: 13, marginBottom: 10 }}>{note}</Text> : null}
          <TextInput value={code} onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))} placeholder="123456" placeholderTextColor={colors.muted} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6} autoFocus onSubmitEditing={submitCode} style={[s.input, { textAlign: "center", fontSize: 22, letterSpacing: 8 }]} />
          <Button onPress={submitCode} busy={busy}>Verify and continue</Button>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 18 }}>
            <Pressable onPress={again} disabled={wait > 0}><Text style={{ color: colors.muted, fontSize: 13, opacity: wait > 0 ? 0.5 : 1 }}>{wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}</Text></Pressable>
            <Pressable onPress={() => { setChallenge(null); setCode(""); setError(null); setNote(null); setWait(0) }}><Text style={{ color: colors.muted, fontSize: 13 }}>Back</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.wrap}>
        <View style={{ alignItems: "flex-start", marginBottom: 22 }}><Brand size={64} /></View>
        <Text style={s.h1}>Your trading journal, live trades and alerts, in your pocket.</Text>
        <Text style={s.p}>{creating ? "Create your free account. It works on the website too." : "Sign in with the account you use on the website."}</Text>
        <View style={{ height: 22 }} />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" style={s.input} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry textContentType={creating ? "newPassword" : "password"} onSubmitEditing={creating ? undefined : submit} returnKeyType={creating ? "next" : "go"} style={s.input} />
        {creating ? <TextInput value={again2} onChangeText={setAgain2} placeholder="Repeat the password" placeholderTextColor={colors.muted} secureTextEntry textContentType="newPassword" onSubmitEditing={submit} returnKeyType="go" style={s.input} /> : null}
        <Button onPress={submit} busy={busy}>{creating ? "Create account" : "Sign in"}</Button>
        <Pressable onPress={() => { setCreating((v) => !v); setError(null); setAgain2("") }} style={{ marginTop: 14, alignSelf: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{creating ? "Already have an account? " : "New here? "}<Text style={{ color: colors.green, fontWeight: "700" }}>{creating ? "Sign in" : "Create an account"}</Text></Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 18 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.muted, fontSize: 12, marginHorizontal: 12 }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>
        <Pressable onPress={google} disabled={googleBusy || busy} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 50, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, opacity: pressed || googleBusy ? 0.7 : 1 })}>
          {googleBusy ? <ActivityIndicator color={colors.text} /> : <Ionicons name="logo-google" size={19} color={colors.text} />}
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>Continue with Google</Text>
        </Pressable>
        {__DEV__ ? <Pressable onPress={() => setAdvanced((v) => !v)} style={{ marginTop: 22 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{advanced ? "Hide" : "Advanced"}</Text></Pressable> : null}
        {__DEV__ && advanced ? (
          <View style={{ marginTop: 8 }}>
            <Text style={[s.p, { fontSize: 11, marginBottom: 6 }]}>Server (ends in /api/v1)</Text>
            <TextInput value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={s.input} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = themed(() => StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  brand: { color: colors.green, fontSize: 12, fontWeight: "800", letterSpacing: 4, marginBottom: 14 },
  h1: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.6, lineHeight: 34 },
  p: { color: colors.muted, fontSize: 14, marginTop: 8 },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, marginBottom: 12 },
}))
