// flow: boxes on a grid, and messages travelling between them.
import { COLORS, drawIcon, MONO, SANS, type Area, type Assets, type Context2D, type Sizes } from '../canvas.ts'
import { ICONS } from '../data/icons.ts'
import { makeGrid, TEXT_COLORS, type TextCell } from '../cells.ts'
import type { FlowReel, FlowStep, ReelNode } from '../reel.ts'
import { movement, stepTiming, type Playhead } from '../timing.ts'

const edgeKey = (a: string, b: string) => [a, b].sort().join('|')

/** 0 to 1: how visible a node or group is at this moment. */
function visibility(reel: FlowReel, playhead: Playhead | null) {
  const hiddenAtStart = new Set([...reel.nodes, ...(reel.groups ?? [])].filter((item) => item.hidden).map((item) => item.id))
  return (id: string) => {
    if (!playhead || !hiddenAtStart.has(id)) return 1
    const revealedAt = reel.steps.findIndex((s) => s.show?.includes(id))
    if (revealedAt === -1 || revealedAt > playhead.index) return 0
    if (revealedAt < playhead.index) return 1
    return Math.min(playhead.elapsed / (stepTiming(reel.steps[revealedAt]!).reveal || 1), 1)
  }
}

/** The message in flight, if the step has one and its reveal phase is over. */
function messageOf(reel: FlowReel, playhead: Playhead | null) {
  const step = playhead ? reel.steps[playhead.index] : undefined
  if (!step?.from || !step.to || playhead!.elapsed < stepTiming(step).reveal) return null
  const progress = movement(step, 'flow', playhead!.elapsed)
  return { step, from: step.from, to: step.to, key: edgeKey(step.from, step.to), style: step.style ?? 'request', progress, activeNode: progress < 1 ? step.from : step.to }
}

/** Every pair of nodes that exchanges a message gets one line, drawn once. */
function edgesOf(reel: FlowReel) {
  const edges = new Map<string, [string, string]>()
  for (const s of reel.steps) if (s.from && s.to) edges.set(edgeKey(s.from, s.to), [s.from, s.to])
  return edges
}

