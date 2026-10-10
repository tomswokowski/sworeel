// sequence: actors side by side, and the messages between them, top to bottom.
import { COLORS, drawIcon, MONO, SANS, type Area, type Assets, type Context2D, type Sizes } from '../canvas.ts'
import { ICONS } from '../data/icons.ts'
import { makeGrid, TEXT_COLORS, type TextCell } from '../cells.ts'
import type { SequenceReel, SequenceStep } from '../reel.ts'
import { movement, type Playhead } from '../timing.ts'

/** The steps that send a message, each with the row it is drawn on. */
function messagesOf(reel: SequenceReel) {
  let row = 0
  return reel.steps.flatMap((step, index) => (step.from && step.to ? [{ step, index, row: row++, from: step.from, to: step.to }] : []))
}

export function draw(ctx: Context2D, reel: SequenceReel, f: Sizes, area: Area, playhead: Playhead, assets: Assets = {}) {
  const messages = messagesOf(reel)
  const colW = area.w / reel.actors.length
  const boxW = Math.min(colW * 0.82, 280)
  const boxH = Math.min(f.label * 2.6, area.h * 0.16)
  const rowH = Math.min((area.h - boxH - f.label) / Math.max(messages.length, 1), f.label * 3.6)
  const x = (id: string) => area.x + colW * (reel.actors.findIndex((actor) => actor.id === id) + 0.5)
  const current = reel.steps[playhead.index]

  for (const actor of reel.actors) {
    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 2
    ctx.setLineDash([8, 8])
    ctx.beginPath()
    ctx.moveTo(x(actor.id), area.y + boxH)
    ctx.lineTo(x(actor.id), area.y + boxH + rowH * (messages.length + 0.4))
    ctx.stroke()
    ctx.setLineDash([])
  }

  for (const { step, index, row, from, to } of messages) {
    if (index > playhead.index) continue
    const isCurrent = index === playhead.index
    const progress = isCurrent ? movement(step, 'sequence', playhead.elapsed) : 1
    const color = COLORS[step.style ?? 'request']
    const y = area.y + boxH + rowH * (row + 0.8)
    const a = x(from)
    const head = f.edge * 0.55

    // Earlier messages stay on the page, quieter, so the whole exchange builds up.
    ctx.globalAlpha = isCurrent ? 1 : 0.65
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = isCurrent ? 4 : 3
    ctx.lineJoin = 'round'

    if (from === to) {
      // A note to self: out to the right, down, and back.
      const out = Math.min(colW * 0.22, 70)
      const drop = rowH * 0.34
      ctx.beginPath()
      ctx.moveTo(a, y - drop)
      ctx.lineTo(a + out, y - drop)
      ctx.lineTo(a + out, y)
      ctx.lineTo(a + head, y)
      ctx.stroke()
      if (step.label) {
        ctx.font = `400 ${f.edge}px ${MONO}`
        ctx.textAlign = 'left'
        ctx.fillText(step.label, a + out + 12, y - drop / 2)
      }
      continue
    }

    const direction = Math.sign(x(to) - a)
    const tip = a + (x(to) - a) * progress
    ctx.beginPath()
    ctx.moveTo(a, y)
    ctx.lineTo(tip, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(tip, y)
    ctx.lineTo(tip - direction * head * 1.6, y - head)
    ctx.lineTo(tip - direction * head * 1.6, y + head)
    ctx.fill()

    if (step.label) {
      // A label wider than the gap between its two actors shrinks to fit it.
      const room = Math.abs(x(to) - a) * 0.94
      ctx.font = `400 ${Math.max(Math.min(f.edge, room / (step.label.length * 0.6)), f.edge * 0.6)}px ${MONO}`
      ctx.textAlign = 'center'
      ctx.lineWidth = 8
      ctx.strokeStyle = COLORS.bg
      ctx.strokeText(step.label, (a + x(to)) / 2, y - f.edge * 0.95)
      ctx.fillText(step.label, (a + x(to)) / 2, y - f.edge * 0.95)
    }
  }
  ctx.globalAlpha = 1

  for (const actor of reel.actors) {
    const active = current?.from === actor.id || current?.to === actor.id
    ctx.fillStyle = COLORS.surface
    ctx.strokeStyle = active ? COLORS[current?.style ?? 'request'] : COLORS.border
    ctx.lineWidth = active ? 4 : 2.5
    ctx.beginPath()
    ctx.roundRect(x(actor.id) - boxW / 2, area.y, boxW, boxH, 14)
    ctx.fill()
    ctx.stroke()
    const iconSize = actor.icon && assets.makePath ? boxH * 0.5 : 0
    drawIcon(ctx, assets, ICONS[actor.icon ?? ''], x(actor.id) - boxW / 2 + boxH * 0.22, area.y + (boxH - iconSize) / 2, iconSize, COLORS.muted)
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.text
    ctx.font = `600 ${Math.min(f.label, ((boxW - iconSize * 1.3) * 0.9) / (actor.label.length * 0.58))}px ${SANS}`
    ctx.fillText(actor.label, x(actor.id) + iconSize * 0.6, area.y + boxH / 2)
  }
}

export function text(reel: SequenceReel, playhead: Playhead | null): TextCell[][] {
  const messages = messagesOf(reel).filter((message) => !playhead || message.index <= playhead.index)
  const longest = Math.max(...reel.actors.map((actor) => actor.label.length), ...messagesOf(reel).map((message) => (message.step.label?.length ?? 0) + 4))
  const colW = Math.min(Math.max(longest + 4, 16), 30)
  const x = (id: string) => 2 + Math.floor(colW / 2) + colW * reel.actors.findIndex((actor) => actor.id === id)
  const grid = makeGrid(4 + colW * reel.actors.length + 20, 3 + messages.length * 2)

  for (const actor of reel.actors) {
    grid.write(x(actor.id) - Math.floor(actor.label.length / 2), 0, actor.label, { color: TEXT_COLORS.text, bold: true })
    for (let y = 1; y < 3 + messages.length * 2; y++) grid.put(x(actor.id), y, { ch: '│', color: TEXT_COLORS.line })
  }

  messages.forEach(({ step, index, from, to }, n) => {
    const y = 2 + n * 2
    const isCurrent = playhead?.index === index
    const style = { color: isCurrent ? TEXT_COLORS[step.style ?? 'request'] : TEXT_COLORS.muted, bold: isCurrent }
    if (from === to) return grid.write(x(from) + 1, y, `⟲ ${step.label ?? ''}`, style)

    const [left, right] = x(from) < x(to) ? [x(from), x(to)] : [x(to), x(from)]
    for (let at = left + 1; at < right; at++) grid.put(at, y, { ch: isCurrent ? '━' : '─', ...style })
    if (x(from) < x(to)) grid.put(right - 1, y, { ch: '▶', ...style })
    else grid.put(left + 1, y, { ch: '◀', ...style })
    if (step.label) {
      const label = ` ${step.label} `.slice(0, right - left - 4)
      grid.write(left + Math.floor((right - left - label.length) / 2) + 1, y, label, style)
    }
  })
  return grid.cells
}

export function describe(reel: SequenceReel, step: SequenceStep) {
  const labelOf = (id: string) => reel.actors.find((actor) => actor.id === id)?.label ?? id
  const sent = step.from && step.to ? `${labelOf(step.from)} ${step.from === step.to ? '⟲' : `→ ${labelOf(step.to)}`}${step.label ? `  ${step.label}` : ''}` : ''
  return { text: sent, style: step.style ?? ('request' as const) }
}
