// What the text renderers share: a grid of characters, each with an optional colour.
import { DEFAULT_THEME } from './theme.ts'

export interface TextCell {
  ch: string
  /** A colour as `#rrggbb`, used when the frame is shown with colour. */
  color?: string
  bold?: boolean
}

// Text is always drawn in the default theme. It is shown in a terminal, whose background is
// not ours to set, so a user's or a reel's own colours are not applied to it.
export const TEXT_COLORS = {
  text: DEFAULT_THEME.text,
  muted: DEFAULT_THEME.muted,
  line: '#3d6f8a',
  request: DEFAULT_THEME.primary,
  quiet: '#17829a',
  reply: DEFAULT_THEME.secondary,
  error: DEFAULT_THEME.error,
}

export const TEXT_PALETTE = [DEFAULT_THEME.primary, DEFAULT_THEME.secondary, DEFAULT_THEME.warning, DEFAULT_THEME.success, DEFAULT_THEME.error, DEFAULT_THEME.muted]

export interface TextGrid {
  cells: TextCell[][]
  put(x: number, y: number, cell: TextCell): void
  write(x: number, y: number, text: string, style?: Omit<TextCell, 'ch'>): void
}

export function makeGrid(width: number, height: number): TextGrid {
  const cells: TextCell[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => ({ ch: ' ' })))
  const put = (x: number, y: number, cell: TextCell) => {
    if (cells[y]?.[x]) cells[y]![x] = cell
  }
  const write = (x: number, y: number, text: string, style: Omit<TextCell, 'ch'> = {}) => {
    ;[...text].forEach((ch, i) => put(x + i, y, { ch, ...style }))
  }
  return { cells, put, write }
}
