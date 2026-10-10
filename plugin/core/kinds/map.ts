// map: places on a map of the world, and messages between them.
import { COLORS, MONO, SANS, type Area, type Context2D, type Sizes } from '../canvas.ts'
import { makeGrid, TEXT_COLORS, type TextCell } from '../cells.ts'
import { LAND } from '../data/land.ts'
import type { MapReel, MapStep } from '../reel.ts'
import { movement, stepTiming, type Playhead } from '../timing.ts'
import { describeStage, stage } from './shared.ts'

type Box = [west: number, south: number, east: number, north: number]

const VIEWS: Record<string, Box> = {
  world: [-170, -58, 180, 80],
  europe: [-12, 34, 42, 63],
  'north-america': [-132, 12, -58, 58],
  'south-america': [-86, -56, -32, 14],
  asia: [56, -10, 150, 56],
  africa: [-20, -36, 54, 38],
  oceania: [108, -48, 180, 2],
}

/** The part of the world to draw: what the reel asks for, or a box around its places. */
function viewOf(reel: MapReel): Box {
  if (Array.isArray(reel.view)) return reel.view
  if (reel.view) return VIEWS[reel.view]!
  const lons = reel.places.map((place) => place.lon)
  const lats = reel.places.map((place) => place.lat)
  // Leave room around the places, and never zoom in so far that the land loses its shape.
  const spanX = Math.max(Math.max(...lons) - Math.min(...lons), 40) * 1.5
  const spanY = Math.max(Math.max(...lats) - Math.min(...lats), 24) * 1.6
  if (spanX > 200) return VIEWS.world!
  const [cx, cy] = [(Math.max(...lons) + Math.min(...lons)) / 2, (Math.max(...lats) + Math.min(...lats)) / 2]
  return [Math.max(cx - spanX / 2, -180), Math.max(cy - spanY / 2, -85), Math.min(cx + spanX / 2, 180), Math.min(cy + spanY / 2, 85)]
}

// Each ring's bounding box, so rings outside the view cost nothing.
const BOUNDS = LAND.map((ring) => {
  let [west, south, east, north] = [180, 90, -180, -90]
  for (let i = 0; i < ring.length; i += 2) {
    west = Math.min(west, ring[i]!)
    east = Math.max(east, ring[i]!)
    south = Math.min(south, ring[i + 1]!)
    north = Math.max(north, ring[i + 1]!)
  }
  return [west, south, east, north] as Box
})
const ringsIn = ([west, south, east, north]: Box) => LAND.filter((_, i) => BOUNDS[i]![0] <= east && BOUNDS[i]![2] >= west && BOUNDS[i]![1] <= north && BOUNDS[i]![3] >= south)

const edgeKey = (a: string, b: string) => [a, b].sort().join('|')

function stateAt(reel: MapReel, playhead: Playhead | null) {
  const step = playhead ? reel.steps[playhead.index] : undefined
  const sending = step?.from && step.to && playhead!.elapsed >= stepTiming(step, 'map').reveal
  const routes = new Map<string, [string, string]>()
  for (const s of reel.steps) if (s.from && s.to) routes.set(edgeKey(s.from, s.to), [s.from, s.to])
  return {
    ...stage(reel.places, reel.steps, 'map', playhead),
    routes,
    message: sending ? { from: step.from!, to: step.to!, key: edgeKey(step.from!, step.to!), style: step.style ?? ('request' as const), label: step.label, progress: movement(step, 'map', playhead!.elapsed) } : null,
  }
}

