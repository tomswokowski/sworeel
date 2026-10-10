// screen: a wireframe of a page or app screen, inside a browser or phone frame.
import { COLORS, drawIcon, fitLines, MONO, SANS, type Area, type Assets, type Context2D, type Sizes } from '../canvas.ts'
import { makeGrid, TEXT_COLORS, type TextCell } from '../cells.ts'
import { ICONS } from '../data/icons.ts'
import type { ScreenElement, ScreenReel, ScreenStep } from '../reel.ts'
import type { Playhead } from '../timing.ts'
import { describeStage, stage, wrapChars } from './shared.ts'

// Everything is laid out in units: the content is this many units wide, and each kind of
// element has a height in the same units, so one layout scales to any frame.
const WIDTH = { browser: 38, phone: 21 }
const GAP = 1

/** Every element that can be named by a step, wherever it is nested. */
const named = (elements: ScreenElement[]): (ScreenElement & { id: string })[] =>
  elements.flatMap((element) => [...(element.id ? [element as ScreenElement & { id: string }] : []), ...named(element.children ?? [])])

/** The elements as they stand once the steps so far have changed their words and values. */
function current(reel: ScreenReel, index: number): ScreenElement[] {
  const changes = new Map<string, object>()
  for (const step of reel.steps.slice(0, index + 1)) {
    for (const [id, change] of Object.entries(step.set ?? {})) changes.set(id, { ...changes.get(id), ...change })
  }
  const apply = (element: ScreenElement): ScreenElement => ({
    ...element,
    ...(element.id ? changes.get(element.id) : {}),
    children: element.children?.map(apply),
  })
  return reel.elements.map(apply)
}

function stateAt(reel: ScreenReel, playhead: Playhead | null) {
  return { ...stage(named(reel.elements), reel.steps, 'screen', playhead), elements: current(reel, playhead?.index ?? reel.steps.length - 1) }
}

/** `row` is the id of the row an element sits in, whose showing and emphasis it shares. */
type Placed = { element: ScreenElement; x: number; y: number; w: number; h: number; lines?: string[]; row?: string }

/** Lays the elements out top to bottom in units. `wrap` breaks a paragraph to a width in units. */
function arrange(elements: ScreenElement[], x: number, y: number, w: number, wrap: (text: string, units: number) => string[], row?: string): { placed: Placed[]; bottom: number } {
  const placed: Placed[] = []
  for (const element of elements) {
    if (element.type === 'row') {
      const children = element.children ?? []
      const each = (w - GAP * (children.length - 1)) / children.length
      const columns = children.map((child, i) => arrange([child], x + i * (each + GAP), y, each, wrap, element.id ?? row))
      const bottom = Math.max(...columns.map((column) => column.bottom))
      placed.push({ element, x, y, w, h: bottom - y - GAP, row }, ...columns.flatMap((column) => column.placed))
      y = bottom
      continue
    }
    const lines = element.type === 'text' && element.text ? wrap(element.text, w) : undefined
    const h = {
      nav: 3,
      heading: 3,
      text: (lines?.length ?? element.lines ?? 2) * 1.6,
      image: element.size === 'tall' ? 13 : 7,
      input: element.label ? 5 : 3.2,
      button: 3.2,
      list: (element.items?.length ?? 0) * 2.4,
      notice: 3.2,
      gap: 1,
    }[element.type]
    placed.push({ element, x, y, w, h, lines, row })
    y += h + GAP
  }
  return { placed, bottom: y }
}

