let reopen = false
/** Set just before the theme changes, read once by the screens that come back after it. */
export const markReopenSettings = () => { reopen = true }
export const takeReopenSettings = () => { const r = reopen; reopen = false; return r }
