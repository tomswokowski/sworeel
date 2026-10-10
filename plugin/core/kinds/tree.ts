// tree: a hierarchy, drawn from the root down.
import { COLORS, drawIcon, MONO, SANS, type Area, type Assets, type Context2D, type Sizes } from '../canvas.ts'
import { ICONS } from '../data/icons.ts'
import { makeGrid, TEXT_COLORS, type TextCell } from '../cells.ts'
import type { TreeNode, TreeReel, TreeStep, TreeView } from '../reel.ts'
import type { Playhead } from '../timing.ts'
import { describeStage, stage } from './shared.ts'

/** Where each node goes: leaves take one column each, left to right, and a parent sits over the middle of its children. */
function layout(reel: TreeReel) {
  const children = new Map<string | undefined, TreeNode[]>()
  for (const node of reel.nodes) children.set(node.parent, [...(children.get(node.parent) ?? []), node])
  const place = new Map<string, { x: number; depth: number }>()
  let leaves = 0
  let deepest = 0

  const visit = (node: TreeNode, depth: number): number => {
    deepest = Math.max(deepest, depth)
    const below = (children.get(node.id) ?? []).map((child) => visit(child, depth + 1))
    const x = below.length ? (below[0]! + below.at(-1)!) / 2 : leaves++
    place.set(node.id, { x, depth })
    return x
  }
  for (const root of children.get(undefined) ?? []) visit(root, 0)
  return { place, leaves: Math.max(leaves, 1), rows: deepest + 1, children }
}

/** Which way the tree is drawn at a step: the last view named at or before it. */
function viewAt(reel: TreeReel, index: number): TreeView {
  let view = reel.view ?? 'boxes'
  for (const step of reel.steps.slice(0, Math.max(index + 1, 0))) view = step.view ?? view
  return view
}

// Files with no extension that are still files, not folders.
const PLAIN_FILES = /^(Caddyfile|Dockerfile|Makefile|Gemfile|Rakefile|Procfile|LICENSE|README|Jenkinsfile|Brewfile)$/i

/** The icon for a row of the listing: the node's own, or a folder or file judged from its label. */
function iconOf(node: TreeNode, hasChildren: boolean) {
  if (node.icon) return node.icon
  const name = node.label.split('/').pop()!
  return hasChildren || !(name.includes('.') || PLAIN_FILES.test(name)) ? 'folder' : 'file'
}

/** The tree as an indented listing, the way a file browser shows folders. */
function drawList(ctx: Context2D, reel: TreeReel, f: Sizes, area: Area, playhead: Playhead, assets: Assets, arriving: number) {
  const { children } = layout(reel)
  const { shown, emphasis } = stage(reel.nodes, reel.steps, 'tree', playhead)
  // Every node gets a row, in reading order, whether or not it has been revealed yet, so
  // rows do not jump about as the tree fills in.
  const rows: { node: TreeNode; depth: number; parent: number }[] = []
  const visit = (node: TreeNode, depth: number, parent: number) => {
    const row = rows.push({ node, depth, parent }) - 1
    for (const child of children.get(node.id) ?? []) visit(child, depth + 1, row)
  }
  for (const root of children.get(undefined) ?? []) visit(root, 0, -1)

  const widest = Math.max(...rows.map((row) => row.depth * 2.4 + row.node.label.length + 2.6))
  const size = Math.min(f.label * 1.25, (area.h * 0.94) / (rows.length * 1.7 + 1.2), (area.w * 0.86) / ((widest + 3) * 0.6))
  const lineH = size * 1.7
  const indent = size * 0.6 * 2.4
  const panelW = (widest + 3) * size * 0.6
  const panelH = rows.length * lineH + lineH * 1.2
  const x = area.x + (area.w - panelW) / 2
  const y = area.y + (area.h - panelH) / 2
  const rowX = (depth: number) => x + size * 1.1 + depth * indent
  const rowY = (row: number) => y + lineH * (row + 1.1)

  ctx.globalAlpha = arriving
  ctx.fillStyle = COLORS.surface
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect(x, y, panelW, panelH, 14)
  ctx.fill()
  ctx.stroke()

  rows.forEach(({ node, depth, parent }, i) => {
    const level = emphasis(node.id)
    const alpha = arriving * shown(node.id) * (level === 'low' ? 0.4 : 1)
    const icon = iconOf(node, (children.get(node.id) ?? []).length > 0)
    const isFolder = icon === 'folder'
    const color = level === 'high' ? COLORS.request : COLORS.text

    // The guide: down from under the parent's icon, then across to this row.
    if (parent >= 0) {
      const guideX = rowX(depth - 1) + size * 0.5
      ctx.globalAlpha = arriving * shown(node.id) * 0.9
      ctx.strokeStyle = COLORS.border
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(guideX, rowY(parent) + size * 0.7)
      ctx.lineTo(guideX, rowY(i))
      ctx.lineTo(rowX(depth) - size * 0.25, rowY(i))
      ctx.stroke()
    }

    ctx.globalAlpha = alpha
    drawIcon(ctx, assets, ICONS[icon], rowX(depth), rowY(i) - size * 0.5, size, level === 'high' ? COLORS.request : COLORS.muted)
    ctx.textAlign = 'left'
    ctx.fillStyle = color
    ctx.font = `${isFolder ? 600 : 400} ${size}px ${MONO}`
    // Without icons to tell them apart, a folder gets a trailing slash.
    ctx.fillText(isFolder && !assets.makePath ? `${node.label}/` : node.label, rowX(depth) + (assets.makePath ? size * 1.5 : 0), rowY(i))
  })
  ctx.globalAlpha = 1
}

