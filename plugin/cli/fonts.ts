import { createRequire } from 'node:module'
import { GlobalFonts } from '@napi-rs/canvas'

const require = createRequire(import.meta.url)

// The renderer asks for these two family names; the files ship with the npm dependencies.
const FONTS = [
  ['@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff2', 'SwoReel Sans'],
  ['@fontsource/noto-sans/files/noto-sans-latin-600-normal.woff2', 'SwoReel Sans'],
  ['@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff2', 'SwoReel Sans'],
  ['@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', 'SwoReel Mono'],
] as const

export function registerFonts() {
  for (const [file, family] of FONTS) GlobalFonts.registerFromPath(require.resolve(file), family)
}
