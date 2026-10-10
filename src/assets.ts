// Gets ready the things a reel needs beyond its own file: typeset formulas, loaded pictures.
import type { Backend } from '@/backend.ts'
import type { Assets, Formula } from '../plugin/core/canvas.ts'
import { sourcesOf } from '../plugin/core/kinds/picture.ts'
import { kindOf, type PictureReel, type Reel } from '../plugin/core/reel.ts'

const makePath = (d: string) => new Path2D(d)

/** What every reel can be drawn with, before or without anything being prepared. */
export const BASE: Assets = { makePath }

/**
 * Typesets a maths reel's formulas and loads a picture reel's image.
 * Throws when the TeX is wrong or the image can't be read.
 */
export async function prepare(reel: Reel, reelPath: string, backend: Backend): Promise<Assets> {
  const assets: Assets = { makePath }

  if (kindOf(reel) === 'math' && 'lines' in reel) {
    // MathJax is large, so it is only fetched for reels that need it.
    const { typeset } = await import('../plugin/host/typeset.ts')
    assets.formulas = new Map<string, Formula>()
    for (const line of reel.lines) assets.formulas.set(line.tex, typeset(line.tex, makePath))
  }

  if (kindOf(reel) === 'picture') {
    assets.images = new Map()
    for (const src of sourcesOf(reel as PictureReel)) {
      const image = await createImageBitmap(new Blob([await backend.readPicture(reelPath, src)]))
      assets.images.set(src, { image, width: image.width, height: image.height })
    }
  }

  return assets
}
