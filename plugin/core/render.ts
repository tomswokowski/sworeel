// Draws a frame of any reel: the title, caption and progress dots that every kind shares,
// around the picture its kind draws.
import { applyTheme, COLORS, fitLines, FORMATS, SANS, type Area, type Assets, type Context2D, type Format, type Sizes } from './canvas.ts'
import * as array from './kinds/array.ts'
import * as chart from './kinds/chart.ts'
import * as code from './kinds/code.ts'
import * as flow from './kinds/flow.ts'
import * as gantt from './kinds/gantt.ts'
import * as line from './kinds/line.ts'
import * as map from './kinds/map.ts'
import * as math from './kinds/math.ts'
import * as picture from './kinds/picture.ts'
import * as pie from './kinds/pie.ts'
import * as scatter from './kinds/scatter.ts'
import * as screen from './kinds/screen.ts'
import * as sequence from './kinds/sequence.ts'
import * as sketch from './kinds/sketch.ts'
import * as timeline from './kinds/timeline.ts'
import * as tree from './kinds/tree.ts'
import type { Theme } from './theme.ts'
import { kindOf, type Kind, type Reel } from './reel.ts'
import type { Playhead } from './timing.ts'

export { FORMATS, type Assets, type Context2D, type Format } from './canvas.ts'

type Draw<S> = (ctx: Context2D, reel: S, f: Sizes, area: Area, playhead: Playhead, assets: Assets) => void

// Each kind's `draw` takes its own kind of reel; the reel's `kind` says which one applies.
const DRAW = { flow: flow.draw, sequence: sequence.draw, tree: tree.draw, timeline: timeline.draw, gantt: gantt.draw, chart: chart.draw, line: line.draw, scatter: scatter.draw, pie: pie.draw, code: code.draw, array: array.draw, math: math.draw, map: map.draw, picture: picture.draw, screen: screen.draw, sketch: sketch.draw } as unknown as Record<Kind, Draw<Reel>>

export interface DrawOptions extends Assets {
  /** A short credit, such as a handle, drawn small in the bottom corner of every frame. */
  watermark?: string
  /** Colours that replace the default ones for every reel; a reel's own `theme` goes on top. */
  theme?: Partial<Theme>
  /** Whether to draw the row of dots that shows how far through its steps the reel is. Off unless true. */
  progress?: boolean
}

/** Past this many steps the dots would be too small to read, so a bar is drawn instead. */
const MOST_DOTS = 30

/** Breaks text into the fewest lines that fit, then evens out their lengths. */
function wrap(ctx: Context2D, text: string, maxWidth: number) {
  const fit = (limit: number) => fitLines(ctx, text, limit)

  let lines = fit(maxWidth)
  for (let limit = maxWidth * 0.95; limit > maxWidth * 0.4; limit -= maxWidth * 0.05) {
    const narrower = fit(limit)
    if (narrower.length > lines.length) break
    lines = narrower
  }
  return lines
}

/** Draws one frame of a reel. */
export function drawReel(ctx: Context2D, reel: Reel, format: Format, playhead: Playhead, options: DrawOptions = {}) {
  const f = FORMATS[format]
  const { index, elapsed } = playhead
  applyTheme({ ...options.theme, ...reel.theme })

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, f.w, f.h)

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = COLORS.text
  // A long title shrinks to stay inside the frame.
  ctx.font = `700 ${f.title}px ${SANS}`
  const titleRoom = f.w - f.side * 1.2
  const titleWidth = ctx.measureText(reel.title).width
  if (titleWidth > titleRoom) ctx.font = `700 ${Math.floor((f.title * titleRoom) / titleWidth)}px ${SANS}`
  ctx.fillText(reel.title, f.w / 2, f.top * 0.5)

  const area = { x: f.side, y: f.top, w: f.w - f.side * 2, h: f.h - f.top - f.bottom }
  DRAW[kindOf(reel)](ctx, reel, f, area, playhead, options)
  ctx.lineCap = 'butt'

  ctx.setLineDash([])
  ctx.textBaseline = 'middle'
  const step = reel.steps[index]
  if (step) {
    ctx.globalAlpha = Math.min(elapsed / 250, 1)
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.text
    ctx.font = `400 ${f.caption}px ${SANS}`
    const lines = wrap(ctx, step.caption, f.w - f.side * 2)
    const lineHeight = f.caption * 1.3
    const middle = f.h - f.bottom + (f.bottom - 60) / 2
    lines.forEach((line, i) => ctx.fillText(line, f.w / 2, middle + (i - (lines.length - 1) / 2) * lineHeight))
  }
  ctx.globalAlpha = 1

  if (options.watermark) {
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.muted
    ctx.font = `400 ${f.sub}px ${SANS}`
    ctx.fillText(options.watermark, f.w - f.side * 0.6, f.h - 34)
  }

  if (!options.progress) return
  const count = reel.steps.length
  // Kept to the middle of the frame, clear of the watermark in the corner.
  const room = f.w * 0.5
  if (count > MOST_DOTS) {
    // Too many steps for a dot each: a bar that fills as the reel progresses.
    ctx.fillStyle = COLORS.border
    ctx.fillRect(f.w / 2 - room / 2, f.h - 37, room, 6)
    ctx.fillStyle = COLORS.text
    ctx.fillRect(f.w / 2 - room / 2, f.h - 37, (room * (index + 1)) / count, 6)
    return
  }
  // One dot per step, filled as the reel progresses, drawn closer and smaller when there are many.
  const gap = Math.min(22, room / Math.max(count - 1, 1))
  const firstDot = f.w / 2 - ((count - 1) * gap) / 2
  reel.steps.forEach((_, i) => {
    ctx.fillStyle = i <= index ? COLORS.text : COLORS.border
    ctx.beginPath()
    ctx.arc(firstDot + i * gap, f.h - 34, Math.min(5, gap * 0.25), 0, Math.PI * 2)
    ctx.fill()
  })
}
