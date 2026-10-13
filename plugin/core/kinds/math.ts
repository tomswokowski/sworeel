// math: formulas, one under another, as a derivation or a set of definitions.
import { COLORS, MONO, SANS, type Area, type Assets, type Context2D, type Sizes } from '../canvas.ts'
import { makeGrid, TEXT_COLORS, type TextCell } from '../cells.ts'
import type { MathReel, MathStep } from '../reel.ts'
import type { Playhead } from '../timing.ts'
import { describeStage, stage } from './shared.ts'

const GREEK = 'alpha α beta β gamma γ delta δ epsilon ε theta θ lambda λ mu μ pi π rho ρ sigma σ tau τ phi φ omega ω Delta Δ Sigma Σ Omega Ω'.split(' ')
const SYMBOLS: [RegExp, string][] = [
  [/\\cdot(?![a-z])/g, '·'], [/\\times(?![a-z])/g, '×'], [/\\div(?![a-z])/g, '÷'], [/\\pm(?![a-z])/g, '±'], [/\\leq?(?![a-z])/g, '≤'], [/\\geq?(?![a-z])/g, '≥'], [/\\neq?(?![a-z])/g, '≠'],
  [/\\approx(?![a-z])/g, '≈'], [/\\infty(?![a-z])/g, '∞'], [/\\sum(?![a-z])/g, '∑'], [/\\prod(?![a-z])/g, '∏'], [/\\int(?![a-z])/g, '∫'],
  [/\\(?:to|rightarrow)(?![a-z])/g, '→'], [/\\(?:gets|leftarrow)(?![a-z])/g, '←'], [/\\Rightarrow(?![a-z])/g, '⇒'],
  [/\\in(?![a-z])/g, '∈'], [/\\ldots|\\dots|\\cdots/g, '…'], [/\\sqrt(?![a-z])/g, '√'], [/\\(?:left|right|quad|qquad)(?![a-z])|\\[,;!]/g, ''],
]
const RAISED: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', n: 'ⁿ', '+': '⁺', '-': '⁻' }

/** A readable plain-text stand-in for a formula, for where it can't be typeset. */
export function texToText(tex: string) {
  let out = tex
  // Fractions become (top)/(bottom), working outwards from the innermost.
  for (let i = 0; i < 6; i++) out = out.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
  out = out.replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, '$1')
  for (let i = 0; i < GREEK.length; i += 2) out = out.replace(new RegExp(`\\\\${GREEK[i]}(?![a-zA-Z])`, 'g'), GREEK[i + 1]!)
  for (const [from, to] of SYMBOLS) out = out.replace(from, to)
  // A power is raised when every character of it has a raised form; otherwise it keeps its ^.
  out = out.replace(/\^(?:\{([^{}]*)\}|([0-9n+-]))/g, (whole, braced?: string, single?: string) => {
    const power = braced ?? single ?? ''
    return power && [...power].every((c) => c in RAISED) ? [...power].map((c) => RAISED[c]).join('') : whole
  })
  out = out.replace(/([_^])\{([^{}]*)\}/g, '$1($2)').replace(/√\{([^{}]*)\}/g, '√($1)')
  // What is left of the markup: other commands keep their name, braces go.
  return out.replace(/\\([a-zA-Z]+)/g, '$1').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim()
}

export function draw(ctx: Context2D, reel: MathReel, f: Sizes, area: Area, playhead: Playhead, assets: Assets = {}) {
  const { shown, emphasis } = stage(reel.lines, reel.steps, 'math', playhead)
  const NOTE = 0.62
  const GAP = 0.9
  // Sizes in ems first, so the type can be as large as the whole derivation allows.
  const rows = reel.lines.map((line) => {
    const formula = assets.formulas?.get(line.tex)
    const plain = formula ? null : texToText(line.tex)
    return { line, formula, plain, width: formula?.width ?? plain!.length * 0.62, height: (formula?.height ?? 1.3) + (line.note ? NOTE + 0.35 : 0) }
  })
  const total = rows.reduce((sum, row) => sum + row.height, 0) + GAP * (rows.length - 1)
  const em = Math.min(f.label * 4, (area.w * 0.94) / Math.max(...rows.map((row) => row.width)), (area.h * 0.94) / total)

  let y = area.y + (area.h - total * em) / 2
  for (const { line, formula, plain, width, height } of rows) {
    const level = emphasis(line.id)
    const color = level === 'high' ? COLORS.request : COLORS.text
    const left = area.x + (area.w - width * em) / 2
    ctx.globalAlpha = shown(line.id) * (level === 'low' ? 0.35 : 1)
    ctx.fillStyle = color

    if (formula) {
      for (const shape of formula.shapes) {
        ctx.save()
        ctx.translate(left + shape.x * em, y + shape.y * em)
        ctx.scale(shape.scaleX * em, shape.scaleY * em)
        ctx.fill(shape.path as never)
        ctx.restore()
      }
    } else {
      // No typesetter here: write the formula out in plain characters.
      ctx.textAlign = 'center'
      ctx.font = `400 ${em}px ${MONO}`
      ctx.fillText(plain!, area.x + area.w / 2, y + 0.65 * em)
    }
    if (line.note) {
      ctx.textAlign = 'center'
      ctx.fillStyle = COLORS.muted
      ctx.font = `400 ${Math.max(NOTE * em, f.sub)}px ${SANS}`
      ctx.fillText(line.note, area.x + area.w / 2, y + (height - NOTE * 0.5) * em)
    }
    y += (height + GAP) * em
  }
  ctx.globalAlpha = 1
}

export function text(reel: MathReel, playhead: Playhead | null): TextCell[][] {
  const { shown, emphasis } = stage(reel.lines, reel.steps, 'math', playhead)
  const lines = reel.lines.filter((line) => shown(line.id) > 0)
  const grid = makeGrid(6 + Math.max(...reel.lines.map((line) => Math.max(texToText(line.tex).length, line.note?.length ?? 0))) + 4, lines.reduce((rows, line) => rows + (line.note ? 3 : 2), 1))

  let y = 1
  for (const line of lines) {
    const level = emphasis(line.id)
    const plain = texToText(line.tex)
    grid.write(4, y, plain, { color: level === 'high' ? TEXT_COLORS.request : level === 'low' ? TEXT_COLORS.muted : TEXT_COLORS.text, bold: level === 'high' })
    // A plain-text reader has no colour, so mark what is emphasised as well.
    if (level === 'high') grid.put(4 + plain.length + 1, y, { ch: '◀', color: TEXT_COLORS.request })
    if (line.note) grid.write(4, ++y, line.note, { color: TEXT_COLORS.muted })
    y += 2
  }
  return grid.cells
}

export function describe(reel: MathReel, step: MathStep) {
  const labelOf = (id: string) => {
    const line = reel.lines.find((candidate) => candidate.id === id)
    return line?.note ?? (line ? texToText(line.tex) : id)
  }
  return { text: describeStage(step, labelOf), style: 'request' as const }
}
