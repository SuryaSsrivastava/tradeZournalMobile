import { ActivityIndicator, View } from "react-native"
import { colors } from "../../src/theme"

/**
 * Where the app lands when Google sign-in sends the phone back to tradezournal://auth. The sign-in itself is finished by the code that opened the Google sheet (src/api.ts); this screen
 * only exists so the router has somewhere to put that address instead of "Unmatched Route". The Gate in _layout.tsx moves on from here: home once signed in, the sign-in screen if not.
 */
export default function AuthReturn() {
  return <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.green} /></View>
}
