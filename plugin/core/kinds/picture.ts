// picture: an image, with parts of it picked out one at a time.
import { COLORS, SANS, TINTS, type Area, type Assets, type Context2D, type Sizes } from '../canvas.ts'
import { makeGrid, TEXT_COLORS, type TextCell } from '../cells.ts'
import type { Mark, PictureReel, PictureStep } from '../reel.ts'
import { movement, type Playhead } from '../timing.ts'

type Box = [number, number, number, number]
const WHOLE: Box = [0, 0, 1, 1]

/** Every image a reel uses, so a host can load them all before drawing. */
export function sourcesOf(reel: PictureReel) {
  return [...new Set([reel.src, ...reel.steps.map((step) => step.src)].filter((src): src is string => src !== undefined))]
}

/** The image showing at a step: the last one named at or before it. */
function sourceAt(reel: PictureReel, index: number) {
  let src = reel.src ?? reel.steps[0]?.src ?? ''
  for (const step of reel.steps.slice(0, Math.max(index + 1, 1))) src = step.src ?? src
  return src
}

/** What is showing at this moment: the image, the one it is replacing, and the part picked out. */
function stateAt(reel: PictureReel, playhead: Playhead | null) {
  const index = playhead?.index ?? reel.steps.length - 1
  const step = reel.steps[index]
  const change = playhead && step ? movement(step, 'picture', playhead.elapsed) : 1
  const src = sourceAt(reel, index)
  const before = index > 0 ? sourceAt(reel, index - 1) : src
  // On the same image the frame slides from the last part to this one; on a new image it starts from the whole.
  const from = (before === src && reel.steps[index - 1]?.focus) || WHOLE
  const to = step?.focus ?? WHOLE
  const box = from.map((value, i) => value + (to[i]! - value) * change) as Box
  return { step, change, src, before, box, isWhole: box[2] > 0.999 && box[3] > 0.999 }
}

export function draw(ctx: Context2D, reel: PictureReel, f: Sizes, area: Area, playhead: Playhead, assets: Assets = {}) {
  const { step, change, src, before, box, isWhole } = stateAt(reel, playhead)
  const picture = assets.images?.get(src)
  const previous = before !== src && change < 1 ? assets.images?.get(before) : undefined
  // The picture is as large as fits the area without changing its proportions.
  const ratio = picture ? picture.width / picture.height : 16 / 10
  const h = Math.min(area.h, area.w / ratio)
  const w = h * ratio
  const x = area.x + (area.w - w) / 2
  const y = area.y + (area.h - h) / 2

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 12)
  ctx.clip()
  if (picture) {
    // A change of image fades from the old one to the new.
    if (previous) ctx.drawImage(previous.image as never, x, y, w, h)
    ctx.globalAlpha = previous ? change : 1
    ctx.drawImage(picture.image as never, x, y, w, h)
    ctx.globalAlpha = 1
  } else {
    // Where pictures can't be loaded, say what would be here.
    ctx.fillStyle = COLORS.surface
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = COLORS.muted
    ctx.textAlign = 'center'
    ctx.font = `400 ${f.label}px ${SANS}`
    ctx.fillText(src, x + w / 2, y + h / 2)
  }

  const [fx, fy, fw, fh] = [x + box[0] * w, y + box[1] * h, box[2] * w, box[3] * h]
  if (!isWhole) {
    // Everything outside the part picked out is dimmed.
    ctx.fillStyle = COLORS.bg
    ctx.globalAlpha = 0.68
    ctx.fillRect(x, y, w, fy - y)
    ctx.fillRect(x, fy + fh, w, y + h - fy - fh)
    ctx.fillRect(x, fy, fx - x, fh)
    ctx.fillRect(fx + fw, fy, x + w - fx - fw, fh)
    ctx.globalAlpha = 1
  }
  ctx.restore()

  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 12)
  ctx.stroke()

  if (!isWhole) {
    ctx.strokeStyle = COLORS.request
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.roundRect(fx, fy, fw, fh, 8)
    ctx.stroke()
    if (step?.label) {
      // The label sits just above the part, or just below when there is no room above.
      const above = fy - y > f.label * 2
      ctx.font = `600 ${f.label * 0.9}px ${SANS}`
      ctx.textAlign = 'center'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 8
      ctx.strokeStyle = COLORS.bg
      ctx.strokeText(step.label, fx + fw / 2, above ? fy - f.label * 0.9 : fy + fh + f.label * 0.9)
      ctx.fillStyle = COLORS.request
      ctx.fillText(step.label, fx + fw / 2, above ? fy - f.label * 0.9 : fy + fh + f.label * 0.9)
    }
  }

  if (step?.marks?.length) drawMarks(ctx, step.marks, f, x, y, w, h, change)
}

