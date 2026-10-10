// scatter: points placed by two measurements.
import { ceiling, COLORS, formatNumber, MONO, PALETTE, SANS, type Area, type Context2D, type Sizes } from '../canvas.ts'
import { makeGrid, TEXT_COLORS, TEXT_PALETTE, type TextCell } from '../cells.ts'
import type { ScatterReel, ScatterStep } from '../reel.ts'
import type { Playhead } from '../timing.ts'
import { describeStage, stage } from './shared.ts'


function stateAt(reel: ScatterReel, playhead: Playhead | null) {
  const groups = [...new Set(reel.points.flatMap((point) => (point.group ? [point.group] : [])))]
  // A step can name a whole group; turn those into the ids of its points.
  const ids = (names: string[] | undefined) => names?.flatMap((name) => (groups.includes(name) ? reel.points.filter((p) => p.group === name).map((p) => p.id) : [name]))
  const steps = reel.steps.map((step) => ({ ...step, show: ids(step.show), highlight: ids(step.highlight) }))
  return {
    ...stage(reel.points, steps, 'scatter', playhead),
    groups,
    xTop: ceiling(Math.max(...reel.points.map((point) => point.x))),
    yTop: ceiling(Math.max(...reel.points.map((point) => point.y))),
  }
}

export function draw(ctx: Context2D, reel: ScatterReel, f: Sizes, area: Area, playhead: Playhead) {
  const { shown, emphasis, groups, xTop, yTop } = stateAt(reel, playhead)
  ctx.font = `400 ${f.sub}px ${MONO}`
  const left = area.x + ctx.measureText(formatNumber(yTop)).width + f.sub * 2.6
  const right = area.x + area.w - f.sub
  const top = area.y + f.label * 1.6
  const bottom = area.y + area.h - f.sub * 4.2
  const x = (value: number) => left + ((right - left) * value) / xTop
  const y = (value: number) => bottom - ((bottom - top) * value) / yTop

  for (let line = 0; line <= 4; line++) {
    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 2
    ctx.globalAlpha = line === 0 ? 1 : 0.5
    ctx.beginPath()
    ctx.moveTo(left, y((yTop * line) / 4))
    ctx.lineTo(right, y((yTop * line) / 4))
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = COLORS.muted
    ctx.textAlign = 'right'
    ctx.fillText(formatNumber((yTop * line) / 4), left - f.sub * 0.7, y((yTop * line) / 4))
    ctx.textAlign = 'center'
    ctx.fillText(formatNumber((xTop * line) / 4), x((xTop * line) / 4), bottom + f.sub * 1.4)
  }
  ctx.strokeStyle = COLORS.border
  ctx.beginPath()
  ctx.moveTo(left, top)
  ctx.lineTo(left, bottom)
  ctx.stroke()

  ctx.font = `400 ${f.sub * 1.1}px ${SANS}`
  ctx.fillStyle = COLORS.muted
  ctx.textAlign = 'center'
  ctx.fillText(reel.xLabel, (left + right) / 2, bottom + f.sub * 3.2)
  ctx.textAlign = 'left'
  ctx.fillText(reel.yLabel, area.x, area.y + f.sub * 0.8)

  const anyHigh = reel.points.some((point) => emphasis(point.id) === 'high')
  for (const point of reel.points) {
    const level = emphasis(point.id)
    const color = PALETTE[point.group ? groups.indexOf(point.group) % PALETTE.length : 0]!
    // A point being revealed grows from nothing.
    ctx.globalAlpha = shown(point.id) * (level === 'low' ? 0.25 : 0.9)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x(point.x), y(point.y), f.edge * (level === 'high' ? 0.62 : 0.46) * shown(point.id), 0, Math.PI * 2)
    ctx.fill()

    // Name the points being talked about; with nothing singled out, name them all if they are few.
    if (point.label && shown(point.id) === 1 && (level === 'high' || (!anyHigh && reel.points.length <= 8))) {
      const toLeft = x(point.x) > (left + right) * 0.6
      ctx.globalAlpha = 1
      ctx.font = `600 ${f.sub * 1.15}px ${SANS}`
      ctx.textAlign = toLeft ? 'right' : 'left'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 8
      ctx.strokeStyle = COLORS.bg
      ctx.strokeText(point.label, x(point.x) + (toLeft ? -1 : 1) * f.edge, y(point.y))
      ctx.fillStyle = COLORS.text
      ctx.fillText(point.label, x(point.x) + (toLeft ? -1 : 1) * f.edge, y(point.y))
    }
  }
  ctx.globalAlpha = 1

  // The key, when points are grouped.
  ctx.font = `600 ${f.sub * 1.15}px ${SANS}`
  ctx.textAlign = 'right'
  let keyX = right
  for (const [n, group] of [...groups.entries()].reverse()) {
    ctx.fillStyle = COLORS.text
    ctx.fillText(group, keyX, area.y + f.sub * 0.8)
    keyX -= ctx.measureText(group).width + 14
    ctx.fillStyle = PALETTE[n % PALETTE.length]!
    ctx.beginPath()
    ctx.arc(keyX, area.y + f.sub * 0.8, 8, 0, Math.PI * 2)
    ctx.fill()
    keyX -= f.label
  }
}

