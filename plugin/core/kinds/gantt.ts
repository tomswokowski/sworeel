// gantt: tasks as bars along a shared scale, showing when each starts and ends.
import { COLORS, formatNumber, MONO, SANS, type Area, type Context2D, type Sizes } from '../canvas.ts'
import { makeGrid, TEXT_COLORS, type TextCell } from '../cells.ts'
import type { GanttReel, GanttStep } from '../reel.ts'
import type { Playhead } from '../timing.ts'
import { describeStage, stage } from './shared.ts'


/** The scale the bars sit on: its ends, and where to put tick marks. */
function scaleOf(reel: GanttReel) {
  const from = Math.min(...reel.tasks.map((task) => task.start))
  const to = Math.max(...reel.tasks.map((task) => task.end))
  const rough = (to - from) / 6
  const power = 10 ** Math.floor(Math.log10(rough))
  const every = [1, 2, 5, 10].map((m) => m * power).find((size) => size >= rough)!
  const ticks: number[] = []
  for (let tick = Math.ceil(from / every) * every; tick <= to + 1e-9; tick += every) ticks.push(Math.round(tick * 1e6) / 1e6)
  return { from, to, ticks }
}

export function draw(ctx: Context2D, reel: GanttReel, f: Sizes, area: Area, playhead: Playhead) {
  const { step, shown, emphasis } = stage(reel.tasks, reel.steps, 'gantt', playhead)
  const { from, to, ticks } = scaleOf(reel)

  ctx.font = `600 ${f.label * 0.9}px ${SANS}`
  // Labels get up to a third of the width; longer ones are set smaller so none runs off the edge.
  const widest = Math.max(...reel.tasks.map((task) => ctx.measureText(task.label).width))
  const labelW = Math.min(widest, area.w * 0.34)
  const labelSize = f.label * 0.9 * Math.max(labelW / widest, 0.6)
  const left = area.x + labelW + f.label
  const right = area.x + area.w - f.sub
  const axisH = f.sub * 2.6
  const rowH = Math.min((area.h - axisH) / reel.tasks.length, f.label * 3.4)
  const top = area.y + (area.h - axisH - rowH * reel.tasks.length) / 2
  const bottom = top + rowH * reel.tasks.length
  const x = (value: number) => left + ((right - left) * (value - from)) / (to - from)

  ctx.font = `400 ${f.sub}px ${MONO}`
  ctx.textAlign = 'center'
  for (const tick of ticks) {
    ctx.strokeStyle = COLORS.border
    ctx.globalAlpha = 0.55
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x(tick), top)
    ctx.lineTo(x(tick), bottom)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = COLORS.muted
    ctx.fillText(formatNumber(tick), x(tick), bottom + f.sub * 1.3)
  }
  if (reel.unit) {
    ctx.textAlign = 'right'
    ctx.fillText(reel.unit, left - f.label * 0.6, bottom + f.sub * 1.3)
  }

  reel.tasks.forEach((task, i) => {
    const y = top + rowH * (i + 0.5)
    const level = emphasis(task.id)
    ctx.globalAlpha = shown(task.id) * (level === 'low' ? 0.45 : 1)
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.text
    ctx.font = `600 ${labelSize}px ${SANS}`
    ctx.fillText(task.label, left - f.label * 0.6, y)
    // A bar being revealed grows from its start towards its end.
    ctx.fillStyle = level === 'high' ? COLORS.request : COLORS.quiet
    ctx.beginPath()
    ctx.roundRect(x(task.start), y - rowH * 0.3, Math.max((x(task.end) - x(task.start)) * shown(task.id), 4), rowH * 0.6, 8)
    ctx.fill()
  })
  ctx.globalAlpha = 1

  if (step?.now !== undefined) {
    ctx.strokeStyle = COLORS.reply
    ctx.lineWidth = 3
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(x(step.now), top - f.sub)
    ctx.lineTo(x(step.now), bottom)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

const TRACK = 44

export function text(reel: GanttReel, playhead: Playhead | null): TextCell[][] {
  const { step, shown, emphasis } = stage(reel.tasks, reel.steps, 'gantt', playhead)
  const { from, to } = scaleOf(reel)
  const labelW = Math.min(Math.max(...reel.tasks.map((task) => task.label.length)), 24)
  const start = 3 + labelW + 2
  const at = (value: number) => Math.round((TRACK * (value - from)) / (to - from))
  const grid = makeGrid(start + TRACK + 12, reel.tasks.length + 3)

  reel.tasks.forEach((task, i) => {
    if (!shown(task.id)) return
    const level = emphasis(task.id)
    const label = task.label.slice(0, labelW)
    grid.write(3 + labelW - label.length, i + 1, label, { color: level === 'low' ? TEXT_COLORS.muted : TEXT_COLORS.text, bold: level === 'high' })
    grid.write(start, i + 1, '·'.repeat(TRACK), { color: TEXT_COLORS.line })
    grid.write(start + at(task.start), i + 1, '█'.repeat(Math.max(at(task.end) - at(task.start), 1)), { color: level === 'high' ? TEXT_COLORS.request : TEXT_COLORS.quiet })
  })

  const axis = reel.tasks.length + 1
  const end = `${formatNumber(to)}${reel.unit ? ` ${reel.unit}` : ''}`
  grid.write(start, axis, formatNumber(from), { color: TEXT_COLORS.muted })
  grid.write(start + TRACK - end.length, axis, end, { color: TEXT_COLORS.muted })
  if (step?.now !== undefined) {
    // The marker runs through the gaps, and leaves the bars whole.
    for (let y = 1; y < axis; y++) {
      if (grid.cells[y]?.[start + at(step.now)]?.ch !== '█') grid.put(start + at(step.now), y, { ch: '┊', color: TEXT_COLORS.reply })
    }
    grid.write(start + at(step.now), axis + 1, `▲ ${formatNumber(step.now)}`, { color: TEXT_COLORS.reply })
  }
  return grid.cells
}

export function describe(reel: GanttReel, step: GanttStep) {
  const staged = describeStage(step, (id) => reel.tasks.find((task) => task.id === id)?.label ?? id)
  const now = step.now !== undefined ? `at ${formatNumber(step.now)}${reel.unit ? ` ${reel.unit}` : ''}` : ''
  return { text: [staged, now].filter(Boolean).join('   '), style: 'request' as const }
}
