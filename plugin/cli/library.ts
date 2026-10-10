// Organising the reel library: the same operations the desktop app offers, for the CLI.
// A reel's *name* is its path inside the library without `.json`, e.g. `web/cors`.
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'

const exists = (path: string) => stat(path).then(() => true, () => false)

/** One file or folder name: no separators, nothing hidden, nothing a file system would reject. */
export function checkName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("A name can't be empty.")
  if (trimmed.startsWith('.')) throw new Error(`"${trimmed}": a name can't start with a dot.`)
  if (/[/\\:*?"<>|]/.test(trimmed)) throw new Error(`"${trimmed}": a name can't contain any of / \\ : * ? " < > |`)
  // Windows refuses these whatever follows them, and drops a dot from the end.
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(trimmed) || trimmed.endsWith('.')) throw new Error(`"${trimmed}": that name is not allowed on Windows, so it is not allowed here.`)
  return trimmed
}

/** Splits `web/cors` into checked parts; `.` or an empty string means the top level. */
function parts(name: string) {
  const cleaned = name.replaceAll('\\', '/').replace(/^\.?\/+|\/+$/g, '')
  return cleaned === '' || cleaned === '.' ? [] : cleaned.split('/').map(checkName)
}

export function folderPath(root: string, folder: string) {
  return join(root, ...parts(folder))
}

export function reelPath(root: string, name: string) {
  const all = parts(name.replace(/\.json$/, ''))
  if (all.length === 0) throw new Error('Give the name of a reel.')
  return `${join(root, ...all)}.json`
}

export async function existingReel(root: string, name: string) {
  const path = reelPath(root, name)
  if (!(await exists(path))) throw new Error(`There is no reel called "${name}". Run "sworeel list" to see the library.`)
  return path
}

/**
 * Checks nothing is at `path` yet. `from` is what is about to be renamed to it: where upper and
 * lower case are the same file, renaming `Cors` to `cors` finds itself there, which is fine.
 */
async function unused(path: string, what: string, from?: string) {
  const [there, moving] = await Promise.all([stat(path).catch(() => null), from ? stat(from).catch(() => null) : null])
  const isItself = there !== null && moving !== null && there.ino === moving.ino && there.dev === moving.dev && path !== from
  if (there && !isItself) throw new Error(`${what} already exists.`)
  return path
}

/** Every reel under a folder of the library (all of it by default), as names such as `web/cors`. */
export async function reelNames(root: string, folder = '') {
  const entries = await readdir(folderPath(root, folder), { recursive: true, withFileTypes: true }).catch(() => [])
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).slice(0, -'.json'.length).split(sep).join('/'))
    .filter((name) => !name.split('/').some((part) => part.startsWith('.')))
    .sort()
}

const folderOf = (name: string) => parts(name.replace(/\.json$/, '')).slice(0, -1)
const joined = (folder: string[], name: string) => [...folder, name].join('/')

/** Renames a reel within its folder. Returns its new name. */
export async function renameReel(root: string, name: string, newName: string) {
  const from = await existingReel(root, name)
  const result = joined(folderOf(name), checkName(newName.replace(/\.json$/, '')))
  await rename(from, await unused(reelPath(root, result), `A reel called "${result}"`, from))
  return result
}

/** Moves a reel to another folder, creating the folder if needed. Returns its new name. */
export async function moveReel(root: string, name: string, folder: string) {
  const from = await existingReel(root, name)
  const result = joined(parts(folder), parts(name.replace(/\.json$/, '')).at(-1)!)
  const to = await unused(reelPath(root, result), `A reel called "${result}"`)
  await mkdir(dirname(to), { recursive: true })
  await rename(from, to)
  return result
}

/** Copies a reel, as `newName` in the same folder or as "<name> copy". Returns the copy's name. */
export async function duplicateReel(root: string, name: string, newName?: string) {
  const from = await existingReel(root, name)
  const folder = folderOf(name)
  const base = parts(name.replace(/\.json$/, '')).at(-1)!
  let result = joined(folder, newName ? checkName(newName.replace(/\.json$/, '')) : `${base} copy`)
  for (let n = 2; !newName && (await exists(reelPath(root, result))); n++) result = joined(folder, `${base} copy ${n}`)
  await copyFile(from, await unused(reelPath(root, result), `A reel called "${result}"`))
  return result
}

export async function createFolder(root: string, folder: string) {
  if (parts(folder).length === 0) throw new Error('Give the name of a folder.')
  await mkdir(await unused(folderPath(root, folder), `A folder called "${folder}"`), { recursive: true })
}

/** Renames a folder in place. Returns its new path within the library. */
export async function renameFolder(root: string, folder: string, newName: string) {
  const from = await existingFolder(root, folder)
  const result = joined(parts(folder).slice(0, -1), checkName(newName))
  await rename(from, await unused(folderPath(root, result), `A folder called "${result}"`, from))
  return result
}

/** Moves a folder, with everything in it, into another folder (`.` for the top level). Returns its new path within the library. */
export async function moveFolder(root: string, folder: string, into: string) {
  const from = await existingFolder(root, folder)
  const moving = parts(folder)
  const target = parts(into)
  if (target.slice(0, moving.length).join('/') === moving.join('/')) throw new Error("A folder can't be moved into itself.")
  const result = joined(target, moving.at(-1)!)
  const to = await unused(folderPath(root, result), `A folder called "${result}"`)
  await mkdir(dirname(to), { recursive: true })
  await rename(from, to)
  return result
}

export async function existingFolder(root: string, folder: string) {
  if (parts(folder).length === 0) throw new Error('Give the name of a folder.')
  const path = folderPath(root, folder)
  if (!(await stat(path).then((info) => info.isDirectory(), () => false))) throw new Error(`There is no folder called "${folder}".`)
  return path
}

/**
 * Finds the image a reel names: an absolute path, a file in the picture store, or (as older
 * reels have it) a path from the reel's own folder. Undefined when it is nowhere.
 */
export function findPicture(store: string, src: string, reelFile: string) {
  const candidates = isAbsolute(src) ? [src] : [join(store, src), resolve(dirname(reelFile), src)]
  return candidates.find((file) => existsSync(file))
}

/**
 * Copies an image into the picture store and returns the name reels should use for it.
 * The same image added twice keeps one copy; a different image with the same name gets a
 * number on the end.
 */
export async function addAsset(store: string, file: string, wanted?: string) {
  if (!/\.(png|jpe?g)$/i.test(file)) throw new Error('Pictures must be PNG or JPEG files.')
  const bytes = await readFile(file).catch(() => {
    throw new Error(`Could not read ${file}`)
  })
  return addPicture(store, bytes, `${wanted ?? basename(file).replace(/\.(png|jpe?g)$/i, '')}${extname(file)}`)
}

/** Puts an image's bytes in the picture store under a file name, and returns the name it got. */
export async function addPicture(store: string, bytes: Buffer, fileName: string) {
  if (!/\.(png|jpe?g)$/i.test(fileName)) throw new Error('Pictures must be PNG or JPEG files.')
  // Go by what the file is, not what it is called.
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const isJpeg = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
  if (!isPng && !isJpeg) throw new Error(`"${fileName}" is not a PNG or JPEG image.`)
  const extension = extname(fileName).toLowerCase()
  const base = checkName(fileName.replace(/\.(png|jpe?g)$/i, ''))
  await mkdir(store, { recursive: true })
  for (let n = 1; ; n++) {
    const name = `${base}${n === 1 ? '' : `-${n}`}${extension}`
    const existing = await readFile(join(store, name)).catch(() => null)
    if (existing?.equals(bytes)) return name
    if (!existing) {
      await writeFile(join(store, name), bytes)
      return name
    }
  }
}
