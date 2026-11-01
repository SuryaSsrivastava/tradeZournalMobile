/** Pictures shared to the app from the phone's gallery or another app, waiting for the "Add to a trade" screen to take them. */
export type SharedFile = { path: string; mimeType: string; fileName?: string; width?: number | null; height?: number | null }
let files: SharedFile[] = []
export const setShared = (f: SharedFile[]) => { files = f }
export const getShared = () => files
export const clearShared = () => { files = [] }
