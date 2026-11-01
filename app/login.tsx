import { Ionicons } from "@expo/vector-icons"
import { useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { apiServer, saveServer, validServer } from "../src/api"
import { useAuth } from "../src/auth"
import { colors, radius } from "../src/theme"
import { Brand, Button, ErrorNote } from "../src/ui"

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const [server, setServer] = useState(apiServer())

  const google = async () => {
    setGoogleBusy(true); setError(null)
    try { await signInWithGoogle() } catch (e) { setError(e instanceof Error ? e.message : "Google sign-in did not work. Try again.") } finally { setGoogleBusy(false) }
  }

  const submit = async () => {
    if (!email.trim() || !password) { setError("Enter your email and password."); return }
    setBusy(true); setError(null)
    try {
      if (__DEV__ && advanced) {
        if (!validServer(server)) { setError("The server must be a full address, like https://tradezournal.com/api/v1"); return }
        await saveServer(server)
      }
      await signIn(email, password)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.wrap}>
        <View style={{ alignItems: "flex-start", marginBottom: 22 }}><Brand size={64} /></View>
        <Text style={s.h1}>Your trading journal, live trades and alerts, in your pocket.</Text>
        <Text style={s.p}>Sign in with the account you use on the website.</Text>
        <View style={{ height: 22 }} />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" style={s.input} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry textContentType="password" onSubmitEditing={submit} returnKeyType="go" style={s.input} />
        <Button onPress={submit} busy={busy}>Sign in</Button>
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

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  brand: { color: colors.green, fontSize: 12, fontWeight: "800", letterSpacing: 4, marginBottom: 14 },
  h1: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.6, lineHeight: 34 },
  p: { color: colors.muted, fontSize: 14, marginTop: 8 },
  input: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, marginBottom: 12 },
})
