// line: one to three series plotted over the same points.
import { ceiling, COLORS, formatNumber, MONO, PALETTE, SANS, type Area, type Context2D, type Sizes } from '../canvas.ts'
import { makeGrid, TEXT_COLORS, TEXT_PALETTE, type TextCell } from '../cells.ts'
import type { LineReel, LineStep } from '../reel.ts'
import { movement, type Playhead } from '../timing.ts'

const amount = (reel: LineReel, value: number) => `${formatNumber(value)}${reel.unit ? ` ${reel.unit}` : ''}`

function stateAt(reel: LineReel, playhead: Playhead | null) {
  const index = playhead?.index ?? reel.steps.length - 1
  const step = reel.steps[index]
  const change = playhead && step ? movement(step, 'line', playhead.elapsed) : 1
  // If any step reveals points, the line starts as its first point alone; otherwise it is all there.
  let before = reel.steps.some((s) => s.upTo !== undefined) ? 1 : reel.x.length
  for (const earlier of reel.steps.slice(0, Math.max(index, 0))) before = earlier.upTo ?? before
  const after = step?.upTo ?? before
  const highlighted = step?.highlight?.length ? new Set(step.highlight) : null

  return {
    step,
    /** How many points are drawn, which is fractional while the line is growing. */
    drawn: before + (after - before) * change,
    isLow: (id: string) => highlighted !== null && !highlighted.has(id),
    top: ceiling(Math.max(...reel.series.flatMap((series) => series.values))),
  }
}

