// pie: shares of a whole, drawn as a ring with a key beside it.
import { COLORS, PALETTE, SANS, type Area, type Context2D, type Sizes } from '../canvas.ts'
import { makeGrid, TEXT_COLORS, TEXT_PALETTE, type TextCell } from '../cells.ts'
import type { PieReel, PieStep } from '../reel.ts'
import type { Playhead } from '../timing.ts'
import { describeStage, stage } from './shared.ts'

const percent = (share: number) => `${Math.round(share * 100)}%`

function sharesOf(reel: PieReel) {
  const total = reel.slices.reduce((sum, slice) => sum + slice.value, 0)
  return reel.slices.map((slice) => ({ slice, share: slice.value / total }))
}

export function draw(ctx: Context2D, reel: PieReel, f: Sizes, area: Area, playhead: Playhead) {
  const { shown, emphasis } = stage(reel.slices, reel.steps, 'pie', playhead)
  const shares = sharesOf(reel)
  // In a wide frame the key sits to the right of the ring; otherwise underneath it.
  const beside = area.w / area.h > 1.3
  const keyRow = f.label * 1.7
  const keyH = shares.length * keyRow
  const radius = beside ? Math.min(area.h * 0.44, area.w * 0.2) : Math.min(area.w * 0.36, (area.h - keyH - f.label * 2) * 0.48)
  const cx = beside ? area.x + area.w * 0.3 : area.x + area.w / 2
  const cy = beside ? area.y + area.h / 2 : area.y + radius + f.label * 0.5

  // The ring a slice will fill once it is revealed.
  ctx.fillStyle = COLORS.surface
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()

  let start = -Math.PI / 2
  let centred: { share: number; color: string } | null = null
  shares.forEach(({ slice, share }, n) => {
    const sweep = share * Math.PI * 2
    const level = emphasis(slice.id)
    const color = PALETTE[n % PALETTE.length]!
    if (level === 'high' && !centred) centred = { share, color }
    // An emphasised slice is pulled a little way out of the ring.
    const middle = start + sweep / 2
    const pull = level === 'high' ? radius * 0.07 : 0
    ctx.globalAlpha = level === 'low' ? 0.3 : 1
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(middle) * pull, cy + Math.sin(middle) * pull)
    ctx.arc(cx + Math.cos(middle) * pull, cy + Math.sin(middle) * pull, radius, start, start + sweep * shown(slice.id))
    ctx.fill()
    start += sweep
  })
  ctx.globalAlpha = 1

  ctx.fillStyle = COLORS.bg
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 0.56, 0, Math.PI * 2)
  ctx.fill()

  // The emphasised slice's share is spelled out in the middle of the ring.
  const middle = centred as { share: number; color: string } | null
  if (middle) {
    ctx.textAlign = 'center'
    ctx.fillStyle = middle.color
    ctx.font = `700 ${radius * 0.34}px ${SANS}`
    ctx.fillText(percent(middle.share), cx, cy)
  }

  const keyX = beside ? area.x + area.w * 0.58 : area.x + area.w * 0.16
  const keyY = beside ? cy - keyH / 2 + keyRow / 2 : cy + radius + f.label * 1.6
  // The key's words are set smaller when the longest label would otherwise reach its percentage.
  const percentX = beside ? area.x + area.w * 0.96 : area.x + area.w * 0.84
  ctx.font = `600 ${f.label}px ${SANS}`
  const widestLabel = Math.max(...shares.map(({ slice }) => ctx.measureText(slice.label).width))
  const widestPercent = Math.max(...shares.map(({ share }) => ctx.measureText(percent(share)).width))
  const keySize = f.label * Math.min(Math.max((percentX - keyX - f.label * 1.8 - widestPercent) / widestLabel, 0.55), 1)
  shares.forEach(({ slice, share }, n) => {
    const y = keyY + keyRow * n
    const level = emphasis(slice.id)
    ctx.globalAlpha = shown(slice.id) * (level === 'low' ? 0.4 : 1)
    ctx.fillStyle = PALETTE[n % PALETTE.length]!
    ctx.beginPath()
    ctx.arc(keyX, y, f.label * 0.36, 0, Math.PI * 2)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.text
    ctx.font = `${level === 'high' ? 600 : 400} ${keySize}px ${SANS}`
    ctx.fillText(slice.label, keyX + f.label, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.muted
    ctx.fillText(percent(share), percentX, y)
  })
  ctx.globalAlpha = 1
}

const TRACK = 24

export function text(reel: PieReel, playhead: Playhead | null): TextCell[][] {
  const { shown, emphasis } = stage(reel.slices, reel.steps, 'pie', playhead)
  const shares = sharesOf(reel)
  const labelW = Math.min(Math.max(...reel.slices.map((slice) => slice.label.length)), 30)
  const grid = makeGrid(3 + labelW + 2 + TRACK + 8, shares.length * 2 + 1)

  shares.forEach(({ slice, share }, n) => {
    if (!shown(slice.id)) return
    const y = 1 + n * 2
    const level = emphasis(slice.id)
    const label = slice.label.slice(0, labelW)
    grid.write(3 + labelW - label.length, y, label, { color: level === 'low' ? TEXT_COLORS.muted : TEXT_COLORS.text, bold: level === 'high' })
    const filled = Math.max(Math.round(TRACK * share), 1)
    grid.write(3 + labelW + 2, y, '█'.repeat(filled), { color: level === 'low' ? TEXT_COLORS.line : TEXT_PALETTE[n % TEXT_PALETTE.length]! })
    grid.write(3 + labelW + 2 + filled, y, '░'.repeat(TRACK - filled), { color: TEXT_COLORS.line })
    grid.write(3 + labelW + 2 + TRACK + 1, y, `${percent(share)}${level === 'high' ? ' ◀' : ''}`, { color: level === 'high' ? TEXT_COLORS.text : TEXT_COLORS.muted, bold: level === 'high' })
  })
  return grid.cells
}

export function describe(reel: PieReel, step: PieStep) {
  return { text: describeStage(step, (id) => reel.slices.find((slice) => slice.id === id)?.label ?? id), style: 'request' as const }
}
