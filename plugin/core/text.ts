// Draws a reel with text characters, for terminals and chat windows that only show text.
import { type TextCell } from './cells.ts'
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
import { kindOf, type Kind, type MessageStyle, type Reel, type ReelStep } from './reel.ts'
import type { Playhead } from './timing.ts'

export { TEXT_COLORS, type TextCell } from './cells.ts'

type Described = { text: string; style: MessageStyle }

// Each kind's functions take its own kind of reel and step; the reel's `kind` says which apply.
const TEXT = { flow: flow.text, sequence: sequence.text, tree: tree.text, timeline: timeline.text, gantt: gantt.text, chart: chart.text, line: line.text, scatter: scatter.text, pie: pie.text, code: code.text, array: array.text, math: math.text, map: map.text, picture: picture.text, screen: screen.text, sketch: sketch.text } as unknown as Record<Kind, (reel: Reel, playhead: Playhead | null) => TextCell[][]>
const DESCRIBE = { flow: flow.describe, sequence: sequence.describe, tree: tree.describe, timeline: timeline.describe, gantt: gantt.describe, chart: chart.describe, line: line.describe, scatter: scatter.describe, pie: pie.describe, code: code.describe, array: array.describe, math: math.describe, map: map.describe, picture: picture.describe, screen: screen.describe, sketch: sketch.describe } as unknown as Record<Kind, (reel: Reel, step: ReelStep) => Described>

/**
 * Draws the picture part of a reel as a grid of characters.
 * Without a playhead it is drawn as it stands at the end, with the last step's emphasis.
 */
export function drawText(reel: Reel, playhead: Playhead | null): TextCell[][] {
  return TEXT[kindOf(reel)](reel, playhead)
}

/** What a step does, in a few words, and the colour that goes with it. Empty when it only has a caption. */
export function describeStep(reel: Reel, step: ReelStep): Described {
  return DESCRIBE[kindOf(reel)](reel, step)
}

/** Turns a drawn grid into lines of text, with ANSI colour codes if wanted. */
export function gridToLines(grid: TextCell[][], color: boolean): string[] {
  return grid.map((row) => {
    if (!color) return row.map((cell) => cell.ch).join('').trimEnd()
    return `${row.map(paint).join('')}\x1b[0m`
  })
}

export function paint(cell: TextCell) {
  if (!cell.color && !cell.bold) return `\x1b[0m${cell.ch}`
  const [r, g, b] = cell.color ? [1, 3, 5].map((i) => parseInt(cell.color!.slice(i, i + 2), 16)) : []
  return `\x1b[0${cell.bold ? ';1' : ''}${cell.color ? `;38;2;${r};${g};${b}` : ''}m${cell.ch}`
}
