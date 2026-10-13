// An in-memory library for working on the interface in a browser (`npm run dev`).
// Never included in the built app.
import type { Backend } from '../backend.ts'
import type { Format } from '../../plugin/core/render.ts'

const ROOT = '/mock/reels'
const fixtures = import.meta.glob<string>('./fixtures/*.json', { query: '?raw', import: 'default', eager: true })

const files = new Map<string, { text: string; modified: number }>()
const folders = new Set<string>(['web', 'web/auth', 'drafts'])

for (const [file, text] of Object.entries(fixtures)) {
  const name = file.split('/').pop()!
  files.set(`${ROOT}/${name === 'two-addresses.json' ? 'web/' : ''}${name}`, { text, modified: Date.now() })
}
files.set(`${ROOT}/drafts/broken.json`, { text: '{ "title": "Half-written" }', modified: Date.now() - 60_000 })
// `?empty` shows the app as it is before any reel has been made.
if (new URLSearchParams(location.search).has('empty')) {
  files.clear()
  folders.clear()
}

const folderOf = (path: string) => path.slice(ROOT.length + 1).split('/').slice(0, -1).join('/')
const nameOf = (path: string) => path.split('/').pop()!.replace(/\.json$/, '')
const inFolder = (folder: string, name: string) => `${ROOT}/${folder ? `${folder}/` : ''}${name}.json`

function checkName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw "The name can't be empty."
  if (/[/\\:*?"<>|]/.test(trimmed) || trimmed.startsWith('.')) throw "That name isn't allowed."
  return trimmed
}

function relocate(from: string, to: string) {
  if (files.has(to)) throw `"${nameOf(to)}" already exists there.`
  // A rename keeps the file's time, as it does on disk.
  files.set(to, files.get(from)!)
  files.delete(from)
  return to
}

let exports = '/mock/Documents/SwoReel'
const settings = { watermark: '', progress: false, suggest: true, theme: {}, formats: ['wide'] as Format[], fps: 30 }
// With `?request` in the address, the mock asks for one reel at once, as `sworeel app` would.
let request: { reel: string | null } | null = new URLSearchParams(location.search).has('request') ? { reel: 'web/two-addresses' } : null

/** Gives a folder a new path, taking its subfolders and reels with it. */
function relabel(folder: string, renamed: string) {
  if (folders.has(renamed)) throw `"${renamed}" already exists there.`
  const swap = (value: string) => (value === folder || value.startsWith(`${folder}/`) ? renamed + value.slice(folder.length) : value)
  for (const old of [...folders]) {
    folders.delete(old)
    folders.add(swap(old))
  }
  for (const [path, file] of [...files]) {
    files.delete(path)
    files.set(`${ROOT}/${swap(path.slice(ROOT.length + 1))}`, file)
  }
}

export const mockBackend: Backend = {
  // A fresh copy all the way down, as the real app gets: it reads the settings file each time.
  settings: async () => structuredClone(settings),
  setSetting: async (key, value) => {
    if (key === 'watermark') settings.watermark = value.trim()
    else if (key === 'progress') settings.progress = value === 'on'
    else if (key === 'suggest') settings.suggest = value === 'on'
    else if (key === 'formats') settings.formats = value.split(',') as Format[]
    else if (key === 'fps') settings.fps = Number(value)
    else if (key === 'exports') exports = value
  },
  setShowing: async () => {},
  takeRequest: async () => {
    const taken = request
    request = null
    return taken
  },
  paths: async () => ({ reels: ROOT, exports }),
  list: async () => ({
    reels: [...files].map(([path, file]) => ({ path, name: nameOf(path), folder: folderOf(path), modified: file.modified })),
    folders: [...folders].sort(),
  }),
  read: async (path) => files.get(path)!.text,
  readPicture: async () => {
    throw 'The mock library has no pictures.'
  },
  renameReel: async (path, name) => relocate(path, inFolder(folderOf(path), checkName(name))),
  moveReel: async (path, folder) => relocate(path, inFolder(folder, nameOf(path))),
  duplicateReel: async (path) => {
    // Numbered when "copy" is taken, as the command does it.
    let copy = inFolder(folderOf(path), `${nameOf(path)} copy`)
    for (let n = 2; files.has(copy); n++) copy = inFolder(folderOf(path), `${nameOf(path)} copy ${n}`)
    files.set(copy, { text: files.get(path)!.text, modified: Date.now() })
    return copy
  },
  deleteReel: async (path) => void files.delete(path),
  createFolder: async (parent, name) => {
    const folder = `${parent ? `${parent}/` : ''}${checkName(name)}`
    if (folders.has(folder)) throw `"${name}" already exists there.`
    folders.add(folder)
  },
  moveFolder: async (folder, into) => {
    if (into === folder || into.startsWith(`${folder}/`)) throw "A folder can't be moved into itself."
    relabel(folder, `${into ? `${into}/` : ''}${folder.split('/').pop()}`)
  },
  renameFolder: async (folder, name) => {
    relabel(folder, [...folder.split('/').slice(0, -1), checkName(name)].join('/'))
  },
  deleteFolder: async (folder) => {
    for (const old of [...folders]) if (old === folder || old.startsWith(`${folder}/`)) folders.delete(old)
    for (const path of [...files.keys()]) if (folderOf(path) === folder || folderOf(path).startsWith(`${folder}/`)) files.delete(path)
  },
  exportReel: async (path, what, format, step) => {
    await new Promise((done) => setTimeout(done, 600))
    const base = `/mock/Documents/SwoReel/${nameOf(path)}`
    if (what === 'videos') return settings.formats.map((each) => `${base}-${each}.mp4`)
    if (what === 'stills') return [`${base}-${format}-stills`]
    return [what === 'video' ? `${base}-${format}.mp4` : `${base}-${format}-step${step}.png`]
  },
  bundle: async (name) => `/mock/Documents/SwoReel/${name === '.' ? 'sworeel-library' : name.replace(/\/$/, '').split('/').pop()}.sworeel`,
  importBundle: async (text) => {
    const bundle = JSON.parse(text) as { sworeel?: number; reels: { name: string; reel: unknown }[] }
    if (bundle.sworeel !== 1) throw 'That is not a SwoReel bundle, or it was made by a newer version of SwoReel.'
    // Nothing already there is replaced, as with the command.
    const added = bundle.reels.filter(({ name }) => !files.has(`${ROOT}/${name}.json`))
    for (const { name, reel } of added) files.set(`${ROOT}/${name}.json`, { text: JSON.stringify(reel), modified: Date.now() })
    return added.length ? `Imported ${added.length === 1 ? '1 reel' : `${added.length} reels`}: ${added.map((each) => each.name).join(', ')}` : ''
  },
  open: async (path) => console.log('open', path),
  // `?noplugin` shows the app as it is before the plugin has been installed.
  pluginFound: async () => !new URLSearchParams(location.search).has('noplugin'),
  openSite: async (site) => console.log('open site', site),
  updateReady: async () => null,
  restartToUpdate: async () => {},
}