export function draw(ctx: Context2D, reel: ScreenReel, f: Sizes, area: Area, playhead: Playhead, assets: Assets = {}) {
  const { shown, emphasis, elements } = stateAt(reel, playhead)
  const device = reel.device ?? 'browser'

  // The frame: as large as fits the area at the device's proportions.
  const ratio = device === 'phone' ? 0.52 : 1.5
  const frameH = Math.min(area.h, area.w / ratio)
  const frameW = frameH * ratio
  const fx = area.x + (area.w - frameW) / 2
  const fy = area.y + (area.h - frameH) / 2
  const bar = device === 'phone' ? frameH * 0.045 : Math.max(frameH * 0.075, f.sub * 2)

  ctx.fillStyle = COLORS.surface
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(fx, fy, frameW, frameH, device === 'phone' ? frameW * 0.1 : 16)
  ctx.fill()
  ctx.stroke()

  if (device === 'phone') {
    ctx.fillStyle = COLORS.border
    ctx.beginPath()
    ctx.roundRect(fx + frameW * 0.36, fy + bar * 0.35, frameW * 0.28, bar * 0.36, bar * 0.18)
    ctx.fill()
  } else {
    for (let dot = 0; dot < 3; dot++) {
      ctx.fillStyle = COLORS.border
      ctx.beginPath()
      ctx.arc(fx + bar * (0.5 + dot * 0.42), fy + bar / 2, bar * 0.13, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = COLORS.bg
    ctx.beginPath()
    ctx.roundRect(fx + bar * 2, fy + bar * 0.2, frameW - bar * 2.6, bar * 0.6, bar * 0.3)
    ctx.fill()
    ctx.fillStyle = COLORS.muted
    ctx.textAlign = 'left'
    ctx.font = `400 ${bar * 0.34}px ${MONO}`
    ctx.fillText(reel.address ?? '', fx + bar * 2.4, fy + bar / 2)
    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(fx, fy + bar)
    ctx.lineTo(fx + frameW, fy + bar)
    ctx.stroke()
  }

  // Lay out at full width first; if the content is too tall for the frame, shrink the unit.
  const inset = frameW * 0.05
  const room = { w: frameW - inset * 2, h: frameH - bar - inset * 1.6 }
  let unit = room.w / WIDTH[device]
  const wrapAt = (size: number) => (words: string, units: number) => {
    ctx.font = `400 ${size * 1.15}px ${SANS}`
    return fitLines(ctx, words, units * size)
  }
  let laid = arrange(elements, 0, 0, WIDTH[device], wrapAt(unit))
  if ((laid.bottom - GAP) * unit > room.h) {
    unit = room.h / (laid.bottom - GAP)
    laid = arrange(elements, 0, 0, WIDTH[device], wrapAt(unit))
  }
  const left = fx + (frameW - WIDTH[device] * unit) / 2
  const top = fy + bar + inset * 0.8
  const anyHigh = named(reel.elements).some((element) => emphasis(element.id) === 'high')

  for (const { element, lines, row, ...box } of laid.placed) {
    const [x, y, w, h] = [left + box.x * unit, top + box.y * unit, box.w * unit, box.h * unit]
    // What is in a row appears with the row, and is picked out when the row is.
    const inHighRow = row !== undefined && emphasis(row) === 'high'
    const level = inHighRow ? 'high' : element.id ? emphasis(element.id) : 'normal'
    const visible = (element.id ? shown(element.id) : 1) * (row !== undefined ? shown(row) : 1)
    // With something picked out, everything else steps back, including elements with no id.
    ctx.globalAlpha = visible * (level === 'high' || !anyHigh ? 1 : 0.4)
    ctx.textAlign = 'left'
    const middle = y + h / 2

    switch (element.type) {
      case 'nav': {
        ctx.fillStyle = COLORS.text
        ctx.font = `700 ${unit * 1.4}px ${SANS}`
        ctx.fillText(element.text ?? '', x, middle)
        ctx.font = `400 ${unit * 1.1}px ${SANS}`
        ctx.textAlign = 'right'
        ctx.fillStyle = COLORS.muted
        let at = x + w
        for (const item of [...(element.items ?? [])].reverse()) {
          ctx.fillText(item, at, middle)
          at -= ctx.measureText(item).width + unit * 1.6
        }
        ctx.strokeStyle = COLORS.border
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, y + h)
        ctx.lineTo(x + w, y + h)
        ctx.stroke()
        break
      }
      case 'heading':
        ctx.fillStyle = COLORS.text
        ctx.font = `700 ${unit * 1.9}px ${SANS}`
        ctx.fillText(element.text ?? '', x, middle)
        break
      case 'text':
        if (lines) {
          ctx.fillStyle = COLORS.muted
          ctx.font = `400 ${unit * 1.15}px ${SANS}`
          lines.forEach((line, n) => ctx.fillText(line, x, y + unit * 1.6 * (n + 0.5)))
        } else {
          // No words given: grey bars stand in for a paragraph.
          const count = element.lines ?? 2
          for (let n = 0; n < count; n++) {
            ctx.fillStyle = COLORS.border
            ctx.beginPath()
            ctx.roundRect(x, y + unit * 1.6 * n + unit * 0.45, w * (n === count - 1 ? 0.6 : n % 2 ? 0.92 : 1), unit * 0.7, unit * 0.35)
            ctx.fill()
          }
        }
        break
      case 'image':
        ctx.fillStyle = COLORS.bg
        ctx.strokeStyle = COLORS.border
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, unit * 0.5)
        ctx.fill()
        ctx.stroke()
        drawIcon(ctx, assets, ICONS.image, x + w / 2 - unit * 1.5, middle - unit * 1.5, unit * 3, COLORS.border)
        break
      case 'input': {
        const boxH = unit * 3.2
        if (element.label) {
          ctx.fillStyle = COLORS.muted
          ctx.font = `400 ${unit * 1.05}px ${SANS}`
          ctx.fillText(element.label, x, y + unit * 0.8)
        }
        ctx.fillStyle = COLORS.bg
        ctx.strokeStyle = level === 'high' ? COLORS.request : COLORS.border
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(x, y + h - boxH, w, boxH, unit * 0.5)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = COLORS.text
        ctx.font = `400 ${unit * 1.2}px ${SANS}`
        ctx.fillText(element.value ?? '', x + unit, y + h - boxH / 2)
        break
      }
      case 'button': {
        ctx.font = `600 ${unit * 1.2}px ${SANS}`
        const primary = element.style === 'primary'
        ctx.fillStyle = primary ? COLORS.request : COLORS.bg
        ctx.strokeStyle = primary ? COLORS.request : COLORS.border
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, unit * 0.6)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = primary ? COLORS.bg : COLORS.text
        ctx.textAlign = 'center'
        ctx.fillText(element.text ?? '', x + w / 2, middle)
        break
      }
      case 'list':
        ctx.font = `400 ${unit * 1.15}px ${SANS}`
        ;(element.items ?? []).forEach((item, n) => {
          const rowY = y + unit * 2.4 * n
          ctx.fillStyle = COLORS.text
          ctx.fillText(item, x, rowY + unit * 1.2)
          ctx.strokeStyle = COLORS.border
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(x, rowY + unit * 2.4)
          ctx.lineTo(x + w, rowY + unit * 2.4)
          ctx.stroke()
        })
        break
      case 'notice': {
        const color = element.style === 'error' ? COLORS.error : COLORS.request
        ctx.fillStyle = COLORS.bg
        ctx.beginPath()
        ctx.roundRect(x, y, w, h, unit * 0.4)
        ctx.fill()
        ctx.fillStyle = color
        ctx.fillRect(x, y, unit * 0.4, h)
        ctx.font = `400 ${unit * 1.15}px ${SANS}`
        ctx.fillText(element.text ?? '', x + unit * 1.2, middle)
        break
      }
    }

    if (level === 'high') {
      ctx.globalAlpha = 1
      ctx.strokeStyle = COLORS.request
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.roundRect(x - unit * 0.6, y - unit * 0.5, w + unit * 1.2, h + unit, unit * 0.7)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

const INNER = 56

export function text(reel: ScreenReel, playhead: Playhead | null): TextCell[][] {
  const { shown, emphasis, elements } = stateAt(reel, playhead)
  const rows: { text: string; color: string; bold?: boolean; mark?: boolean }[] = []
  const add = (line: string, element: ScreenElement, color: string = TEXT_COLORS.text, bold = false) => {
    const isHigh = element.id !== undefined && emphasis(element.id) === 'high'
    rows.push({ text: line, color: isHigh ? TEXT_COLORS.request : color, bold: bold || isHigh, mark: isHigh })
  }
  /** One element as lines of text, `width` characters wide. */
  const render = (element: ScreenElement, width: number): void => {
    if (element.id && !shown(element.id)) return
    switch (element.type) {
      case 'nav': {
        const items = (element.items ?? []).join('  ')
        add(`${element.text ?? ''}${' '.repeat(Math.max(width - (element.text ?? '').length - items.length, 2))}${items}`, element, TEXT_COLORS.text, true)
        add('─'.repeat(width), element, TEXT_COLORS.line)
        break
      }
      case 'heading':
        add((element.text ?? '').toUpperCase(), element, TEXT_COLORS.text, true)
        break
      case 'text':
        for (const line of element.text ? wrapChars(element.text, width) : Array.from({ length: element.lines ?? 2 }, () => '▁'.repeat(width - 6))) add(line, element, TEXT_COLORS.muted)
        break
      case 'image':
        add(`┌${'─'.repeat(width - 2)}┐`, element, TEXT_COLORS.line)
        add(`│${'image'.padStart(width / 2 + 1).padEnd(width - 2)}│`, element, TEXT_COLORS.line)
        add(`└${'─'.repeat(width - 2)}┘`, element, TEXT_COLORS.line)
        break
      case 'input':
        add(`${element.label ? `${element.label}: ` : ''}[ ${(element.value ?? '').padEnd(Math.max(width - (element.label?.length ?? 0) - 8, 8))} ]`, element)
        break
      case 'button':
        add(element.style === 'primary' ? `[ ${element.text} ]` : `( ${element.text} )`, element, TEXT_COLORS.text, element.style === 'primary')
        break
      case 'list':
        for (const item of element.items ?? []) add(`• ${item}`, element)
        break
      case 'notice':
        add(`${element.style === 'error' ? '!' : 'i'} ${element.text}`, element, element.style === 'error' ? TEXT_COLORS.error : TEXT_COLORS.request)
        break
      case 'row':
        // Side by side has no place in a narrow text view, so a row's children stack.
        for (const child of element.children ?? []) render(child, width)
        return
    }
    rows.push({ text: '', color: TEXT_COLORS.text })
  }
  for (const element of elements) render(element, INNER)
  while (rows.at(-1)?.text === '') rows.pop()

  const grid = makeGrid(INNER + 10, rows.length + 4)
  const frame = { color: TEXT_COLORS.line }
  const head = reel.device === 'phone' ? '' : ` ${reel.address ?? ''} `
  grid.write(2, 0, `╭─${head}${'─'.repeat(Math.max(INNER + 1 - head.length, 0))}╮`, frame)
  grid.write(2, rows.length + 2, `╰${'─'.repeat(INNER + 2)}╯`, frame)
  for (let y = 1; y < rows.length + 2; y++) {
    grid.put(2, y, { ch: '│', ...frame })
    grid.put(INNER + 5, y, { ch: '│', ...frame })
  }
  rows.forEach((line, i) => {
    grid.write(4, i + 2, line.text.slice(0, INNER), { color: line.color, bold: line.bold })
    // A plain-text reader has no colour, so mark what is emphasised as well.
    if (line.mark) grid.put(INNER + 7, i + 2, { ch: '◀', color: TEXT_COLORS.request })
  })
  return grid.cells
}

export function describe(reel: ScreenReel, step: ScreenStep) {
  const all = named(reel.elements)
  const labelOf = (id: string) => {
    const element = all.find((candidate) => candidate.id === id)
    return element?.text ?? element?.label ?? id
  }
  const changed = Object.entries(step.set ?? {}).map(([id, change]) => `${labelOf(id)} → ${change.text ?? change.value ?? 'changed'}`)
  return { text: [describeStage(step, labelOf), ...changed].filter(Boolean).join('   '), style: 'request' as const }
}
