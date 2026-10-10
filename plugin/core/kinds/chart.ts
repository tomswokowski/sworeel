// chart: horizontal bars, for comparing quantities.
import { COLORS, formatNumber, SANS, type Area, type Context2D, type Sizes } from '../canvas.ts'
import { makeGrid, TEXT_COLORS, type TextCell } from '../cells.ts'
import type { ChartReel, ChartStep } from '../reel.ts'
import { movement, type Playhead } from '../timing.ts'

const amount = (reel: ChartReel, value: number) => `${formatNumber(value)}${reel.unit ? ` ${reel.unit}` : ''}`

/** Every bar as it stands at this moment: its length now, and how it should be drawn. */
function barsAt(reel: ChartReel, playhead: Playhead | null) {
  const index = playhead?.index ?? reel.steps.length - 1
  const step = reel.steps[index]
  const change = playhead && step ? movement(step, 'chart', playhead.elapsed) : 1
  const highlighted = step?.highlight?.length ? new Set(step.highlight) : null
  // The scale ends at `max`, or at the largest value any bar takes. All zeros still needs a scale.
  const top = (reel.max ?? Math.max(...reel.bars.map((b) => b.value), ...reel.steps.flatMap((s) => Object.values(s.set ?? {})))) || 1

  return reel.bars.map((bar) => {
    // The value before this step, and after it; the bar is somewhere between the two.
    let before = bar.value
    for (const earlier of reel.steps.slice(0, Math.max(index, 0))) before = earlier.set?.[bar.id] ?? before
    const after = step?.set?.[bar.id] ?? before

    const revealedAt = bar.hidden ? reel.steps.findIndex((s) => s.show?.includes(bar.id)) : -1
    const shown = !bar.hidden ? 1 : revealedAt === -1 || revealedAt > index ? 0 : revealedAt < index ? 1 : change
    const value = before + (after - before) * change

    return {
      label: bar.label,
      value,
      /** 0 to 1 of the full width. */
      length: Math.min(Math.max(value / top, 0), 1) * shown,
      shown,
      emphasis: !highlighted ? 'normal' : highlighted.has(bar.id) ? 'high' : 'low',
    } as const
  })
}

export function draw(ctx: Context2D, reel: ChartReel, f: Sizes, area: Area, playhead: Playhead) {
  const bars = barsAt(reel, playhead)
  const rowH = Math.min(area.h / bars.length, f.label * 4.2)
  const thickness = rowH * 0.56
  const top = area.y + (area.h - rowH * bars.length) / 2

  ctx.font = `600 ${f.label}px ${SANS}`
  const labelW = Math.min(Math.max(...bars.map((bar) => ctx.measureText(bar.label).width)), area.w * 0.34)
  ctx.font = `400 ${f.label}px ${SANS}`
  // Room for the widest value any bar shows, at the start or after a step changes it.
  const values = [...reel.bars.map((bar) => bar.value), ...reel.steps.flatMap((s) => Object.values(s.set ?? {}))]
  const valueW = Math.max(...values.map((value) => ctx.measureText(amount(reel, value)).width)) + f.label
  const trackX = area.x + labelW + f.label
  const trackW = area.w - labelW - f.label - valueW

  bars.forEach((bar, i) => {
    const y = top + rowH * i + rowH / 2
    const color = bar.emphasis === 'high' ? COLORS.request : COLORS.quiet

    // A bar not yet revealed leaves its row empty, track and all.
    ctx.globalAlpha = bar.shown
    ctx.fillStyle = COLORS.surface
    ctx.beginPath()
    ctx.roundRect(trackX, y - thickness / 2, trackW, thickness, 8)
    ctx.fill()

    ctx.globalAlpha = bar.shown * (bar.emphasis === 'low' ? 0.6 : 1)
    ctx.textAlign = 'right'
    ctx.fillStyle = bar.emphasis === 'low' ? COLORS.muted : COLORS.text
    ctx.font = `600 ${f.label}px ${SANS}`
    ctx.fillText(bar.label, trackX - f.label * 0.6, y)

    const width = Math.max(trackW * bar.length, bar.shown ? 6 : 0)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(trackX, y - thickness / 2, width, thickness, 8)
    ctx.fill()

    ctx.textAlign = 'left'
    ctx.fillStyle = bar.emphasis === 'high' ? COLORS.request : bar.emphasis === 'low' ? COLORS.muted : COLORS.text
    ctx.font = `400 ${f.label}px ${SANS}`
    ctx.fillText(amount(reel, bar.value), trackX + width + f.label * 0.5, y)
  })
  ctx.globalAlpha = 1
}

const TRACK = 40

export function text(reel: ChartReel, playhead: Playhead | null): TextCell[][] {
  const bars = barsAt(reel, playhead)
  const labelW = Math.min(Math.max(...bars.map((bar) => bar.label.length)), 24)
  const valueW = Math.max(...reel.bars.map((bar) => amount(reel, reel.max ?? bar.value).length))
  const grid = makeGrid(3 + labelW + 2 + TRACK + 1 + valueW + 2, bars.length * 2 + 1)

  bars.forEach((bar, i) => {
    if (!bar.shown) return
    const y = 1 + i * 2
    const color = bar.emphasis === 'high' ? TEXT_COLORS.request : TEXT_COLORS.quiet
    const label = bar.label.slice(0, labelW)
    grid.write(3 + labelW - label.length, y, label, { color: bar.emphasis === 'low' ? TEXT_COLORS.muted : TEXT_COLORS.text, bold: bar.emphasis === 'high' })
    const filled = Math.max(Math.round(TRACK * bar.length), 1)
    grid.write(3 + labelW + 2, y, '█'.repeat(filled), { color })
    grid.write(3 + labelW + 2 + filled + 1, y, amount(reel, bar.value), { color: bar.emphasis === 'high' ? TEXT_COLORS.request : TEXT_COLORS.muted })
  })
  return grid.cells
}

export function describe(reel: ChartReel, step: ChartStep) {
  const labelOf = (id: string) => reel.bars.find((bar) => bar.id === id)?.label ?? id
  const parts = [
    step.show?.length ? `+ ${step.show.map(labelOf).join(', ')}` : '',
    ...Object.entries(step.set ?? {}).map(([id, value]) => `${labelOf(id)} → ${amount(reel, value)}`),
    step.highlight?.length && !step.show?.length ? `◆ ${step.highlight.map(labelOf).join(', ')}` : '',
  ]
  return { text: parts.filter(Boolean).join('   '), style: 'request' as const }
}
