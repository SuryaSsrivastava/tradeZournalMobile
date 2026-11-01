/** A picture shared to the app arrives as a special link (`tradezournal://dataUrl=...`). It is not a screen: send it to the start and let the share handler in the root layout take over. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return path.includes("dataUrl=") ? "/" : path
}