export function draw(ctx: Context2D, reel: LineReel, f: Sizes, area: Area, playhead: Playhead) {
  const { step, drawn, isLow, top } = stateAt(reel, playhead)
  ctx.font = `400 ${f.sub}px ${MONO}`
  const left = area.x + ctx.measureText(amount(reel, top)).width + f.sub
  const right = area.x + area.w - f.sub
  const topY = area.y + f.label * 1.6
  const bottom = area.y + area.h - f.sub * 2.6
  const x = (i: number) => left + ((right - left) * i) / (reel.x.length - 1)
  const y = (value: number) => bottom - ((bottom - topY) * value) / top

  for (let line = 0; line <= 4; line++) {
    const value = (top * line) / 4
    ctx.strokeStyle = COLORS.border
    ctx.globalAlpha = line === 0 ? 1 : 0.5
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(left, y(value))
    ctx.lineTo(right, y(value))
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.muted
    ctx.fillText(amount(reel, value), left - f.sub * 0.7, y(value))
  }

  // With many points, label every other one so they don't collide.
  const every = reel.x.length > 8 ? 2 : 1
  ctx.textAlign = 'center'
  reel.x.forEach((label, i) => {
    if (i % every === 0) ctx.fillText(label, x(i), bottom + f.sub * 1.5)
  })

  reel.series.forEach((series, n) => {
    const color = PALETTE[n]!
    // The last point the line has fully reached; `drawn` counts points, and can be part-way to the next.
    const whole = Math.min(Math.floor(drawn - 1 + 1e-6), reel.x.length - 1)
    ctx.globalAlpha = isLow(series.id) ? 0.3 : 1
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    for (let i = 0; i <= whole; i++) {
      if (i === 0) ctx.moveTo(x(0), y(series.values[0]!))
      else ctx.lineTo(x(i), y(series.values[i]!))
    }
    // The part of the next segment the line has reached so far.
    const part = drawn - 1 - whole
    if (part > 0 && whole >= 0 && whole + 1 < reel.x.length) {
      const from = series.values[whole]!
      ctx.lineTo(x(whole + part), y(from + (series.values[whole + 1]! - from) * part))
    }
    ctx.stroke()
    for (let i = 0; i <= whole; i++) {
      ctx.beginPath()
      ctx.arc(x(i), y(series.values[i]!), 7, 0, Math.PI * 2)
      ctx.fill()
    }
  })
  ctx.globalAlpha = 1

  if (step?.mark !== undefined && step.mark < drawn) {
    const at = step.mark
    ctx.strokeStyle = COLORS.text
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(x(at), topY)
    ctx.lineTo(x(at), bottom)
    ctx.stroke()
    ctx.setLineDash([])
    // Values go on whichever side has room.
    const side = at > reel.x.length / 2 ? -1 : 1
    ctx.font = `600 ${f.label * 0.85}px ${MONO}`
    ctx.textAlign = side < 0 ? 'right' : 'left'
    reel.series.forEach((series, n) => {
      if (isLow(series.id)) return
      ctx.lineWidth = 8
      ctx.lineJoin = 'round'
      ctx.strokeStyle = COLORS.bg
      ctx.strokeText(amount(reel, series.values[at]!), x(at) + side * 16, y(series.values[at]!) - f.label * 0.8)
      ctx.fillStyle = PALETTE[n]!
      ctx.fillText(amount(reel, series.values[at]!), x(at) + side * 16, y(series.values[at]!) - f.label * 0.8)
    })
  }

  // The key, along the top.
  ctx.font = `600 ${f.sub * 1.15}px ${SANS}`
  ctx.textAlign = 'left'
  let keyX = left
  reel.series.forEach((series, n) => {
    ctx.globalAlpha = isLow(series.id) ? 0.4 : 1
    ctx.fillStyle = PALETTE[n]!
    ctx.beginPath()
    ctx.arc(keyX + 8, area.y + f.sub * 0.8, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = COLORS.text
    ctx.fillText(series.label, keyX + 24, area.y + f.sub * 0.8)
    keyX += 24 + ctx.measureText(series.label).width + f.label * 1.4
  })
  ctx.globalAlpha = 1
}

const BLOCKS = '▁▂▃▄▅▆▇█'

export function text(reel: LineReel, playhead: Playhead | null): TextCell[][] {
  const { step, drawn, isLow, top } = stateAt(reel, playhead)
  const points = Math.round(drawn)
  const labelW = Math.max(...reel.series.map((series) => series.label.length))
  const start = 3 + labelW + 2
  // Each point is drawn a few characters wide, so the shape is easier to read.
  const wide = reel.x.length < 6 ? 4 : 2
  const grid = makeGrid(start + reel.x.length * wide + 30, reel.series.length * 2 + 4)

  reel.series.forEach((series, n) => {
    const y = 1 + n * 2
    const color = isLow(series.id) ? TEXT_COLORS.line : TEXT_PALETTE[n]!
    grid.write(3, y, series.label.padStart(labelW), { color: isLow(series.id) ? TEXT_COLORS.muted : TEXT_COLORS.text, bold: !isLow(series.id) })
    series.values.slice(0, points).forEach((value, i) => {
      grid.write(start + i * wide, y, BLOCKS[Math.min(Math.round((value / top) * 7), 7)]!.repeat(wide), { color })
    })
    const last = series.values[Math.min(points, series.values.length) - 1]!
    grid.write(start + reel.x.length * wide + 2, y, `${amount(reel, series.values[0]!)} → ${amount(reel, last)}`, { color: TEXT_COLORS.muted })
  })

  const axis = 1 + reel.series.length * 2
  grid.write(start, axis, reel.x[0]!, { color: TEXT_COLORS.muted })
  const end = reel.x.at(-1)!
  grid.write(start + reel.x.length * wide - end.length, axis, end, { color: TEXT_COLORS.muted })
  if (step?.mark !== undefined && step.mark < points) {
    grid.write(start + step.mark * wide, axis + 1, '▲', { color: TEXT_COLORS.text })
    grid.write(start + step.mark * wide + 2, axis + 1, reel.x[step.mark]!, { color: TEXT_COLORS.text, bold: true })
  }
  return grid.cells
}

export function describe(reel: LineReel, step: LineStep) {
  const labelOf = (id: string) => reel.series.find((series) => series.id === id)?.label ?? id
  const parts = [
    step.upTo !== undefined ? `up to ${reel.x[step.upTo - 1]}` : '',
    step.mark !== undefined ? `at ${reel.x[step.mark]}: ${reel.series.map((series) => amount(reel, series.values[step.mark!]!)).join(', ')}` : '',
    step.highlight?.length ? `◆ ${step.highlight.map(labelOf).join(', ')}` : '',
  ]
  return { text: parts.filter(Boolean).join('   '), style: 'request' as const }
}