export function draw(ctx: Context2D, reel: FlowReel, f: Sizes, area: Area, playhead: Playhead, assets: Assets = {}) {
  // Layout: scale the logical grid to the area.
  const cols = Math.max(...reel.nodes.map((n) => n.col)) + 1
  const rows = Math.max(...reel.nodes.map((n) => n.row)) + 1
  const cellW = area.w / cols
  const cellH = area.h / rows
  const nodeW = Math.min(cellW * 0.8, f.label * 16)
  const nodeH = Math.min(cellH * 0.52, f.label * 5.6)
  // With few boxes they are large, and their words grow with them: one size for every box,
  // the largest the longest label still fits at.
  const longest = Math.max(...reel.nodes.map((n) => n.label.length + (n.icon ? 3 : 0)), 1)
  const longestSub = Math.max(...reel.nodes.map((n) => (n.sub?.length ?? 0) + (n.icon ? 3 : 0)), 1)
  const grow = Math.min(Math.max(Math.min(nodeH / (f.label * 3.9), (nodeW * 0.86) / (longest * 0.58 * f.label), (nodeW * 0.86) / (longestSub * 0.52 * f.sub)), 1), 1.45)
  const [labelSize, subSize, edgeSize] = [f.label * grow, f.sub * grow, f.edge * Math.min(grow, 1.3)]
  const pad = Math.min(cellH * 0.17, (cellW - nodeW) / 2 + area.x * 0.4)
  const centers = new Map(reel.nodes.map((n) => [n.id, { x: area.x + cellW * (n.col + 0.5), y: area.y + cellH * (n.row + 0.5) }]))
  const center = (id: string) => centers.get(id)!
  // A message from a node to itself goes round a loop on the node's top right corner.
  const loopRadius = nodeH * 0.42
  const loop = (id: string) => ({ x: center(id).x + nodeW / 2, y: center(id).y - nodeH / 2 })

  const visible = visibility(reel, playhead)
  const message = messageOf(reel, playhead)
  const color = message ? COLORS[message.style] : COLORS.border

  for (const group of reel.groups ?? []) {
    const points = group.nodes.map(center)
    const x = Math.min(...points.map((p) => p.x)) - nodeW / 2 - pad
    const y = Math.min(...points.map((p) => p.y)) - nodeH / 2 - pad
    const width = Math.max(...points.map((p) => p.x)) + nodeW / 2 + pad - x
    const height = Math.max(...points.map((p) => p.y)) + nodeH / 2 + pad - y

    ctx.globalAlpha = visible(group.id)
    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 2
    ctx.setLineDash([10, 8])
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, 22)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.muted
    ctx.font = `400 ${f.sub}px ${SANS}`
    ctx.fillText(group.label, x + 22, y + 18 + f.sub * 0.5)
  }

  for (const [key, [from, to]] of edgesOf(reel)) {
    const active = message?.key === key
    ctx.globalAlpha = Math.min(visible(from), visible(to))
    ctx.strokeStyle = active ? color : COLORS.border
    ctx.lineWidth = active ? 4 : 2.5
    ctx.beginPath()
    if (from === to) {
      ctx.arc(loop(from).x, loop(from).y, loopRadius, 0, Math.PI * 2)
    } else {
      ctx.moveTo(center(from).x, center(from).y)
      ctx.lineTo(center(to).x, center(to).y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  if (message) {
    const a = center(message.from)
    const b = center(message.to)
    const isLoop = message.from === message.to

    if (message.step.label) {
      let x: number
      let y: number
      let align = 'left'
      if (isLoop) {
        x = loop(message.from).x + loopRadius + 14
        y = loop(message.from).y - loopRadius * 0.4
      } else {
        // The label sits beside the line, on the side the lower node leans towards.
        const [upper, lower] = a.y <= b.y ? [a, b] : [b, a]
        const side = lower.x < upper.x ? -1 : 1
        x = (a.x + b.x) / 2 + side * 20
        // On a diagonal, lift the label clear of the line.
        y = (a.y + b.y) / 2 - (a.x === b.x ? 0 : edgeSize)
        align = side < 0 ? 'right' : 'left'
      }
      ctx.font = `400 ${edgeSize}px ${MONO}`
      ctx.textAlign = align
      ctx.lineJoin = 'round'
      ctx.lineWidth = 8
      ctx.strokeStyle = COLORS.bg
      ctx.strokeText(message.step.label, x, y)
      ctx.fillStyle = color
      ctx.fillText(message.step.label, x, y)
    }

    if (message.progress < 1) {
      // Round the loop from where it leaves the box's top edge, or straight along the line.
      const angle = Math.PI + message.progress * Math.PI * 2
      const at = isLoop
        ? { x: loop(message.from).x + Math.cos(angle) * loopRadius, y: loop(message.from).y + Math.sin(angle) * loopRadius }
        : { x: a.x + (b.x - a.x) * message.progress, y: a.y + (b.y - a.y) * message.progress }
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(at.x, at.y, f.edge * 0.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.textAlign = 'center'
  for (const node of reel.nodes) {
    const { x, y } = center(node.id)
    const active = message?.activeNode === node.id
    ctx.globalAlpha = visible(node.id)
    ctx.fillStyle = COLORS.surface
    ctx.strokeStyle = active ? color : COLORS.border
    ctx.lineWidth = active ? 4 : 2.5
    ctx.beginPath()
    ctx.roundRect(x - nodeW / 2, y - nodeH / 2, nodeW, nodeH, 14)
    ctx.fill()
    ctx.stroke()

    // An icon sits at the left of the box, and the text centres in what is left.
    // Sized by the words beside it, not the box, so a tall box does not grow an icon into its label.
    const iconSize = node.icon && assets.makePath ? Math.min(nodeH * 0.44, labelSize * 1.55) : 0
    const textX = x + (iconSize ? iconSize * 0.62 : 0)
    drawIcon(ctx, assets, ICONS[node.icon ?? ''], x - nodeW / 2 + Math.min(nodeH * 0.24, labelSize * 0.85), y - iconSize / 2, iconSize, active ? color : COLORS.muted)

    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.text
    ctx.font = `600 ${labelSize}px ${SANS}`
    ctx.fillText(node.label, textX, node.sub ? y - subSize * 0.6 : y)
    if (node.sub) {
      ctx.fillStyle = COLORS.muted
      ctx.font = `400 ${subSize}px ${SANS}`
      ctx.fillText(node.sub, textX, y + labelSize * 0.7)
    }
  }
  ctx.globalAlpha = 1
}

// Each line segment in a cell is a set of directions; the character follows from the set.
const UP = 1
const DOWN = 2
const LEFT = 4
const RIGHT = 8
const LIGHT = ' ╵╷│╴┘┐┤╶└┌├─┴┬┼'
const HEAVY = ' ╹╻┃╸┛┓┫╺┗┏┣━┻┳╋'

const GAP_X = 6
const GAP_Y = 3
const MARGIN_X = 3
const MARGIN_Y = 1

type Point = { x: number; y: number }

export function text(reel: FlowReel, playhead: Playhead | null): TextCell[][] {
  const boxW = Math.min(Math.max(14, ...reel.nodes.map((n) => Math.max(n.label.length, n.sub?.length ?? 0) + 4)), 28)
  const boxH = reel.nodes.some((n) => n.sub) ? 4 : 3
  const cols = Math.max(...reel.nodes.map((n) => n.col)) + 1
  const rows = Math.max(...reel.nodes.map((n) => n.row)) + 1
  const grid = makeGrid(MARGIN_X * 2 + cols * (boxW + GAP_X) - GAP_X, MARGIN_Y * 2 + rows * (boxH + GAP_Y) - GAP_Y)
  const { put, write } = grid

  const box = (node: ReelNode) => {
    const left = MARGIN_X + node.col * (boxW + GAP_X)
    const top = MARGIN_Y + node.row * (boxH + GAP_Y)
    return { left, top, right: left + boxW - 1, bottom: top + boxH - 1, cx: left + Math.floor(boxW / 2), cy: top + Math.floor(boxH / 2) }
  }
  const boxes = new Map(reel.nodes.map((node) => [node.id, box(node)]))
  const visibleNow = visibility(reel, playhead)
  const visible = (id: string) => visibleNow(id) > 0

  /** The cells a message passes through, in order, from just outside one box to just outside the other. */
  const route = (fromId: string, toId: string): Point[] => {
    const a = boxes.get(fromId)!
    const b = boxes.get(toId)!
    const path: Point[] = []
    if (fromId === toId) return path
    if (a.top === b.top) {
      const [l, r] = a.left < b.left ? [a, b] : [b, a]
      for (let x = l.right + 1; x < r.left; x++) path.push({ x, y: l.cy })
      return a.left < b.left ? path : path.reverse()
    }
    const [upper, lower] = a.top < b.top ? [a, b] : [b, a]
    const turn = upper.bottom + 2
    for (let y = upper.bottom + 1; y <= turn; y++) path.push({ x: upper.cx, y })
    const direction = Math.sign(lower.cx - upper.cx)
    for (let x = upper.cx + direction; direction !== 0 && x !== lower.cx + direction; x += direction) path.push({ x, y: turn })
    for (let y = turn + 1; y < lower.top; y++) path.push({ x: lower.cx, y })
    return a.top < b.top ? path : path.reverse()
  }

  const message = messageOf(reel, playhead)
  const messageColor = TEXT_COLORS[message?.style ?? 'request']

  for (const group of reel.groups ?? []) {
    if (!visible(group.id)) continue
    const members = group.nodes.map((id) => boxes.get(id)!)
    const x0 = Math.min(...members.map((m) => m.left)) - 2
    const x1 = Math.max(...members.map((m) => m.right)) + 2
    const y0 = Math.min(...members.map((m) => m.top)) - 1
    const y1 = Math.max(...members.map((m) => m.bottom)) + 1
    const style = { color: TEXT_COLORS.line }
    for (let x = x0 + 1; x < x1; x++) {
      put(x, y0, { ch: '┄', ...style })
      put(x, y1, { ch: '┄', ...style })
    }
    for (let y = y0 + 1; y < y1; y++) {
      put(x0, y, { ch: '┆', ...style })
      put(x1, y, { ch: '┆', ...style })
    }
    put(x0, y0, { ch: '┌', ...style })
    put(x1, y0, { ch: '┐', ...style })
    put(x0, y1, { ch: '└', ...style })
    put(x1, y1, { ch: '┘', ...style })
    write(x0 + 2, y0, ` ${group.label} `, { color: TEXT_COLORS.muted })
  }

  // Lines: collect the directions leaving every cell, then pick each cell's character.
  const segments = new Map<string, { x: number; y: number; mask: number; active: boolean }>()
  const mark = (p: Point, bit: number, active: boolean) => {
    const cell = segments.get(`${p.x},${p.y}`) ?? { ...p, mask: 0, active: false }
    cell.mask |= bit
    cell.active ||= active
    segments.set(`${p.x},${p.y}`, cell)
  }
  const joins: { at: Point; ch: string; active: boolean }[] = []
  const loops: { id: string; active: boolean }[] = []

  for (const [key, [from, to]] of edgesOf(reel)) {
    if (!visible(from) || !visible(to)) continue
    const active = key === message?.key
    if (from === to) {
      loops.push({ id: from, active })
      continue
    }
    const path = route(from, to)
    path.forEach((p, i) => {
      for (const q of [path[i - 1], path[i + 1]]) {
        if (!q) continue
        mark(p, q.y < p.y ? UP : q.y > p.y ? DOWN : q.x < p.x ? LEFT : RIGHT, active)
      }
    })
    // Join each end of the line to its box, and give the box border a matching tee.
    for (const [id, end] of [[from, path[0]], [to, path.at(-1)]] as const) {
      if (!end) continue
      const b = boxes.get(id)!
      if (end.y < b.top) {
        mark(end, DOWN, active)
        joins.push({ at: { x: end.x, y: b.top }, ch: active ? '┻' : '┴', active })
      } else if (end.y > b.bottom) {
        mark(end, UP, active)
        joins.push({ at: { x: end.x, y: b.bottom }, ch: active ? '┳' : '┬', active })
      } else if (end.x < b.left) {
        mark(end, RIGHT, active)
        joins.push({ at: { x: b.left, y: end.y }, ch: active ? '┫' : '┤', active })
      } else {
        mark(end, LEFT, active)
        joins.push({ at: { x: b.right, y: end.y }, ch: active ? '┣' : '├', active })
      }
    }
  }

  for (const { x, y, mask, active } of segments.values()) {
    put(x, y, { ch: (active ? HEAVY : LIGHT)[mask]!, color: active ? messageColor : TEXT_COLORS.line })
  }

  for (const node of reel.nodes) {
    if (!visible(node.id)) continue
    const b = boxes.get(node.id)!
    const border = { color: message?.activeNode === node.id ? messageColor : TEXT_COLORS.line }
    for (let y = b.top; y <= b.bottom; y++) write(b.left, y, ' '.repeat(boxW))
    write(b.left, b.top, `╭${'─'.repeat(boxW - 2)}╮`, border)
    write(b.left, b.bottom, `╰${'─'.repeat(boxW - 2)}╯`, border)
    for (let y = b.top + 1; y < b.bottom; y++) {
      put(b.left, y, { ch: '│', ...border })
      put(b.right, y, { ch: '│', ...border })
    }
    const centred = (line: string) => b.left + Math.max(1, Math.floor((boxW - line.length) / 2))
    const label = node.label.slice(0, boxW - 2)
    write(centred(label), b.top + 1, label, { color: TEXT_COLORS.text, bold: true })
    if (node.sub) write(centred(node.sub.slice(0, boxW - 2)), b.top + 2, node.sub.slice(0, boxW - 2), { color: TEXT_COLORS.muted })
  }

  for (const join of joins) put(join.at.x, join.at.y, { ch: join.ch, color: join.active ? messageColor : TEXT_COLORS.line })
  // A loop back to the same box is a turning arrow just outside its top right corner.
  for (const { id, active } of loops) {
    const b = boxes.get(id)!
    put(b.right + 1, b.top, { ch: '↻', color: active ? messageColor : TEXT_COLORS.line, bold: active })
  }

  if (message && message.progress < 1) {
    const path = route(message.from, message.to)
    const at = path[Math.round(message.progress * (path.length - 1))]
    if (at) put(at.x, at.y, { ch: '●', color: messageColor, bold: true })
  }

  return grid.cells
}

/** What a step does, in a few words: "Browser → Gateway  GET /", or "+ Catalog DB". */
export function describe(reel: FlowReel, step: FlowStep) {
  const labelOf = (id: string) => reel.groups?.find((g) => g.id === id)?.label ?? reel.nodes.find((n) => n.id === id)?.label ?? id
  const shown = step.show?.length ? `+ ${step.show.map(labelOf).join(', ')}` : ''
  const sent = step.from && step.to ? `${labelOf(step.from)} ${step.from === step.to ? '↻' : `→ ${labelOf(step.to)}`}${step.label ? `  ${step.label}` : ''}` : ''
  return { text: [shown, sent].filter(Boolean).join('   '), style: step.style ?? ('request' as const) }
}