/** Where an arrow starts when the reel doesn't say: a short way off, towards the middle of the picture, where there is room. */
function tailOf(mark: Mark): [number, number] {
  if (mark.from) return mark.from
  const [x, y] = mark.at!
  const [dx, dy] = [0.5 - x, 0.5 - y]
  const length = Math.hypot(dx, dy) || 1
  // From dead centre there is no "towards the middle", so come in from the upper left.
  return length < 0.05 ? [x - 0.1, y - 0.1] : [x + (dx / length) * 0.13, y + (dy / length) * 0.13]
}

/** Draws a step's marks over the picture, which occupies `x`, `y`, `w`, `h`. */
function drawMarks(ctx: Context2D, marks: Mark[], f: Sizes, x: number, y: number, w: number, h: number, strength: number) {
  const at = ([px, py]: [number, number]) => [x + px * w, y + py * h] as const
  /** Words edged in the background colour, so they read over any picture. Kept inside the frame. */
  const write = (words: string, wx: number, wy: number, color: string, align: string) => {
    ctx.font = `600 ${f.label * 0.9}px ${SANS}`
    // Where the words would start and end; if that runs off an edge, they slide back in.
    const width = ctx.measureText(words).width
    const start = align === 'left' ? wx : align === 'right' ? wx - width : wx - width / 2
    const margin = f.label * 0.6
    wx += Math.max(margin - start, 0) - Math.max(start + width - (f.w - margin), 0)
    ctx.textAlign = align
    ctx.lineJoin = 'round'
    ctx.lineWidth = 8
    ctx.strokeStyle = COLORS.bg
    ctx.strokeText(words, wx, wy)
    ctx.fillStyle = color
    ctx.fillText(words, wx, wy)
  }
  /** A line or outline drawn twice: wide in the background colour underneath, so it stands off the picture. */
  const outlined = (color: string, width: number, path: () => void) => {
    for (const [stroke, size] of [[COLORS.bg, width + 5], [color, width]] as const) {
      ctx.strokeStyle = stroke
      ctx.lineWidth = size
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      path()
      ctx.stroke()
    }
  }

  ctx.globalAlpha = strength
  for (const mark of marks) {
    const color = mark.color ? TINTS[mark.color] : TINTS.amber
    if (mark.type === 'box' && mark.area) {
      const [bx, by] = at([mark.area[0], mark.area[1]])
      outlined(color, 4, () => ctx.roundRect(bx, by, mark.area![2] * w, mark.area![3] * h, 8))
      if (mark.label) write(mark.label, bx + (mark.area[2] * w) / 2, by - f.label * 0.8, color, 'center')
      continue
    }
    if (!mark.at) continue
    const [px, py] = at(mark.at)

    if (mark.type === 'circle') {
      const radius = ((mark.size ?? 0.08) * w) / 2
      outlined(color, 4, () => ctx.arc(px, py, radius, 0, Math.PI * 2))
      if (mark.label) write(mark.label, px, py - radius - f.label * 0.7, color, 'center')
    } else if (mark.type === 'note') {
      write(mark.label ?? '', px, py, color, 'center')
    } else {
      // The arrow grows from its tail to its point as the step begins.
      const [tx, ty] = at(tailOf(mark))
      const [hx, hy] = [tx + (px - tx) * strength, ty + (py - ty) * strength]
      const angle = Math.atan2(py - ty, px - tx)
      const head = f.label * 0.75
      outlined(color, 5, () => {
        ctx.moveTo(tx, ty)
        ctx.lineTo(hx, hy)
        ctx.moveTo(hx - head * Math.cos(angle - 0.5), hy - head * Math.sin(angle - 0.5))
        ctx.lineTo(hx, hy)
        ctx.lineTo(hx - head * Math.cos(angle + 0.5), hy - head * Math.sin(angle + 0.5))
      })
      // The words sit beyond the tail, on the far side from the point.
      if (mark.label) {
        const pointsRight = Math.cos(angle) > 0.3
        const pointsLeft = Math.cos(angle) < -0.3
        write(mark.label, tx - Math.cos(angle) * f.label * 0.5, ty - Math.sin(angle) * f.label * 0.9, color, pointsRight ? 'right' : pointsLeft ? 'left' : 'center')
      }
    }
  }
  ctx.globalAlpha = 1
  ctx.lineCap = 'butt'
}

