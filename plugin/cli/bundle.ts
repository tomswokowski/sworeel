// Packing reels into one file to carry to another computer, and unpacking them there.
// A bundle holds the reels and every picture they use, so nothing is left behind.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { addPicture, checkName, findPicture, folderPath, reelNames, reelPath } from './library.ts'
import { validateReel } from '../core/reel.ts'

/** What a `.sworeel` file holds. */
interface Bundle {
  /** The version of this layout. */
  sworeel: 1
  /** Each reel under its name in the library, folders included (`web/cors`). */
  reels: { name: string; reel: Record<string, unknown> }[]
  /** The pictures those reels use, by the name the reels call them, as base64. */
  pictures: Record<string, string>
}

type Sourced = { src?: unknown; steps?: unknown }

/** Gives every picture a reel names a new name, on the reel itself and on its steps. */
function renameSources(reel: Sourced, rename: (src: string) => string) {
  if (typeof reel.src === 'string') reel.src = rename(reel.src)
  if (!Array.isArray(reel.steps)) return
  for (const step of reel.steps as Sourced[]) {
    if (step && typeof step === 'object' && typeof step.src === 'string') step.src = rename(step.src)
  }
}

const isFile = (path: string) => stat(path).then((found) => found.isFile(), () => false)
const isFolder = (path: string) => stat(path).then((found) => found.isDirectory(), () => false)

/**
 * The reels that names stand for: a reel is itself, a folder is every reel inside it, and `.`
 * is the whole library. A name ending in `/` is always a folder.
 */
export async function reelsNamed(root: string, names: string[]) {
  const found = new Set<string>()
  for (const name of names) {
    if (!name.endsWith('/') && name !== '.' && (await isFile(reelPath(root, name)))) {
      found.add(name.replace(/\.json$/, ''))
      continue
    }
    if (!(await isFolder(folderPath(root, name)))) throw new Error(`There is no reel or folder called "${name}". Run "sworeel list" to see the library.`)
    for (const inside of await reelNames(root, name)) found.add(inside)
  }
  if (found.size === 0) throw new Error('There are no reels there to bundle.')
  return [...found].sort()
}

/** Packs the named reels, and the pictures they use, into one bundle. */
export async function makeBundle(root: string, store: string, names: string[]): Promise<Bundle> {
  const bundle: Bundle = { sworeel: 1, reels: [], pictures: {} }
  for (const name of names) {
    const path = reelPath(root, name)
    let reel: Record<string, unknown>
    try {
      reel = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
    } catch (error) {
      throw new Error(`"${name}" could not be read, so it can't be bundled: ${(error as Error).message}`)
    }
    const problems = validateReel(reel)
    if (problems.length) throw new Error(`"${name}" is not a valid reel, so it can't be bundled:\n${problems.join('\n')}`)

    const pending: [string, string][] = []
    renameSources(reel, (src) => (pending.push([src, basename(src)]), src))
    const renamed = new Map<string, string>()
    for (const [src, wanted] of pending) {
      const file = findPicture(store, src, path)
      if (!file) throw new Error(`"${name}" uses a picture called "${src}", which is missing.`)
      const data = (await readFile(file)).toString('base64')
      // Two different pictures with one name are kept apart.
      let key = wanted
      for (let n = 2; bundle.pictures[key] !== undefined && bundle.pictures[key] !== data; n++) key = wanted.replace(/(\.\w+)$/, `-${n}$1`)
      bundle.pictures[key] = data
      renamed.set(src, key)
    }
    renameSources(reel, (src) => renamed.get(src) ?? src)
    bundle.reels.push({ name, reel })
  }
  return bundle
}

/** Whether a reel file already in the library holds exactly this reel. A file that can't be read does not. */
function same(existing: string, reel: unknown) {
  try {
    return JSON.stringify(JSON.parse(existing)) === JSON.stringify(reel)
  } catch {
    return false
  }
}

function readBundle(text: string): Bundle {
  let bundle: Partial<Bundle>
  try {
    bundle = JSON.parse(text) as Partial<Bundle>
  } catch {
    throw new Error('That is not a SwoReel bundle: it could not be read.')
  }
  if (bundle?.sworeel !== 1 || !Array.isArray(bundle.reels)) throw new Error('That is not a SwoReel bundle, or it was made by a newer version of SwoReel.')
  return { sworeel: 1, reels: bundle.reels, pictures: bundle.pictures ?? {} }
}

/**
 * Unpacks a bundle into the library, under `into` if given. Nothing already there is replaced:
 * a reel that is already present unchanged is skipped, and one that differs arrives beside it
 * with a number on its name. Returns the names of what was added and what was skipped.
 */
export async function importBundle(root: string, store: string, text: string, into = '') {
  const bundle = readBundle(text)

  // Check everything before writing anything, so a bad bundle leaves the library as it was:
  // every reel's name and contents, where they would go, and every picture's name.
  for (const { name, reel } of bundle.reels) {
    if (typeof name !== 'string') throw new Error('The bundle holds a reel with no name.')
    const problems = validateReel(reel)
    if (problems.length) throw new Error(`The bundle's reel "${name}" is not valid:\n${problems.join('\n')}`)
    reelPath(root, [into, name].filter(Boolean).join('/'))
  }
  for (const name of Object.keys(bundle.pictures)) {
    if (!/\.(png|jpe?g)$/i.test(name)) throw new Error(`The bundle's picture "${name}" is not a PNG or JPEG file.`)
    checkName(name.replace(/\.(png|jpe?g)$/i, ''))
  }

  // Only the pictures its reels use are taken; anything else in the file is ignored.
  const used = new Set<string>()
  for (const { reel } of bundle.reels) renameSources(reel, (src) => (used.add(src), src))
  for (const src of used) {
    if (typeof bundle.pictures[src] !== 'string') throw new Error(`The bundle is missing the picture "${src}" that one of its reels uses.`)
  }

  const stored = new Map<string, string>()
  for (const [name, data] of Object.entries(bundle.pictures)) {
    if (!used.has(name)) continue
    stored.set(name, await addPicture(store, Buffer.from(data, 'base64'), name))
  }

  const added: string[] = []
  const skipped: string[] = []
  for (const { name, reel } of bundle.reels) {
    renameSources(reel, (src) => stored.get(src) ?? src)
    const text = `${JSON.stringify(reel, null, 2)}\n`
    const wanted = [into.replace(/\/+$/, ''), name].filter(Boolean).join('/')
    for (let n = 1; ; n++) {
      const target = n === 1 ? wanted : `${wanted}-${n}`
      const path = reelPath(root, target)
      const existing = await readFile(path, 'utf8').catch(() => null)
      if (existing !== null && same(existing, reel)) {
        skipped.push(target)
        break
      }
      if (existing === null) {
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, text)
        added.push(target)
        break
      }
    }
  }
  return { added, skipped }
}