export function draw(ctx: Context2D, reel: TreeReel, f: Sizes, area: Area, playhead: Playhead, assets: Assets = {}) {
  const view = viewAt(reel, playhead.index)
  // A step that switches view fades the new one in.
  const switched = playhead.index >= 0 && viewAt(reel, playhead.index - 1) !== view
  const arriving = switched ? Math.min(playhead.elapsed / 450, 1) : 1
  if (view === 'list') return drawList(ctx, reel, f, area, playhead, assets, arriving)

  const { place, leaves, rows } = layout(reel)
  const { shown, emphasis } = stage(reel.nodes, reel.steps, 'tree', playhead)
  const cellW = area.w / leaves
  const cellH = area.h / rows
  const nodeW = Math.min(cellW * 0.86, 260)
  const nodeH = Math.min(cellH * 0.46, 96)
  const at = (id: string) => ({ x: area.x + cellW * (place.get(id)!.x + 0.5), y: area.y + cellH * (place.get(id)!.depth + 0.5) })

  for (const node of reel.nodes) {
    if (node.parent === undefined) continue
    const onPath = emphasis(node.id) === 'high' && emphasis(node.parent) === 'high'
    ctx.globalAlpha = arriving * Math.min(shown(node.id), shown(node.parent)) * (emphasis(node.id) === 'low' ? 0.4 : 1)
    ctx.strokeStyle = onPath ? COLORS.request : COLORS.border
    ctx.lineWidth = onPath ? 4 : 2.5
    ctx.beginPath()
    ctx.moveTo(at(node.parent).x, at(node.parent).y)
    ctx.lineTo(at(node.id).x, at(node.id).y)
    ctx.stroke()
  }

  ctx.textAlign = 'center'
  for (const node of reel.nodes) {
    const { x, y } = at(node.id)
    const level = emphasis(node.id)
    ctx.globalAlpha = arriving * shown(node.id) * (level === 'low' ? 0.4 : 1)
    ctx.fillStyle = COLORS.surface
    ctx.strokeStyle = level === 'high' ? COLORS.request : COLORS.border
    ctx.lineWidth = level === 'high' ? 4 : 2.5
    ctx.beginPath()
    ctx.roundRect(x - nodeW / 2, y - nodeH / 2, nodeW, nodeH, 14)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = level === 'high' ? COLORS.request : COLORS.text
    ctx.font = `600 ${Math.min(f.label, (nodeW * 0.9) / (node.label.length * 0.58))}px ${SANS}`
    ctx.fillText(node.label, x, y)
  }
  ctx.globalAlpha = 1
}

export function text(reel: TreeReel, playhead: Playhead | null): TextCell[][] {
  const { children } = layout(reel)
  const { shown, emphasis } = stage(reel.nodes, reel.steps, 'tree', playhead)
  const rows: { prefix: string; node: TreeNode }[] = []
  const visit = (node: TreeNode, prefix: string, branch: string, isLast: boolean) => {
    if (shown(node.id) === 0) return
    rows.push({ prefix: prefix + branch, node })
    const below = (children.get(node.id) ?? []).filter((child) => shown(child.id) > 0)
    const indent = prefix + (branch ? (isLast ? '   ' : '│  ') : '')
    below.forEach((child, i) => visit(child, indent, i === below.length - 1 ? '└─ ' : '├─ ', i === below.length - 1))
  }
  for (const root of children.get(undefined) ?? []) visit(root, '', '', true)

  const grid = makeGrid(4 + Math.max(...rows.map((row) => row.prefix.length + row.node.label.length), 10) + 4, rows.length + 2)
  rows.forEach(({ prefix, node }, i) => {
    const level = emphasis(node.id)
    grid.write(3, i + 1, prefix, { color: TEXT_COLORS.line })
    grid.write(3 + prefix.length, i + 1, node.label, { color: level === 'high' ? TEXT_COLORS.request : level === 'low' ? TEXT_COLORS.muted : TEXT_COLORS.text, bold: level === 'high' })
    // A plain-text reader has no colour, so mark what is emphasised as well.
    if (level === 'high') grid.write(3 + prefix.length + node.label.length + 1, i + 1, '◀', { color: TEXT_COLORS.request })
  })
  return grid.cells
}

export function describe(reel: TreeReel, step: TreeStep) {
  const staged = describeStage(step, (id) => reel.nodes.find((node) => node.id === id)?.label ?? id)
  const view = step.view ? `as ${step.view === 'list' ? 'a listing' : 'boxes'}` : ''
  return { text: [view, staged].filter(Boolean).join('   '), style: 'request' as const }
}
