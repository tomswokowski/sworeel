// sketch: shapes placed freely, for anything the other kinds can't draw.
import { COLORS, drawIcon, fitLines, SANS, TINTS, type Area, type Assets, type Context2D, type Sizes } from '../canvas.ts'
import { makeGrid, TEXT_COLORS, type TextCell } from '../cells.ts'
import { ICONS } from '../data/icons.ts'
import type { Anchor, Shape, SketchReel, SketchStep } from '../reel.ts'
import type { Playhead } from '../timing.ts'
import { describeStage, stage } from './shared.ts'

const sizeOf = (reel: SketchReel) => reel.size ?? [100, 60]
const isLine = (shape: Shape) => shape.type === 'line' || shape.type === 'arrow'

/** Where every placed shape's centre is at this moment, after the moves so far. */
function centresAt(reel: SketchReel, index: number, change: number) {
  const at = new Map(reel.shapes.filter((shape) => !isLine(shape)).map((shape) => [shape.id, [shape.x ?? 0, shape.y ?? 0] as [number, number]]))
  reel.steps.slice(0, Math.max(index, 0)).forEach((step) => Object.entries(step.move ?? {}).forEach(([id, to]) => at.set(id, to)))
  for (const [id, to] of Object.entries(reel.steps[index]?.move ?? {})) {
    const from = at.get(id)!
    at.set(id, [from[0] + (to[0] - from[0]) * change, from[1] + (to[1] - from[1]) * change])
  }
  return at
}

/** How far a shape reaches from its centre, in the sketch's units, so lines can stop at its edge. */
function reach(shape: Shape): [number, number] {
  if (shape.type === 'box' || shape.type === 'ellipse') return [(shape.w ?? 0) / 2, (shape.h ?? 0) / 2]
  if (shape.type === 'icon') return [(shape.w ?? 8) / 2 + 1, (shape.w ?? 8) / 2 + 1]
  return [(shape.label?.length ?? 4) * 0.85, 2.2]
}

/** The point where a line from a shape's centre towards `target` leaves the shape. */
function edge(shape: Shape | undefined, centre: [number, number], target: [number, number]): [number, number] {
  if (!shape) return centre
  const [rx, ry] = reach(shape)
  const [dx, dy] = [target[0] - centre[0], target[1] - centre[1]]
  if (dx === 0 && dy === 0) return centre
  // For an ellipse, scale the direction onto the curve; for anything else, onto its rectangle.
  const scale = shape.type === 'ellipse' ? 1 / Math.hypot(dx / rx, dy / ry) : Math.min(rx / Math.abs(dx || 1e-9), ry / Math.abs(dy || 1e-9))
  return [centre[0] + dx * scale, centre[1] + dy * scale]
}

/**
 * The part of the drawing space the shapes ever occupy, as [left, top, right, bottom]. The
 * picture is fitted to this, not to the declared size, so a sketch drawn in one corner of its
 * space still fills the frame. It covers every position a shape moves to, so it never changes
 * while the reel plays.
 */
function boundsOf(reel: SketchReel): [number, number, number, number] {
  const byId = new Map(reel.shapes.map((shape) => [shape.id, shape]))
  const box = [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number]
  const take = (x: number, y: number, rx = 0, ry = 0) => {
    box[0] = Math.min(box[0], x - rx)
    box[1] = Math.min(box[1], y - ry)
    box[2] = Math.max(box[2], x + rx)
    box[3] = Math.max(box[3], y + ry)
  }
  for (const shape of reel.shapes) {
    if (isLine(shape)) {
      for (const end of [shape.from, shape.to]) if (Array.isArray(end)) take(end[0], end[1])
    } else {
      // A label under an icon needs room below it.
      const [rx, ry] = reach(shape)
      take(shape.x ?? 0, shape.y ?? 0, rx, shape.type === 'icon' && shape.label ? ry + 3 : ry)
    }
  }
  for (const step of reel.steps) {
    for (const [id, to] of Object.entries(step.move ?? {})) {
      const shape = byId.get(id)
      if (shape) take(to[0], to[1], ...reach(shape))
    }
  }
  const [w, h] = sizeOf(reel)
  if (box[0] === Infinity) return [0, 0, w, h]
  // A little air around it, and never a space so small that a single shape is blown up to fill the frame.
  const [padX, padY] = [Math.max(2, (w * 0.3 - (box[2] - box[0])) / 2), Math.max(2, (h * 0.3 - (box[3] - box[1])) / 2)]
  return [box[0] - padX, box[1] - padY, box[2] + padX, box[3] + padY]
}

