// code: one or more listings, with the lines being discussed lit up.
import { COLORS, MONO, type Area, type Context2D, type Sizes } from '../canvas.ts'
import { makeGrid, TEXT_COLORS, type TextCell } from '../cells.ts'
import type { CodeFile, CodeReel, CodeStep } from '../reel.ts'
import { movement, type Playhead } from '../timing.ts'

const filesOf = (reel: CodeReel): CodeFile[] => reel.files ?? [{ name: '', code: reel.code ?? '' }]

/** One row as drawn: a line of the listing, or the rest of a line too long to fit. */
type Row = { number: number | null; line: number; text: string }

/** A listing's rows, with lines longer than `columns` carried over onto rows of their own. */
function rowsOf(file: CodeFile, columns: number): Row[] {
  const rows: Row[] = []
  file.code.replaceAll('\t', '  ').split('\n').forEach((whole, i) => {
    const line = (file.start ?? 1) + i
    const indent = whole.match(/^ */)![0].length
    let rest = whole
    let first = true
    while (rest.length > columns) {
      // Break where code reads naturally: at a space, or before a dot or bracket. Failing
      // that, mid-word.
      let cut = columns
      for (let at = columns; at > indent + 8; at--) {
        if (rest[at] === ' ' || rest[at] === '.' || rest[at] === '(') {
          cut = at
          break
        }
      }
      rows.push({ number: first ? line : null, line, text: rest.slice(0, cut) })
      // What is carried over lines up a little inside the line it belongs to.
      rest = ' '.repeat(Math.min(indent + 4, columns - 20)) + rest.slice(cut).trimStart()
      first = false
    }
    rows.push({ number: first ? line : null, line, text: rest })
  })
  return rows
}

/** Which listing is showing at this moment, which lines are lit, and how far the change has got. */
function stateAt(reel: CodeReel, playhead: Playhead | null) {
  const files = filesOf(reel)
  const index = playhead?.index ?? reel.steps.length - 1
  const step = reel.steps[index]
  const named = (upTo: number) => {
    let name = files[0]!.name
    for (const earlier of reel.steps.slice(0, Math.max(upTo + 1, 0))) name = earlier.file ?? name
    return files.find((file) => file.name === name) ?? files[0]!
  }
  const file = named(index)
  return {
    file,
    /** True while a step that switched listing is still bringing the new one in. */
    isNew: index > 0 && named(index - 1) !== file,
    lit: new Set(step?.lines ?? []),
    strength: playhead && step ? movement(step, 'code', playhead.elapsed) : 1,
  }
}