const COLS = 60
const ROWS = 14

export function text(reel: PictureReel, playhead: Playhead | null): TextCell[][] {
  const { step, src, box, isWhole } = stateAt(reel, playhead)
  const grid = makeGrid(COLS + 6, ROWS + 3)
  const frame = { color: TEXT_COLORS.line }
  // The image's name goes in the frame's top edge, where no focus box can cover it.
  const name = ` picture: ${src.split(/[\\/]/).pop()} `.slice(0, COLS - 2)
  grid.write(2, 1, `┌─${name}${'─'.repeat(COLS - 1 - name.length)}┐`, frame)
  grid.write(4, 1, name, { color: TEXT_COLORS.muted })
  grid.write(2, ROWS + 2, `└${'─'.repeat(COLS)}┘`, frame)
  for (let y = 2; y < ROWS + 2; y++) {
    grid.put(2, y, { ch: '│', ...frame })
    grid.put(COLS + 3, y, { ch: '│', ...frame })
  }

  if (!isWhole) {
    // A box where the part picked out is, in the picture's proportions.
    const left = 3 + Math.round(box[0] * (COLS - 1))
    const right = Math.max(3 + Math.round((box[0] + box[2]) * (COLS - 1)), left + 2)
    const top = 2 + Math.round(box[1] * (ROWS - 1))
    const bottom = Math.max(2 + Math.round((box[1] + box[3]) * (ROWS - 1)), top + 1)
    const focus = { color: TEXT_COLORS.request, bold: true }
    grid.write(left, top, `┏${'━'.repeat(right - left - 1)}┓`, focus)
    grid.write(left, bottom, `┗${'━'.repeat(right - left - 1)}┛`, focus)
    for (let y = top + 1; y < bottom; y++) {
      grid.put(left, y, { ch: '┃', ...focus })
      grid.put(right, y, { ch: '┃', ...focus })
    }
    if (step?.label) grid.write(Math.min(left + 2, COLS - step.label.length), Math.min(top + 1, bottom), step.label.slice(0, COLS - 4), focus)
  }

  // Marks become a symbol where they point, with their words beside it.
  const SYMBOLS = { arrow: '➤', circle: '◯', note: '', box: '▢' }
  for (const mark of step?.marks ?? []) {
    const [mx, my] = mark.at ?? [mark.area![0] + mark.area![2] / 2, mark.area![1] + mark.area![3] / 2]
    const words = `${SYMBOLS[mark.type]} ${mark.label ?? ''}`.trim()
    const col = 3 + Math.round(mx * (COLS - 1))
    grid.write(Math.min(col, COLS + 2 - words.length), 2 + Math.round(my * (ROWS - 1)), words, { color: TEXT_COLORS.reply, bold: true })
  }
  return grid.cells
}

export function describe(_reel: PictureReel, step: PictureStep) {
  const marked = (step.marks ?? []).flatMap((mark) => (mark.label ? [mark.label] : []))
  const parts = [step.src ? `→ ${step.src.split(/[\\/]/).pop()}` : '', step.label ?? (step.focus ? 'a closer look' : ''), ...marked]
  return { text: parts.filter(Boolean).join('   '), style: 'request' as const }
}