function stateAt(reel: SketchReel, playhead: Playhead | null) {
  const staged = stage(reel.shapes, reel.steps, 'sketch', playhead)
  const centres = centresAt(reel, playhead?.index ?? reel.steps.length - 1, playhead ? staged.change : 1)
  const byId = new Map(reel.shapes.map((shape) => [shape.id, shape]))
  const ends = (line: Shape): [[number, number], [number, number]] => {
    const centre = (anchor: Anchor | undefined) => (typeof anchor === 'string' ? centres.get(anchor)! : (anchor ?? [0, 0]))
    const shape = (anchor: Anchor | undefined) => (typeof anchor === 'string' ? byId.get(anchor) : undefined)
    return [edge(shape(line.from), centre(line.from), centre(line.to)), edge(shape(line.to), centre(line.to), centre(line.from))]
  }
  return { ...staged, centres, ends }
}

export function draw(ctx: Context2D, reel: SketchReel, f: Sizes, area: Area, playhead: Playhead, assets: Assets = {}) {
  const { shown, emphasis, centres, ends } = stateAt(reel, playhead)
  const [left, top, right, bottom] = boundsOf(reel)
  const [w, h] = [right - left, bottom - top]
  // What the shapes occupy keeps its proportions and is centred in the area.
  const unit = Math.min(area.w / w, area.h / h)
  const px = (x: number) => area.x + (area.w - w * unit) / 2 + (x - left) * unit
  const py = (y: number) => area.y + (area.h - h * unit) / 2 + (y - top) * unit
  const type = Math.min(f.label * 1.5, unit * 3)

  const look = (shape: Shape) => {
    const level = emphasis(shape.id)
    ctx.globalAlpha = shown(shape.id) * (level === 'low' ? 0.35 : 1)
    return { color: shape.color ? TINTS[shape.color] : level === 'high' ? COLORS.request : null, isHigh: level === 'high' }
  }

  for (const shape of reel.shapes.filter(isLine)) {
    const { color, isHigh } = look(shape)
    const [[x1, y1], [x2, y2]] = ends(shape).map(([x, y]) => [px(x), py(y)]) as [[number, number], [number, number]]
    ctx.strokeStyle = color ?? COLORS.muted
    ctx.fillStyle = color ?? COLORS.muted
    ctx.lineWidth = isHigh ? 4.5 : 3
    ctx.setLineDash(shape.dashed ? [10, 8] : [])
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.setLineDash([])
    if (shape.type === 'arrow') {
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const head = type * 0.55
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45))
      ctx.lineTo(x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45))
      ctx.fill()
    }
    if (shape.label) {
      ctx.font = `400 ${type * 0.8}px ${SANS}`
      ctx.textAlign = 'center'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 8
      ctx.strokeStyle = COLORS.bg
      ctx.strokeText(shape.label, (x1 + x2) / 2, (y1 + y2) / 2 - type * 0.75)
      ctx.fillStyle = color ?? COLORS.text
      ctx.fillText(shape.label, (x1 + x2) / 2, (y1 + y2) / 2 - type * 0.75)
    }
  }

  for (const shape of reel.shapes.filter((candidate) => !isLine(candidate))) {
    const { color, isHigh } = look(shape)
    const [cx, cy] = centres.get(shape.id)!
    const [x, y] = [px(cx), py(cy)]
    ctx.textAlign = 'center'

    if (shape.type === 'box' || shape.type === 'ellipse') {
      const [bw, bh] = [(shape.w ?? 0) * unit, (shape.h ?? 0) * unit]
      ctx.fillStyle = COLORS.surface
      ctx.strokeStyle = color ?? COLORS.border
      ctx.lineWidth = isHigh ? 4.5 : 2.5
      ctx.beginPath()
      if (shape.type === 'box') {
        ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, Math.min(14, bh / 4))
      } else {
        // An ellipse is a circle drawn in a squashed space.
        ctx.save()
        ctx.translate(x, y)
        ctx.scale(bw / 2, bh / 2)
        ctx.arc(0, 0, 1, 0, Math.PI * 2)
        ctx.restore()
      }
      ctx.fill()
      ctx.stroke()
      if (shape.label) {
        ctx.fillStyle = COLORS.text
        ctx.font = `600 ${type}px ${SANS}`
        const lines = fitLines(ctx, shape.label, bw * 0.88)
        lines.forEach((line, n) => ctx.fillText(line, x, y + (n - (lines.length - 1) / 2) * type * 1.2))
      }
    } else if (shape.type === 'icon') {
      const size = (shape.w ?? 8) * unit
      drawIcon(ctx, assets, ICONS[shape.name ?? ''], x - size / 2, y - size / 2, size, color ?? COLORS.text)
      if (shape.label) {
        ctx.fillStyle = COLORS.text
        ctx.font = `400 ${type * 0.85}px ${SANS}`
        ctx.fillText(shape.label, x, y + size / 2 + type * 0.8)
      }
    } else {
      const scale = shape.size === 'large' ? 1.5 : shape.size === 'small' ? 0.75 : 1
      ctx.fillStyle = color ?? COLORS.text
      ctx.font = `${shape.size === 'large' ? 700 : 400} ${type * scale}px ${SANS}`
      ctx.fillText(shape.label ?? '', x, y)
    }
  }
  ctx.globalAlpha = 1
}

