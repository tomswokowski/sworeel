// Gets ready the things a reel needs beyond its own file: typeset formulas, loaded pictures.
import { loadImage, Path2D } from '@napi-rs/canvas'
import type { Assets, Formula } from '../core/canvas.ts'
import { sourcesOf } from '../core/kinds/picture.ts'
import { kindOf, type PictureReel, type Reel } from '../core/reel.ts'
import { findPicture } from './library.ts'
import { assetsFolder } from './paths.ts'

const makePath = (d: string) => new Path2D(d)

/**
 * Typesets a maths reel's formulas and loads a picture reel's image.
 * Throws a readable error when the TeX is wrong or the image can't be read.
 */
export async function prepare(reel: Reel, reelPath: string): Promise<Assets> {
  const assets: Assets = { makePath }

  if (kindOf(reel) === 'math' && 'lines' in reel) {
    // MathJax is large and slow to start, so it is only loaded for reels that need it.
    const { typeset } = await import('../host/typeset.ts')
    assets.formulas = new Map<string, Formula>()
    for (const line of reel.lines) assets.formulas.set(line.tex, typeset(line.tex, makePath))
  }

  if (kindOf(reel) === 'picture') {
    assets.images = new Map()
    for (const src of sourcesOf(reel as PictureReel)) {
      const file = findPicture(assetsFolder(), src, reelPath)
      if (!file) throw new Error(`There is no picture called "${src}". Add it with: sworeel asset add <file>`)
      const image = await loadImage(file).catch(() => {
        throw new Error(`Could not read the picture ${file}`)
      })
      assets.images.set(src, { image, width: image.width, height: image.height })
    }
  }

  return assets
}