export function draw(ctx: Context2D, reel: CodeReel, f: Sizes, area: Area, playhead: Playhead) {
  const { file, isNew, lit, strength } = stateAt(reel, playhead)
  // Narrow frames carry long lines over sooner, so the type stays a readable size.
  const columns = area.w / area.h > 1.3 ? 76 : 46
  const rows = rowsOf(file, columns)
  const lastNumber = (file.start ?? 1) + file.code.split('\n').length - 1
  const gutter = String(lastNumber).length + 2
  const longest = Math.max(...rows.map((row) => row.text.length), 24)
  const header = file.name ? 1.5 : 0

  // The largest type that fits the listing in the area, both ways.
  const size = Math.min(f.label * 1.9, (area.w * 0.96) / ((longest + gutter + 2) * 0.6), (area.h * 0.96) / ((rows.length + header) * 1.55 + 1))
  const charW = size * 0.6
  const lineH = size * 1.55
  const panelW = (longest + gutter + 2) * charW
  const panelH = (rows.length + header) * lineH + lineH
  const x = area.x + (area.w - panelW) / 2
  const y = area.y + (area.h - panelH) / 2

  ctx.fillStyle = COLORS.surface
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.roundRect(x, y, panelW, panelH, 14)
  ctx.fill()
  ctx.stroke()

  // A newly shown listing fades in; its name sits in a strip along the top.
  const arriving = isNew ? strength : 1
  ctx.font = `400 ${size}px ${MONO}`
  if (file.name) {
    ctx.globalAlpha = arriving
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.request
    // A path too long for the panel loses folders from its front, never its file name.
    let name = file.name
    const room = longest + gutter - 1
    while (name.length > room && name.replace(/^…\//, '').includes('/')) name = `…/${name.replace(/^…\//, '').split('/').slice(1).join('/')}`
    ctx.fillText(name, x + charW * 1.5, y + lineH * 0.95)
    ctx.globalAlpha = 1
    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, y + lineH * 1.7)
    ctx.lineTo(x + panelW, y + lineH * 1.7)
    ctx.stroke()
  }

  rows.forEach((row, i) => {
    const middle = y + lineH * (i + 1 + header)
    const isLit = lit.has(row.line)

    if (isLit) {
      ctx.globalAlpha = 0.16 * strength
      ctx.fillStyle = COLORS.request
      ctx.fillRect(x + 2, middle - lineH / 2, panelW - 4, lineH)
      ctx.globalAlpha = strength
      ctx.fillRect(x + 2, middle - lineH / 2, 5, lineH)
    }

    ctx.globalAlpha = arriving
    if (row.number !== null) {
      ctx.textAlign = 'right'
      ctx.fillStyle = isLit ? COLORS.request : COLORS.border
      ctx.fillText(String(row.number), x + (gutter - 0.5) * charW, middle)
    }

    // With some lines lit, the rest step back; with none, the whole listing reads normally.
    ctx.textAlign = 'left'
    ctx.fillStyle = isLit || lit.size === 0 ? COLORS.text : COLORS.muted
    ctx.globalAlpha = arriving * (isLit || lit.size === 0 ? 1 : 1 - 0.35 * strength)
    ctx.fillText(row.text, x + (gutter + 1) * charW, middle)
  })
  ctx.globalAlpha = 1
}

export function text(reel: CodeReel, playhead: Playhead | null): TextCell[][] {
  const { file, lit } = stateAt(reel, playhead)
  const rows = rowsOf(file, 66)
  const digits = String((file.start ?? 1) + file.code.split('\n').length - 1).length
  const top = file.name ? 3 : 1
  const grid = makeGrid(4 + digits + 3 + Math.max(...rows.map((row) => row.text.length), file.name.length) + 2, rows.length + top + 1)

  if (file.name) {
    grid.write(4, 1, file.name, { color: TEXT_COLORS.request, bold: true })
    grid.write(4, 2, '─'.repeat(Math.max(file.name.length, 24)), { color: TEXT_COLORS.line })
  }
  rows.forEach((row, i) => {
    const isLit = lit.has(row.line)
    const y = i + top
    if (isLit && row.number !== null) grid.put(2, y, { ch: '▶', color: TEXT_COLORS.request, bold: true })
    if (row.number !== null) grid.write(4, y, String(row.number).padStart(digits), { color: isLit ? TEXT_COLORS.request : TEXT_COLORS.line })
    grid.put(4 + digits + 1, y, { ch: '│', color: TEXT_COLORS.line })
    grid.write(4 + digits + 3, y, row.text, { color: isLit || lit.size === 0 ? TEXT_COLORS.text : TEXT_COLORS.muted, bold: isLit })
  })
  return grid.cells
}

export function describe(_reel: CodeReel, step: CodeStep) {
  const lines = [...(step.lines ?? [])].sort((a, b) => a - b)
  // Runs of neighbouring lines read as a range: 3, 4, 5, 9 is "lines 3–5, 9".
  const ranges: string[] = []
  for (let i = 0; i < lines.length; i++) {
    let end = i
    while (lines[end + 1] === lines[end]! + 1) end++
    ranges.push(end > i ? `${lines[i]}–${lines[end]}` : String(lines[i]))
    i = end
  }
  const parts = [step.file ?? '', lines.length ? `line${lines.length > 1 ? 's' : ''} ${ranges.join(', ')}` : '']
  return { text: parts.filter(Boolean).join('   '), style: 'request' as const }
}
