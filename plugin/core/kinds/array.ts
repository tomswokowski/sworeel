// array: a row of cells, for walking through an algorithm.
import { COLORS, MONO, SANS, type Area, type Context2D, type Sizes } from '../canvas.ts'
import { makeGrid, TEXT_COLORS, type TextCell } from '../cells.ts'
import type { ArrayReel, ArrayStep, Cell } from '../reel.ts'
import { movement, type Playhead } from '../timing.ts'

/** The cells as they stand once the first `count` steps have been applied. */
function cellsAfter(reel: ArrayReel, count: number): Cell[] {
  let cells = [...reel.cells]
  for (const step of reel.steps.slice(0, Math.max(count, 0))) {
    if (step.set) cells = [...step.set]
    if (step.swap) {
      const [a, b] = step.swap
      ;[cells[a], cells[b]] = [cells[b]!, cells[a]!]
    }
  }
  return cells
}

function stateAt(reel: ArrayReel, playhead: Playhead | null) {
  const index = playhead?.index ?? reel.steps.length - 1
  const step = reel.steps[index]
  const change = playhead && step ? movement(step, 'array', playhead.elapsed) : 1
  // A replaced array switches over half-way through the step; a swap slides instead.
  const cells = step?.set && change < 0.5 ? cellsAfter(reel, index) : cellsAfter(reel, index + (step?.swap && change < 1 ? 0 : 1))
  return { step, change, cells, swap: step?.swap && change < 1 ? step.swap : null }
}

/** The names pointing at each position, e.g. position 2 has ["mid"]. */
function pointersBy(step: ArrayStep | undefined) {
  const by = new Map<number, string[]>()
  for (const [name, position] of Object.entries(step?.pointers ?? {})) by.set(position, [...(by.get(position) ?? []), name])
  return by
}

export function draw(ctx: Context2D, reel: ArrayReel, f: Sizes, area: Area, playhead: Playhead) {
  const { step, change, cells, swap } = stateAt(reel, playhead)
  const size = Math.min((area.w * 0.96) / cells.length, area.h * 0.3, f.label * 5.5)
  const left = area.x + (area.w - size * cells.length) / 2
  const middle = area.y + area.h / 2
  const highlighted = new Set(step?.highlight ?? [])
  const dimmed = new Set(step?.dim ?? [])
  const slot = (position: number) => left + size * position

  cells.forEach((value, i) => {
    // During a swap the two cells slide past each other, one arcing above and one below.
    let x = slot(i)
    let y = middle
    if (swap?.includes(i)) {
      const other = swap[0] === i ? swap[1] : swap[0]
      x += (slot(other) - slot(i)) * change
      y += Math.sin(change * Math.PI) * size * 0.7 * (swap[0] === i ? -1 : 1)
    }

    const isHigh = highlighted.has(i) || (swap?.includes(i) ?? false)
    ctx.globalAlpha = dimmed.has(i) ? 0.3 : 1
    ctx.fillStyle = COLORS.surface
    ctx.strokeStyle = isHigh ? COLORS.request : COLORS.border
    ctx.lineWidth = isHigh ? 4 : 2.5
    ctx.beginPath()
    ctx.roundRect(x + size * 0.06, y - size * 0.44, size * 0.88, size * 0.88, size * 0.12)
    ctx.fill()
    ctx.stroke()

    const label = String(value)
    ctx.textAlign = 'center'
    ctx.fillStyle = isHigh ? COLORS.request : COLORS.text
    ctx.font = `600 ${Math.min(size * 0.36, (size * 1.3) / Math.max(label.length, 2))}px ${SANS}`
    ctx.fillText(label, x + size / 2, y)
  })

  ctx.globalAlpha = 1
  ctx.textAlign = 'center'
  ctx.font = `400 ${f.sub}px ${MONO}`
  ctx.fillStyle = COLORS.muted
  cells.forEach((_, i) => ctx.fillText(String(i), slot(i) + size / 2, middle + size * 0.44 + f.sub * 1.3))

  // Pointers sit above their cell, each with a short line down to it.
  for (const [position, names] of pointersBy(step)) {
    const x = slot(position) + size / 2
    const tip = middle - size * 0.44 - 10
    ctx.strokeStyle = COLORS.reply
    ctx.fillStyle = COLORS.reply
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x, tip - f.label * 0.9)
    ctx.lineTo(x, tip)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - 8, tip - 10)
    ctx.lineTo(x, tip)
    ctx.lineTo(x + 8, tip - 10)
    ctx.stroke()
    ctx.font = `600 ${f.label * 0.85}px ${MONO}`
    names.forEach((name, n) => ctx.fillText(name, x, tip - f.label * 1.5 - n * f.label * 1.05))
  }
}

export function text(reel: ArrayReel, playhead: Playhead | null): TextCell[][] {
  const { step, cells, swap } = stateAt(reel, playhead)
  const width = Math.max(4, ...cells.map((cell) => String(cell).length + 2))
  const pointers = pointersBy(step)
  const stack = Math.max(0, ...[...pointers.values()].map((names) => names.length))
  const highlighted = new Set([...(step?.highlight ?? []), ...(swap ?? [])])
  const dimmed = new Set(step?.dim ?? [])
  const left = 4
  const top = stack ? stack + 2 : 1
  const grid = makeGrid(left + cells.length * (width + 1) + 5, top + 5)
  const centre = (position: number) => left + position * (width + 1) + 1 + Math.floor(width / 2)
  const line = { color: TEXT_COLORS.line }

  for (const [position, names] of pointers) {
    names.forEach((name, n) => grid.write(centre(position) - Math.floor(name.length / 2), top - 2 - n, name, { color: TEXT_COLORS.reply, bold: true }))
    grid.put(centre(position), top - 1, { ch: '↓', color: TEXT_COLORS.reply })
  }

  const rule = (y: number, start: string, joint: string, end: string) =>
    grid.write(left, y, start + cells.map(() => '─'.repeat(width)).join(joint) + end, line)
  rule(top, '┌', '┬', '┐')
  rule(top + 2, '└', '┴', '┘')
  cells.forEach((cell, i) => {
    const x = left + i * (width + 1)
    grid.put(x, top + 1, { ch: '│', ...line })
    const label = String(cell)
    const isHigh = highlighted.has(i)
    grid.write(x + 1 + Math.floor((width - label.length) / 2), top + 1, label, {
      color: isHigh ? TEXT_COLORS.request : dimmed.has(i) ? TEXT_COLORS.line : TEXT_COLORS.text,
      bold: isHigh,
    })
    grid.write(centre(i) - (String(i).length > 1 ? 1 : 0), top + 3, String(i), { color: TEXT_COLORS.muted })
    // A plain-text reader has no colour, so mark what is emphasised underneath as well.
    if (isHigh) grid.put(centre(i), top + 4, { ch: '▲', color: TEXT_COLORS.request })
  })
  grid.put(left + cells.length * (width + 1), top + 1, { ch: '│', ...line })
  return grid.cells
}

export function describe(_reel: ArrayReel, step: ArrayStep) {
  const parts = [
    step.swap ? `swap [${step.swap[0]}] ↔ [${step.swap[1]}]` : '',
    step.set ? 'new values' : '',
    Object.entries(step.pointers ?? {}).map(([name, position]) => `${name}=${position}`).join(' '),
  ]
  return { text: parts.filter(Boolean).join('   '), style: 'request' as const }
}
