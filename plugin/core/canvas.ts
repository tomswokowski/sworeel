// What the picture renderers share: the drawing surface, the output formats and the palette.

import { DEFAULT_THEME, mix, type Theme } from './theme.ts'

export type Format = 'wide' | 'tall' | 'square'

/** The subset of the Canvas 2D API the renderers use, so they run in a browser and in Node alike. */
export interface Context2D {
  fillStyle: unknown
  strokeStyle: unknown
  lineWidth: number
  lineJoin: string
  globalAlpha: number
  font: string
  textAlign: string
  textBaseline: string
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  arc(x: number, y: number, radius: number, start: number, end: number): void
  roundRect(x: number, y: number, width: number, height: number, radius: number): void
  fill(): void
  stroke(): void
  fillRect(x: number, y: number, width: number, height: number): void
  fillText(text: string, x: number, y: number): void
  strokeText(text: string, x: number, y: number): void
  measureText(text: string): { width: number }
  setLineDash(segments: number[]): void
  lineCap: string
  save(): void
  restore(): void
  translate(x: number, y: number): void
  scale(x: number, y: number): void
  closePath(): void
  rect(x: number, y: number, width: number, height: number): void
  clip(): void
  // The methods below take things only the host can make: a path, a picture. `fill` and
  // `stroke` with no argument act on the path being built, as above.
  fill(path: never): void
  stroke(path: never): void
  drawImage(image: never, x: number, y: number, width: number, height: number): void
}

/** A typeset formula, ready to draw: its size in ems, and shapes laid out in that space. */
export interface Formula {
  width: number
  height: number
  /** Filled shapes, each a path the host made, drawn after scaling by `scale` and moving to `x`, `y` (in ems, y downwards). */
  shapes: { path: unknown; x: number; y: number; scaleX: number; scaleY: number }[]
}

/**
 * What a host (the CLI, the desktop app) hands the renderer beyond a canvas: the things that
 * need a real graphics library or a file system. Kinds that need one go without where it is
 * missing, drawing a plain fallback.
 */
export interface Assets {
  /** Turns an SVG path string into something `fill` and `stroke` accept. */
  makePath?: (d: string) => unknown
  /** Formulas typeset ahead of drawing, by their TeX source. */
  formulas?: Map<string, Formula>
  /** Pictures loaded ahead of drawing, by the path a reel names them with. */
  images?: Map<string, { image: unknown; width: number; height: number }>
}

// Pixel sizes per output format. `top` and `bottom` reserve bands for the title and caption.
export const FORMATS = {
  wide: { w: 1600, h: 900, top: 120, bottom: 170, side: 110, title: 44, caption: 32, label: 24, sub: 17, edge: 19 },
  tall: { w: 1080, h: 1920, top: 260, bottom: 400, side: 50, title: 60, caption: 46, label: 34, sub: 24, edge: 24 },
  square: { w: 1080, h: 1080, top: 130, bottom: 210, side: 50, title: 46, caption: 34, label: 26, sub: 18, edge: 19 },
} as const

export type Sizes = (typeof FORMATS)[Format]

/** The space between the title and the caption, which a kind draws its picture in. */
export interface Area {
  x: number
  y: number
  w: number
  h: number
}

/** The calm accent that goes with the default theme, picked by eye rather than mixed. */
const DEFAULT_QUIET = '#17829a'

// The colours every kind draws with. They start as the default theme and are set again by
// `applyTheme` at the start of each frame, so read them while drawing, never into a constant.
export const COLORS = {
  bg: DEFAULT_THEME.background,
  surface: DEFAULT_THEME.surface,
  border: DEFAULT_THEME.border,
  text: DEFAULT_THEME.text,
  muted: DEFAULT_THEME.muted,
  request: DEFAULT_THEME.primary,
  /** A calmer version of the main accent, for things that are present but not the point. */
  quiet: DEFAULT_QUIET,
  reply: DEFAULT_THEME.secondary,
  error: DEFAULT_THEME.error,
  /** Slightly off the background, for a panel that should sit just behind what is on it. */
  sunken: mix(DEFAULT_THEME.background, DEFAULT_THEME.surface, 0.35),
}

export const SANS = '"SwoReel Sans", sans-serif'
export const MONO = '"SwoReel Mono", monospace'

/** Colours for things that are told apart by colour alone: series, slices. */
export const PALETTE = [DEFAULT_THEME.primary, DEFAULT_THEME.secondary, DEFAULT_THEME.warning, DEFAULT_THEME.success, DEFAULT_THEME.error, DEFAULT_THEME.muted]

/** Breaks text into lines no wider than `maxWidth` pixels in the context's current font. */
export function fitLines(ctx: Context2D, text: string, maxWidth: number) {
  const lines: string[] = []
  for (const word of text.split(/\s+/)) {
    const last = lines[lines.length - 1]
    if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= maxWidth) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}

/**
 * A number as it is written on a chart: thousands separated, and only as many decimals as its
 * size makes worth reading (0.025, 3.75, 18.75, 187.5, 1,250).
 */
export function formatNumber(value: number) {
  if (!Number.isFinite(value)) return String(value)
  const size = Math.abs(value)
  const fixed = size.toFixed(size >= 100 ? 1 : size >= 10 ? 2 : 3)
  const [whole, decimals = ''] = fixed.split('.')
  const kept = decimals.replace(/0+$/, '')
  const text = `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${kept ? `.${kept}` : ''}`
  return value < 0 && Number(fixed) !== 0 ? `-${text}` : text
}

/** A round number at or above `value`, for the top of a scale. */
export function ceiling(value: number) {
  const power = 10 ** Math.floor(Math.log10(Math.max(value, 1e-9)))
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((top) => top >= value) ?? value
}

/** Draws one of the bundled icons with its top left corner at `x`, `y`. Does nothing where paths can't be made. */
export function drawIcon(ctx: Context2D, assets: Assets, paths: string[] | undefined, x: number, y: number, size: number, color: string) {
  if (!paths || !assets.makePath) return
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash([])
  for (const d of paths) ctx.stroke(assets.makePath(d) as never)
  ctx.restore()
}

/** The colours a reel can ask for by name. */
export const TINTS = { cyan: DEFAULT_THEME.primary, violet: DEFAULT_THEME.secondary, amber: DEFAULT_THEME.warning, green: DEFAULT_THEME.success, red: DEFAULT_THEME.error, muted: DEFAULT_THEME.muted }

/**
 * Sets the colours everything is drawn with: the default theme, with any of its colours
 * replaced. Called at the start of every frame, so one reel's colours never leak into the next.
 */
export function applyTheme(changes: Partial<Theme> = {}) {
  const theme = { ...DEFAULT_THEME, ...changes }
  // With the default accent, keep the hand-picked calm cyan; otherwise make one to match.
  const quiet = theme.primary === DEFAULT_THEME.primary && theme.background === DEFAULT_THEME.background ? DEFAULT_QUIET : mix(theme.primary, theme.background, 0.4)
  Object.assign(COLORS, { bg: theme.background, surface: theme.surface, border: theme.border, text: theme.text, muted: theme.muted, request: theme.primary, quiet, reply: theme.secondary, error: theme.error, sunken: mix(theme.background, theme.surface, 0.35) })
  PALETTE.splice(0, PALETTE.length, theme.primary, theme.secondary, theme.warning, theme.success, theme.error, theme.muted)
  Object.assign(TINTS, { cyan: theme.primary, violet: theme.secondary, amber: theme.warning, green: theme.success, red: theme.error, muted: theme.muted })
}