const COLS = 56
const ROWS = 14
const MARKS = '●▲■◆'

export function text(reel: ScatterReel, playhead: Playhead | null): TextCell[][] {
  const { shown, emphasis, groups, xTop, yTop } = stateAt(reel, playhead)
  const axisW = formatNumber(yTop).length
  const left = 3 + axisW + 1
  const grid = makeGrid(left + COLS + 26, ROWS + 5)

  grid.write(3, 0, reel.yLabel, { color: TEXT_COLORS.muted })
  for (let row = 0; row <= ROWS; row++) grid.put(left, 1 + row, { ch: '│', color: TEXT_COLORS.line })
  grid.write(left, 1 + ROWS, `└${'─'.repeat(COLS)}`, { color: TEXT_COLORS.line })
  grid.write(3, 1, formatNumber(yTop).padStart(axisW), { color: TEXT_COLORS.muted })
  grid.write(3, 1 + ROWS, '0'.padStart(axisW), { color: TEXT_COLORS.muted })
  grid.write(left + COLS - formatNumber(xTop).length + 1, 2 + ROWS, formatNumber(xTop), { color: TEXT_COLORS.muted })
  grid.write(left + 1 + Math.floor((COLS - reel.xLabel.length) / 2), 2 + ROWS, reel.xLabel, { color: TEXT_COLORS.muted })

  for (const point of reel.points) {
    if (!shown(point.id)) continue
    const level = emphasis(point.id)
    const group = point.group ? groups.indexOf(point.group) : 0
    const col = left + 1 + Math.round(((COLS - 1) * point.x) / xTop)
    const row = 1 + ROWS - 1 - Math.round(((ROWS - 1) * point.y) / yTop)
    grid.put(col, row, { ch: MARKS[group % MARKS.length]!, color: level === 'low' ? TEXT_COLORS.line : TEXT_PALETTE[group % TEXT_PALETTE.length]!, bold: level === 'high' })
    if (point.label && level === 'high') grid.write(col + 2, row, point.label, { color: TEXT_COLORS.text, bold: true })
  }
  groups.forEach((group, n) => grid.write(3 + n * 18, 4 + ROWS, `${MARKS[n % MARKS.length]} ${group}`, { color: TEXT_PALETTE[n % TEXT_PALETTE.length]! }))
  return grid.cells
}

export function describe(reel: ScatterReel, step: ScatterStep) {
  return { text: describeStage(step, (name) => reel.points.find((point) => point.id === name)?.label ?? name), style: 'request' as const }
}
