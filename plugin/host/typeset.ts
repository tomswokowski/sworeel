// Typesets TeX with MathJax and reduces the result to filled paths the renderer can draw.
// Used by the hosts (the CLI and the desktop app), never by the reel core, which has to run
// where no packages can be loaded.
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import type { LiteElement } from 'mathjax-full/js/adaptors/lite/Element.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js'
import { mathjax } from 'mathjax-full/js/mathjax.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import type { Formula } from '../core/canvas.ts'

const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)
// Without the two "no errors" packages, a mistake in the TeX is reported instead of drawn in red.
const packages = AllPackages.filter((name) => name !== 'noerrors' && name !== 'noundefined')
const document = mathjax.document('', { InputJax: new TeX({ packages }), OutputJax: new SVG({ fontCache: 'none' }) })

/** Where a shape ends up: scaled, then moved. MathJax's output uses nothing but these two. */
type Placement = { sx: number; sy: number; tx: number; ty: number }

function transformed(at: Placement, transform: string | null): Placement {
  let { sx, sy, tx, ty } = at
  for (const [, name, list] of (transform ?? '').matchAll(/(\w+)\(([^)]*)\)/g)) {
    const [a = 0, b] = list!.split(/[\s,]+/).filter(Boolean).map(Number)
    if (name === 'translate') {
      tx += sx * a
      ty += sy * (b ?? 0)
    } else if (name === 'scale') {
      sx *= a
      sy *= b ?? a
    } else {
      throw new Error(`This formula uses a transform SwoReel cannot draw (${name}).`)
    }
  }
  return { sx, sy, tx, ty }
}

/**
 * Typesets one formula. `makePath` turns an SVG path string into the host's own path object.
 * Throws with MathJax's message when the TeX is not valid.
 */
export function typeset(tex: string, makePath: (d: string) => unknown): Formula {
  const svg = adaptor.firstChild(document.convert(tex, { display: true })) as LiteElement
  const [minX = 0, minY = 0, width = 0, height = 0] = (adaptor.getAttribute(svg, 'viewBox') ?? '').split(/\s+/).map(Number)
  const shapes: Formula['shapes'] = []

  const walk = (node: LiteElement, at: Placement) => {
    const error = adaptor.getAttribute(node, 'data-mjx-error')
    if (error) throw new Error(`"${tex}" is not valid TeX: ${error}`)
    const here = transformed(at, adaptor.getAttribute(node, 'transform'))
    const kind = adaptor.kind(node)

    // Coordinates are in thousandths of an em; shapes are handed on in ems.
    const add = (d: string) => shapes.push({ path: makePath(d), x: (here.tx - minX) / 1000, y: (here.ty - minY) / 1000, scaleX: here.sx / 1000, scaleY: here.sy / 1000 })
    const attr = (name: string) => Number(adaptor.getAttribute(node, name) ?? 0)
    if (kind === 'path') add(adaptor.getAttribute(node, 'd'))
    else if (kind === 'rect') add(`M${attr('x')} ${attr('y')}h${attr('width')}v${attr('height')}h${-attr('width')}Z`)
    else if (kind === 'svg' && node !== svg) {
      // A nested drawing: placed at x, y and stretched from its own view box to its size.
      const [x0 = 0, y0 = 0, w = 1, h = 1] = (adaptor.getAttribute(node, 'viewBox') ?? '').split(/\s+/).map(Number)
      const inner = transformed(here, `translate(${attr('x')},${attr('y')}) scale(${attr('width') / w},${attr('height') / h}) translate(${-x0},${-y0})`)
      for (const child of adaptor.childNodes(node)) if (adaptor.kind(child) !== '#text') walk(child as LiteElement, inner)
      return
    }
    for (const child of adaptor.childNodes(node)) if (adaptor.kind(child) !== '#text') walk(child as LiteElement, here)
  }
  walk(svg, { sx: 1, sy: 1, tx: 0, ty: 0 })

  return { width: width / 1000, height: height / 1000, shapes }
}
