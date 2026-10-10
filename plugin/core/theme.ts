// The colours a reel is drawn in. Every one can be changed, for all reels in the settings or
// for one reel in its own file, so a reel can match someone's brand.

/** The colours that can be set, each a hex colour such as `#1acee3`. */
export interface Theme {
  /** Behind everything. */
  background: string
  /** The fill of boxes, panels and cards. */
  surface: string
  /** Outlines, grid lines and anything waiting its turn. */
  border: string
  /** Titles, captions and labels. */
  text: string
  /** Secondary text: sub-labels, axes, the watermark. */
  muted: string
  /** The main accent: what is highlighted, requests, the first series. */
  primary: string
  /** The second accent: replies, the second series. */
  secondary: string
  /** Amber by default: the third series, default marks on pictures. */
  warning: string
  /** Green by default: the fourth series. */
  success: string
  /** Errors and failures. */
  error: string
}

export const DEFAULT_THEME: Theme = {
  background: '#04101a',
  surface: '#0a1e2c',
  border: '#1d4257',
  text: '#e3fbff',
  muted: '#7fa5b8',
  primary: '#1acee3',
  secondary: '#b79cff',
  warning: '#f0b429',
  success: '#4cc38a',
  error: '#ff5c7a',
}

export const THEME_KEYS = Object.keys(DEFAULT_THEME) as (keyof Theme)[]

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** Whether text is a colour a theme accepts: `#rgb` or `#rrggbb`. */
export const isColor = (value: unknown): value is string => typeof value === 'string' && HEX.test(value)

/** The problems with a theme, each starting with `where`; none means it can be used. */
export function validateTheme(value: unknown, where: string): string[] {
  if (value === undefined) return []
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [`${where} must be an object of colours.`]
  const errors: string[] = []
  for (const [key, color] of Object.entries(value)) {
    if (!THEME_KEYS.includes(key as keyof Theme)) errors.push(`${where}.${key} is not a colour that can be set. Use one of: ${THEME_KEYS.join(', ')}.`)
    else if (!isColor(color)) errors.push(`${where}.${key} must be a hex colour such as "#1acee3".`)
  }
  return errors
}

const channels = (hex: string) => {
  const full = hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join('') : hex.slice(1)
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}

/** A colour part of the way from `from` to `to`: 0 is `from`, 1 is `to`. */
export function mix(from: string, to: string, amount: number) {
  const [a, b] = [channels(from), channels(to)]
  return `#${a.map((value, i) => Math.round(value + (b[i]! - value) * amount).toString(16).padStart(2, '0')).join('')}`
}