export function draw(ctx: Context2D, reel: MapReel, f: Sizes, area: Area, playhead: Playhead) {
  const { shown, emphasis, routes, message } = stateAt(reel, playhead)
  const view = viewOf(reel)
  const [west, south, east, north] = view
  // Degrees of longitude are narrower away from the equator; squeeze them by the view's middle latitude.
  const squeeze = Math.cos((((south + north) / 2) * Math.PI) / 180)
  const scale = Math.min(area.w / ((east - west) * squeeze), area.h / (north - south))
  const mapW = (east - west) * squeeze * scale
  const mapH = (north - south) * scale
  const left = area.x + (area.w - mapW) / 2
  const top = area.y + (area.h - mapH) / 2
  const x = (lon: number) => left + (lon - west) * squeeze * scale
  const y = (lat: number) => top + (north - lat) * scale
  const at = (id: string) => {
    const place = reel.places.find((candidate) => candidate.id === id)!
    return { x: x(place.lon), y: y(place.lat) }
  }

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(left, top, mapW, mapH, 14)
  ctx.clip()
  ctx.fillStyle = COLORS.sunken
  ctx.fillRect(left, top, mapW, mapH)
  ctx.fillStyle = COLORS.surface
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  for (const ring of ringsIn(view)) {
    ctx.beginPath()
    for (let i = 0; i < ring.length; i += 2) {
      if (i === 0) ctx.moveTo(x(ring[i]!), y(ring[i + 1]!))
      else ctx.lineTo(x(ring[i]!), y(ring[i + 1]!))
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()

  /** A point part-way along the arc between two places, which bows upwards like a flight path. */
  const along = (from: string, to: string, t: number) => {
    const [a, b] = [at(from), at(to)]
    const lift = Math.min(Math.hypot(b.x - a.x, b.y - a.y) * 0.22, mapH * 0.3)
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * lift }
  }
  const arc = (from: string, to: string, upTo: number) => {
    ctx.beginPath()
    for (let i = 0; i <= 32; i++) {
      const p = along(from, to, (upTo * i) / 32)
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
  }

  const color = message ? COLORS[message.style] : COLORS.border
  for (const [key, [from, to]] of routes) {
    if (key === message?.key) continue
    ctx.globalAlpha = Math.min(shown(from), shown(to)) * 0.7
    ctx.strokeStyle = COLORS.muted
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    arc(from, to, 1)
    ctx.setLineDash([])
  }
  ctx.globalAlpha = 1
  if (message) {
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    arc(message.from, message.to, message.progress)
    const head = along(message.from, message.to, message.progress)
    if (message.progress < 1) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(head.x, head.y, f.edge * 0.6, 0, Math.PI * 2)
      ctx.fill()
    }
    if (message.label) {
      const apex = along(message.from, message.to, 0.5)
      ctx.font = `400 ${f.edge}px ${MONO}`
      ctx.textAlign = 'center'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 8
      ctx.strokeStyle = COLORS.bg
      ctx.strokeText(message.label, apex.x, apex.y - f.edge)
      ctx.fillStyle = color
      ctx.fillText(message.label, apex.x, apex.y - f.edge)
    }
  }

  // Two places close together would write their names over each other: the northern one's
  // name goes above its dot and the southern one's below.
  const nudge = (id: string) => {
    const p = at(id)
    const near = reel.places.find((other) => other.id !== id && shown(other.id) > 0 && Math.hypot(at(other.id).x - p.x, at(other.id).y - p.y) < f.label * 2.2)
    return near ? (p.y < at(near.id).y || (p.y === at(near.id).y && id < near.id) ? -1 : 1) : 0
  }

  for (const place of reel.places) {
    const p = at(place.id)
    const labelY = p.y + nudge(place.id) * f.sub * 1.5
    const level = emphasis(place.id)
    const active = message && (message.progress < 1 ? message.from : message.to) === place.id
    const dot = active ? color : level === 'high' ? COLORS.request : COLORS.text
    ctx.globalAlpha = shown(place.id) * (level === 'low' ? 0.4 : 1)
    ctx.fillStyle = COLORS.bg
    ctx.beginPath()
    ctx.arc(p.x, p.y, f.edge * 0.62, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = dot
    ctx.beginPath()
    ctx.arc(p.x, p.y, f.edge * 0.42, 0, Math.PI * 2)
    ctx.fill()

    // Labels go on the side with more room.
    const toLeft = p.x > left + mapW * 0.7
    ctx.font = `600 ${f.sub * 1.2}px ${SANS}`
    ctx.textAlign = toLeft ? 'right' : 'left'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 7
    ctx.strokeStyle = COLORS.bg
    ctx.strokeText(place.label, p.x + (toLeft ? -1 : 1) * f.edge, labelY)
    ctx.fillStyle = active || level === 'high' ? dot : COLORS.text
    ctx.fillText(place.label, p.x + (toLeft ? -1 : 1) * f.edge, labelY)
  }
  ctx.globalAlpha = 1
}

const COLS = 74
// Working out which characters are land is slow, and the answer for a view never changes.
const masks = new Map<string, boolean[][]>()

function landMask(view: Box, rows: number) {
  const key = `${view.join(',')}:${rows}`
  let mask = masks.get(key)
  if (!mask) {
    const [west, south, east, north] = view
    const rings = ringsIn(view)
    const inside = (lon: number, lat: number) => {
      let isIn = false
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
          const [xi, yi, xj, yj] = [ring[i]!, ring[i + 1]!, ring[j]!, ring[j + 1]!]
          if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) isIn = !isIn
        }
      }
      return isIn
    }
    mask = Array.from({ length: rows }, (_, row) =>
      Array.from({ length: COLS }, (_, col) => inside(west + ((east - west) * (col + 0.5)) / COLS, north - ((north - south) * (row + 0.5)) / rows)),
    )
    masks.set(key, mask)
  }
  return mask
}

