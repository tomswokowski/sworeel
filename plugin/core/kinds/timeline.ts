// timeline: events in order along a line. They are evenly spaced, not placed to scale.
import { COLORS, fitLines, MONO, SANS, type Area, type Context2D, type Sizes } from '../canvas.ts'
import { makeGrid, TEXT_COLORS, type TextCell } from '../cells.ts'
import type { TimelineReel, TimelineStep } from '../reel.ts'
import type { Playhead } from '../timing.ts'
import { describeStage, stage, wrapChars } from './shared.ts'

export function draw(ctx: Context2D, reel: TimelineReel, f: Sizes, area: Area, playhead: Playhead) {
  const { shown, emphasis } = stage(reel.events, reel.steps, 'timeline', playhead)
  const count = reel.events.length
  // A wide frame runs the line across with labels above and below; a tall one runs it down.
  const across = area.w / area.h > 1.3
  const slot = (across ? area.w : area.h) / count
  const axis = across ? area.y + area.h / 2 : area.x + area.w * 0.3
  const along = (i: number) => (across ? area.x : area.y) + slot * (i + 0.5)

  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 3
  ctx.beginPath()
  if (across) {
    ctx.moveTo(area.x, axis)
    ctx.lineTo(area.x + area.w, axis)
  } else {
    ctx.moveTo(axis, area.y)
    ctx.lineTo(axis, area.y + area.h)
  }
  ctx.stroke()

  reel.events.forEach((event, i) => {
    const level = emphasis(event.id)
    const color = level === 'high' ? COLORS.request : COLORS.quiet
    const radius = f.edge * (level === 'high' ? 0.75 : 0.55)
    const lineH = f.sub * 1.5
    ctx.globalAlpha = shown(event.id) * (level === 'low' ? 0.5 : 1)

    const [x, y] = across ? [along(i), axis] : [axis, along(i)]
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()

    if (across) {
      // Alternate sides so neighbouring labels have room.
      const side = i % 2 === 0 ? -1 : 1
      ctx.textAlign = 'center'
      ctx.font = `400 ${f.sub * 1.3}px ${SANS}`
      const lines = fitLines(ctx, event.label, slot * 1.5).slice(0, 4)
      // The first and last events sit near the edges; their words slide inwards to stay in the frame.
      const half = Math.max(...lines.map((line) => ctx.measureText(line).width)) / 2
      const margin = f.sub
      const centre = Math.min(Math.max(x, margin + half), f.w - margin - half)
      ctx.fillStyle = COLORS.text
      lines.forEach((line, n) => {
        const step = side < 0 ? lines.length - 1 - n : n
        ctx.fillText(line, centre, y + side * (f.label * 3.4 + step * lineH * 1.15))
      })
      ctx.font = `600 ${f.label * 1.15}px ${MONO}`
      ctx.fillStyle = color
      ctx.fillText(event.when, x, y + side * f.label * 1.9)
    } else {
      ctx.textAlign = 'right'
      ctx.font = `600 ${f.label * 0.9}px ${MONO}`
      ctx.fillStyle = color
      ctx.fillText(event.when, x - f.label, y)
      ctx.textAlign = 'left'
      ctx.font = `400 ${f.label * 0.9}px ${SANS}`
      ctx.fillStyle = COLORS.text
      const lines = fitLines(ctx, event.label, area.x + area.w - x - f.label * 1.2).slice(0, 3)
      lines.forEach((line, n) => ctx.fillText(line, x + f.label, y + (n - (lines.length - 1) / 2) * f.label * 1.25))
    }
  })
  ctx.globalAlpha = 1
}

export function text(reel: TimelineReel, playhead: Playhead | null): TextCell[][] {
  const { shown, emphasis } = stage(reel.events, reel.steps, 'timeline', playhead)
  const events = reel.events.filter((event) => shown(event.id) > 0)
  const whenW = Math.max(...reel.events.map((event) => event.when.length))
  const blocks = events.map((event) => ({ event, lines: wrapChars(event.label, 48) }))
  const grid = makeGrid(3 + whenW + 4 + 50, blocks.reduce((rows, block) => rows + block.lines.length + 1, 1))

  let y = 1
  for (const { event, lines } of blocks) {
    const level = emphasis(event.id)
    const color = level === 'high' ? TEXT_COLORS.request : level === 'low' ? TEXT_COLORS.line : TEXT_COLORS.quiet
    grid.write(3 + whenW - event.when.length, y, event.when, { color, bold: level === 'high' })
    grid.write(3 + whenW + 1, y, level === 'high' ? '◆─' : '●─', { color })
    lines.forEach((line, n) => {
      if (n > 0) grid.put(3 + whenW + 1, y + n, { ch: '│', color: TEXT_COLORS.line })
      grid.write(3 + whenW + 4, y + n, line, { color: level === 'low' ? TEXT_COLORS.muted : TEXT_COLORS.text, bold: level === 'high' })
    })
    y += lines.length
    if (event !== events.at(-1)) grid.put(3 + whenW + 1, y, { ch: '│', color: TEXT_COLORS.line })
    y += 1
  }
  return grid.cells
}

export function describe(reel: TimelineReel, step: TimelineStep) {
  return { text: describeStage(step, (id) => reel.events.find((event) => event.id === id)?.when ?? id), style: 'request' as const }
}