const COLS = 76

export function text(reel: SketchReel, playhead: Playhead | null): TextCell[][] {
  const { shown, emphasis, centres, ends } = stateAt(reel, playhead)
  const [w, h] = sizeOf(reel)
  // A character is about twice as tall as it is wide, so rows cover twice the distance.
  const rows = Math.max(Math.round((COLS * h) / w / 2.1), 8)
  const grid = makeGrid(COLS + 2, rows + 2)
  const col = (x: number) => 1 + Math.round(((COLS - 1) * x) / w)
  const row = (y: number) => 1 + Math.round(((rows - 1) * y) / h)
  const tint = (shape: Shape) => (emphasis(shape.id) === 'high' ? TEXT_COLORS.request : emphasis(shape.id) === 'low' ? TEXT_COLORS.line : TEXT_COLORS.muted)

  for (const shape of reel.shapes.filter(isLine)) {
    if (!shown(shape.id)) continue
    const [[x1, y1], [x2, y2]] = ends(shape).map(([x, y]) => [col(x), row(y)]) as [[number, number], [number, number]]
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1)
    const mark = y1 === y2 ? '─' : x1 === x2 ? '│' : '·'
    for (let i = 0; i <= steps; i++) grid.put(Math.round(x1 + ((x2 - x1) * i) / steps), Math.round(y1 + ((y2 - y1) * i) / steps), { ch: mark, color: tint(shape) })
    if (shape.type === 'arrow') {
      const head = Math.abs(x2 - x1) >= Math.abs(y2 - y1) * 2 ? (x2 > x1 ? '▶' : '◀') : y2 > y1 ? '▼' : '▲'
      grid.put(x2, y2, { ch: head, color: tint(shape) })
    }
    if (shape.label) grid.write(Math.round((x1 + x2) / 2) - Math.floor(shape.label.length / 2), Math.round((y1 + y2) / 2) - 1, shape.label, { color: tint(shape) })
  }

  for (const shape of reel.shapes.filter((candidate) => !isLine(candidate))) {
    if (!shown(shape.id)) continue
    const [cx, cy] = centres.get(shape.id)!
    const isHigh = emphasis(shape.id) === 'high'
    const words = { color: emphasis(shape.id) === 'low' ? TEXT_COLORS.muted : TEXT_COLORS.text, bold: isHigh }
    const label = shape.label ?? ''

    if (shape.type === 'box' || shape.type === 'ellipse') {
      const left = col(cx - (shape.w ?? 0) / 2)
      const right = Math.max(col(cx + (shape.w ?? 0) / 2), left + label.length + 3)
      const top = row(cy - (shape.h ?? 0) / 2)
      const bottom = Math.max(row(cy + (shape.h ?? 0) / 2), top + 2)
      const [tl, tr, bl, br] = shape.type === 'box' ? '┌┐└┘' : '╭╮╰╯'
      const border = { color: tint(shape) }
      for (let y = top; y <= bottom; y++) grid.write(left, y, ' '.repeat(right - left + 1))
      grid.write(left, top, `${tl}${'─'.repeat(right - left - 1)}${tr}`, border)
      grid.write(left, bottom, `${bl}${'─'.repeat(right - left - 1)}${br}`, border)
      for (let y = top + 1; y < bottom; y++) {
        grid.put(left, y, { ch: '│', ...border })
        grid.put(right, y, { ch: '│', ...border })
      }
      grid.write(left + Math.floor((right - left + 1 - label.length) / 2), Math.round((top + bottom) / 2), label, words)
    } else if (shape.type === 'icon') {
      grid.write(col(cx) - 1, row(cy), `◈ ${label || shape.name}`, words)
    } else {
      grid.write(col(cx) - Math.floor(label.length / 2), row(cy), label, words)
    }
  }
  return grid.cells
}

export function describe(reel: SketchReel, step: SketchStep) {
  const labelOf = (id: string) => reel.shapes.find((shape) => shape.id === id)?.label ?? id
  const moved = Object.keys(step.move ?? {}).length ? `→ ${Object.keys(step.move!).map(labelOf).join(', ')}` : ''
  return { text: [describeStage(step, labelOf), moved].filter(Boolean).join('   '), style: 'request' as const }
}