export function text(reel: MapReel, playhead: Playhead | null): TextCell[][] {
  const { shown, emphasis, message } = stateAt(reel, playhead)
  const view = viewOf(reel)
  const [west, south, east, north] = view
  const squeeze = Math.cos((((south + north) / 2) * Math.PI) / 180)
  // A character is about twice as tall as it is wide.
  const rows = Math.min(Math.max(Math.round((COLS * (north - south)) / ((east - west) * squeeze) / 2.1), 8), 26)
  const grid = makeGrid(COLS + 4, rows + 2)
  const col = (lon: number) => 2 + Math.round(((COLS - 1) * (lon - west)) / (east - west))
  const row = (lat: number) => 1 + Math.round(((rows - 1) * (north - lat)) / (north - south))

  landMask(view, rows).forEach((line, r) => line.forEach((isLand, c) => isLand && grid.put(2 + c, 1 + r, { ch: '░', color: TEXT_COLORS.line })))

  const place = (id: string) => reel.places.find((candidate) => candidate.id === id)!
  if (message) {
    const [a, b] = [place(message.from), place(message.to)]
    const steps = Math.max(Math.abs(col(b.lon) - col(a.lon)), Math.abs(row(b.lat) - row(a.lat)), 1)
    const reached = Math.round(steps * message.progress)
    for (let i = 1; i <= reached; i++) {
      const lift = Math.round(Math.sin((i / steps) * Math.PI) * Math.min(steps * 0.12, rows * 0.25))
      grid.put(Math.round(col(a.lon) + ((col(b.lon) - col(a.lon)) * i) / steps), Math.round(row(a.lat) + ((row(b.lat) - row(a.lat)) * i) / steps) - lift, {
        ch: i === reached && message.progress < 1 ? '●' : '·',
        color: TEXT_COLORS[message.style],
        bold: true,
      })
    }
  }

  for (const item of reel.places) {
    if (!shown(item.id)) continue
    const level = emphasis(item.id)
    const color = level === 'high' ? TEXT_COLORS.request : level === 'low' ? TEXT_COLORS.muted : TEXT_COLORS.text
    const toLeft = col(item.lon) > COLS * 0.7
    grid.put(col(item.lon), row(item.lat), { ch: level === 'high' ? '◆' : '●', color, bold: true })
    // A space either side keeps the name clear of the land shading.
    grid.write(toLeft ? col(item.lon) - item.label.length - 2 : col(item.lon) + 1, row(item.lat), ` ${item.label} `, { color, bold: level === 'high' })
  }
  return grid.cells
}

export function describe(reel: MapReel, step: MapStep) {
  const labelOf = (id: string) => reel.places.find((place) => place.id === id)?.label ?? id
  const sent = step.from && step.to ? `${labelOf(step.from)} → ${labelOf(step.to)}${step.label ? `  ${step.label}` : ''}` : ''
  return { text: [describeStage(step, labelOf), sent].filter(Boolean).join('   '), style: step.style ?? ('request' as const) }
}
