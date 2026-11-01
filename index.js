// The app's entry: the router's own, plus (only in builds made with WIDGET=1) the handler that draws the home-screen widget, which Android runs without opening the app.
import "expo-router/entry"

if (process.env.EXPO_PUBLIC_WIDGET === "1") {
  require("./src/widget").registerWidget()
}
