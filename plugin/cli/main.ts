// sworeel: validate reel files and render them to PNG stills or MP4 video.
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, delimiter, dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { createCanvas } from '@napi-rs/canvas'
import { prepare } from './assets.ts'
import { browse, play, showText } from './terminal.ts'
import { trash } from './trash.ts'
import { registerFonts } from './fonts.ts'
import * as library from './library.ts'
import { importBundle, makeBundle, reelsNamed } from './bundle.ts'
import { assetsFolder, configFile, expandHome, exportsFolder, readConfig, requestFile, reelsFolder, showingFile, styleFile, writeConfig } from './paths.ts'
import { DEFAULT_THEME, isColor, THEME_KEYS, type Theme } from '../core/theme.ts'
import { drawReel, FORMATS, type Context2D, type DrawOptions, type Format } from '../core/render.ts'
import { ICON_NAMES } from '../core/data/icons.ts'
import { parseReel, type Reel } from '../core/reel.ts'
import { playheadAt, stepRestTime, timeline } from '../core/timing.ts'

/** Above this, `validate` suggests splitting the reel. */
const MANY_STEPS = 20

// Everything below reads the settings, so a settings file that can't be read stops here with
// a sentence about it, whatever the command.
const CONFIG = (() => {
  try {
    return readConfig()
  } catch (error) {
    return fail((error as Error).message)
  }
})()
const LIBRARY = reelsFolder()
/** Settings that change how every frame is drawn. */
const DRAW: DrawOptions = { watermark: CONFIG.watermark, progress: CONFIG.progress === true, theme: CONFIG.theme }

const USAGE = `Usage:
  Make
    sworeel validate <reel>
    sworeel info <reel>                     Steps, timings and total length
    sworeel still <reel> [--format wide|tall|square] [--step N] [--out file.png]
                                            One step as an image: the last by default, 0 for before the first
    sworeel stills <reel> [--format wide|tall|square]      Every step as an image, in a folder
    sworeel render <reel> [--format wide|tall|square] [--fps N] [--out file.mp4]
                                            With no --format, renders each of your default formats

  Watch
    sworeel show <reel> [--step N] [--color]  The reel and its steps as text; --color for a terminal
    sworeel play [reel]                     Play it, animated, in the terminal; with no reel, pick one
    sworeel app [reel]                      Show it in the desktop app, starting the app if needed
    sworeel showing [--json]                Which reel and step the desktop app is on

  Organise
    sworeel list [--json]                   Reels in the library
    sworeel rename <reel> <new-name>
    sworeel move <reel> <folder>            Use . for the top level; the folder is created if needed
    sworeel duplicate <reel> [new-name]
    sworeel delete <reel>...                Moves reels to the system trash
    sworeel folder create <folder>
    sworeel folder rename <folder> <new-name>
    sworeel folder move <folder> <into>     Use . for the top level
    sworeel folder delete <folder>          Moves the folder and its reels to the system trash
    sworeel asset add <image> [name]        Store a picture for reels to use; prints the name to use as "src"
    sworeel asset list                      The pictures in the store

  Move between computers
    sworeel bundle <reel|folder>... [--out file.sworeel]
                                            Pack reels and their pictures into one file; a folder
                                            takes every reel in it, . the whole library
    sworeel import <file.sworeel> [--into folder]
                                            Add a bundle's reels to the library; nothing is replaced

  Look around
    sworeel exports [--json]                Exported videos and stills, newest first
    sworeel open <reels|exports|file>       Show a folder or file in the desktop's default app
    sworeel icons                           The icons a reel can use
    sworeel paths [--json]                  Where reels, pictures, exports and settings live

  Settings
    sworeel config                          Show the settings
    sworeel config watermark <text>         Credit every export, e.g. "@you"; leave the text out to remove it
    sworeel config progress <on|off>        Show or hide the step dots at the bottom of every export
    sworeel config formats <list>           Default video formats, e.g. wide,tall
    sworeel config fps <N>                  Frames per second for video
    sworeel config theme                    The colours every reel is drawn in
    sworeel config theme <colour> <#hex>    Change one, e.g. theme primary "#ff6600"; "reset" in place of
                                            the hex puts one back, and "theme reset" all of them
    sworeel config exports <folder>         Keep exports somewhere else
    sworeel config reels <folder>           Keep reels somewhere else; the library is copied there
    sworeel config app <path>               Where the desktop app is, if "sworeel app" can't find it
    sworeel style                           Your standing preferences for how reels are made
    sworeel style add "<preference>"        Note one down, e.g. "Keep captions under ten words"
    sworeel style remove <N>                Remove the Nth

<reel> is a reel's name in the library, including its folder (web/cors). validate, info, still,
stills, render, show and play also accept a path to any .json file. Stills and videos go to the
exports folder unless --out is given. Put -- before text that starts with a dash.`

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

/** The file a reel is read from: a name in the library, or a path to any `.json` file. */
function reelPath(name: string) {
  return name.endsWith('.json') ? resolve(name) : join(LIBRARY, `${name}.json`)
}

/**
 * Reads a reel. `id` is what its exports are named after: the reel's name with its folders, so
 * that `web/cors` and `db/cors` export to different files.
 */
async function load(name: string): Promise<{ reel: Reel; id: string; path: string }> {
  const path = reelPath(name)
  const text = await readFile(path, 'utf8').catch(() => fail(`No reel file at ${path}`))
  const id = name.endsWith('.json') ? basename(path, '.json') : name.split('/').filter(Boolean).join('-')
  try {
    return { reel: parseReel(text), id, path }
  } catch (error) {
    fail(`${path} is not a valid reel:\n${(error as Error).message}`)
  }
}

/** Loads a reel and everything it needs to be drawn: its formulas typeset, its picture read. */
async function loadToDraw(name: string) {
  const loaded = await load(name)
  try {
    return { ...loaded, draw: { ...DRAW, ...(await prepare(loaded.reel, loaded.path)) } }
  } catch (error) {
    fail(`${loaded.path} can't be drawn:\n${(error as Error).message}`)
  }
}

async function still(name: string, format: Format, stepNumber: number | undefined, out: string | undefined) {
  const { reel, id, draw } = await loadToDraw(name)
  const step = stepNumber ?? reel.steps.length
  if (!Number.isInteger(step) || step < 0 || step > reel.steps.length) {
    fail(`--step must be between 0 (before the first step) and ${reel.steps.length}.`)
  }
  const path = resolve(out ?? join(exportsFolder(), `${id}-${format}-step${step}.png`))
  await mkdir(dirname(path), { recursive: true })
  const { w, h } = FORMATS[format]
  const canvas = createCanvas(w, h)
  drawReel(canvas.getContext('2d') as unknown as Context2D, reel, format, playheadAt(reel, step === 0 ? 0 : stepRestTime(reel, step - 1)), draw)
  await writeFile(path, canvas.toBuffer('image/png'))
  console.log(path)
}

/** Saves every step of a reel as an image, in a folder of its own. */
async function stills(name: string, format: Format) {
  const { reel, id, draw } = await loadToDraw(name)
  const folder = join(exportsFolder(), `${id}-${format}-stills`)
  await mkdir(folder, { recursive: true })
  const { w, h } = FORMATS[format]
  const canvas = createCanvas(w, h)
  const digits = String(reel.steps.length).length
  for (let step = 1; step <= reel.steps.length; step++) {
    drawReel(canvas.getContext('2d') as unknown as Context2D, reel, format, playheadAt(reel, stepRestTime(reel, step - 1)), draw)
    await writeFile(join(folder, `step-${String(step).padStart(digits, '0')}.png`), canvas.toBuffer('image/png'))
  }
  console.log(folder)
}

async function render(name: string, format: Format, fps: number, out: string | undefined) {
  const { reel, id, draw } = await loadToDraw(name)
  const { w, h } = FORMATS[format]
  const path = resolve(out ?? join(exportsFolder(), `${id}-${format}.mp4`))
  await mkdir(dirname(path), { recursive: true })

  // Raw frames in, H.264 out, with settings that X and TikTok both accept. The video is made
  // under another name and moved into place when it is whole, so a failure never leaves a
  // broken file where a good one was expected.
  const draft = join(dirname(path), `.${basename(path, '.mp4')}.rendering.mp4`)
  const ffmpeg = spawn(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', draft],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  )
  ffmpeg.on('error', () => fail('Could not run ffmpeg. Is it installed?'))
  const closed = once(ffmpeg, 'close')
  // If ffmpeg stops early, writing to it fails; its exit code below says why.
  let stopped = false
  ffmpeg.stdin.on('error', () => (stopped = true))

  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d') as unknown as Context2D
  const frames = Math.ceil((timeline(reel).duration / 1000) * fps)
  for (let i = 0; i < frames && !stopped; i++) {
    drawReel(ctx, reel, format, playheadAt(reel, (i / fps) * 1000), draw)
    if (!ffmpeg.stdin.write(canvas.data())) await Promise.race([once(ffmpeg.stdin, 'drain'), closed])
  }
  ffmpeg.stdin.end()

  const [code] = await closed
  if (code !== 0) {
    await rm(draft, { force: true })
    fail(`ffmpeg could not make the video (it exited with code ${code}).`)
  }
  await rename(draft, path)
  console.log(path)
}

async function info(name: string) {
  const { reel } = await load(name)
  const { starts, duration } = timeline(reel)
  console.log(`${reel.title}: ${reel.steps.length} steps, ${(duration / 1000).toFixed(1)}s`)
  reel.steps.forEach((step, i) => console.log(`  ${String(i + 1).padStart(2)}  ${(starts[i]! / 1000).toFixed(1).padStart(5)}s  ${step.caption}`))
}

/** Every reel in the library with its title and length, or what is wrong with it. */
async function libraryReels() {
  return Promise.all(
    (await library.reelNames(LIBRARY)).map(async (name) => {
      try {
        const reel = parseReel(await readFile(reelPath(name), 'utf8'))
        return { name, title: reel.title, steps: reel.steps.length, seconds: Math.round(timeline(reel).duration / 100) / 10 }
      } catch (error) {
        return { name, error: (error as Error).message.split('\n')[0]! }
      }
    }),
  )
}

async function list(json: boolean) {
  const reels = await libraryReels()
  if (json) return console.log(JSON.stringify(reels, null, 2))
  if (reels.length === 0) return console.log(`No reels yet in ${LIBRARY}`)
  const width = Math.max(...reels.map((reel) => reel.name.length))
  for (const reel of reels) {
    const detail = 'error' in reel ? `INVALID: ${reel.error}` : `${reel.title} (${reel.steps} steps, ${reel.seconds}s)`
    console.log(`${reel.name.padEnd(width)}  ${detail}`)
  }
}

/**
 * Shows a reel in the desktop app, starting the app if it isn't running.
 * The request is a small file the app watches for; if nothing picks it up, the app is not open.
 */
async function openInApp(name: string | undefined) {
  if (name) await library.existingReel(LIBRARY, name)
  await mkdir(dirname(requestFile), { recursive: true })
  await writeFile(requestFile, JSON.stringify({ reel: name ?? null, at: Date.now() }))

  const taken = async () => !(await stat(requestFile).then(() => true, () => false))
  for (let waited = 0; waited < 1800; waited += 150) {
    if (await taken()) return console.log(name ? `Showing ${name} in the SwoReel app.` : 'The SwoReel app is open.')
    await new Promise((done) => setTimeout(done, 150))
  }

  // Where the app might be: where the settings say, on PATH, then where each system's
  // installer puts it.
  const binary = process.platform === 'win32' ? 'sworeel-app.exe' : 'sworeel-app'
  const installed =
    process.platform === 'darwin'
      ? ['/Applications/SwoReel.app/Contents/MacOS/sworeel-app', join(homedir(), 'Applications', 'SwoReel.app', 'Contents', 'MacOS', 'sworeel-app')]
      : process.platform === 'win32'
        ? [join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'SwoReel', binary), join(process.env.ProgramFiles ?? 'C:\\Program Files', 'SwoReel', binary)]
        : [join(homedir(), '.local', 'bin', binary), '/usr/bin/sworeel-app']
  const candidates = [CONFIG.app, ...(process.env.PATH ?? '').split(delimiter).map((folder) => join(folder, binary)), ...installed]
  for (const candidate of candidates) {
    if (!candidate || !(await stat(candidate).then((info) => info.isFile(), () => false))) continue
    const started = await new Promise<boolean>((done) => {
      const app = spawn(candidate, [], { detached: true, stdio: 'ignore' })
      app.once('error', () => done(false))
      app.once('spawn', () => (app.unref(), done(true)))
    })
    if (started) return console.log(name ? `Starting the SwoReel app on ${name}.` : 'Starting the SwoReel app.')
  }

  await rm(requestFile, { force: true })
  fail('The SwoReel desktop app is not installed, or is somewhere this command cannot find. Set its location with: sworeel config app <path>')
}

/**
 * Copies the library and its pictures to where the reels folder is about to be, so that
 * changing the folder does not leave every reel behind. Nothing already there is replaced, and
 * the originals are left where they are for the user to remove once they are happy.
 */
async function bringLibrary(target: string) {
  const names = await library.reelNames(LIBRARY)
  if (names.length === 0) return
  await cp(LIBRARY, target, { recursive: true, force: false, errorOnExist: false })
  await cp(assetsFolder(), join(dirname(target), 'assets'), { recursive: true, force: false, errorOnExist: false }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  })
  console.log(`Copied ${names.length === 1 ? '1 reel' : `${names.length} reels`} and their pictures to the new folder. The originals are still in ${LIBRARY}.`)
}

/** Whether a process with this id exists. Asking to signal it with 0 checks without touching it. */
function isRunning(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // Not allowed to signal it still means it is there.
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function paths(json: boolean) {
  const all = { reels: LIBRARY, pictures: assetsFolder(), exports: exportsFolder(), config: configFile, style: styleFile }
  if (json) console.log(JSON.stringify(all, null, 2))
  else for (const [name, path] of Object.entries(all)) console.log(`${name.padEnd(8)} ${path}`)
}

const { values, positionals } = (() => {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        format: { type: 'string' },
        step: { type: 'string' },
        fps: { type: 'string' },
        out: { type: 'string' },
        into: { type: 'string' },
        json: { type: 'boolean' },
        color: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    })
  } catch (error) {
    // An unknown option, or one missing its value. Text that starts with a dash goes after `--`.
    return fail(`${(error as Error).message.split('. ')[0]}.\nRun "sworeel --help" for the options. To pass text that starts with a dash, put -- before it.`)
  }
})()

async function listExports(json: boolean) {
  const folder = exportsFolder()
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => [])
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /\.(mp4|png)$/.test(entry.name))
      .map(async (entry) => ({ file: entry.name, path: join(folder, entry.name), modified: (await stat(join(folder, entry.name))).mtime })),
  )
  files.sort((a, b) => b.modified.getTime() - a.modified.getTime())
  if (json) return console.log(JSON.stringify(files, null, 2))
  if (files.length === 0) return console.log(`Nothing exported yet. Exports go to ${folder}`)
  const when = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
  for (const { file, modified } of files) console.log(`${when.format(modified)}  ${file}`)
}

/** Opens a folder or file with the desktop's default application. */
function open(target: string) {
  const path = target === 'reels' ? LIBRARY : target === 'exports' ? exportsFolder() : resolve(target)
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open'
  spawn(opener, [path], { detached: true, stdio: 'ignore' })
    .on('error', () => fail(`Could not run ${opener} to open ${path}`))
    .unref()
  console.log(path)
}

const [command, ...args] = positionals
if (values.help || !command) {
  console.log(USAGE)
  process.exit(command || values.help ? 0 : 1)
}
const isFormat = (name: unknown): name is Format => typeof name === 'string' && name in FORMATS
if (values.format !== undefined && !isFormat(values.format)) fail(`--format must be one of: ${Object.keys(FORMATS).join(', ')}.`)
/** The formats video is rendered in when none is asked for; the first is also the default for a still. */
const defaultFormats = (Array.isArray(CONFIG.formats) ? CONFIG.formats : []).filter(isFormat)
if (defaultFormats.length === 0) defaultFormats.push('wide')
const format = (values.format as Format | undefined) ?? defaultFormats[0]!

/** Reports the reel a command produced: a sentence for people, or name and path as JSON. */
function changed(verb: string, name: string) {
  if (values.json) console.log(JSON.stringify({ name, path: library.reelPath(LIBRARY, name) }))
  else console.log(`${verb} ${name}`)
}

/** `--step` as a number, or undefined when it was not given. An empty or non-numeric value is not a step. */
function stepOption() {
  if (values.step === undefined) return undefined
  return values.step.trim() === '' ? NaN : Number(values.step)
}

/** Stops with a message when an option was given to a command that has no use for it. */
function refuse(command: string, ...options: ('step' | 'out' | 'fps')[]) {
  for (const option of options) if (values[option] !== undefined) fail(`"sworeel ${command}" does not take --${option}.`)
}

/** The nth argument after the command, or exit with how the command is used. */
function arg(index: number, usage: string): string {
  return args[index] ?? fail(`Usage: sworeel ${usage}`)
}

try {
  switch (command) {
    case 'validate': {
      // Preparing it too catches what the file alone can't show: bad TeX, a missing picture.
      const { reel } = await loadToDraw(arg(0, 'validate <reel>'))
      console.log('OK')
      if (reel.steps.length > MANY_STEPS) {
        const seconds = Math.round(timeline(reel).duration / 1000)
        console.log(`Note: ${reel.steps.length} steps makes a ${Math.floor(seconds / 60)}m ${seconds % 60}s video. Reels work best at 4 to 10 steps; consider splitting this into shorter ones unless a long reel was asked for.`)
      }
      break
    }
    case 'info':
      await info(arg(0, 'info <reel>'))
      break
    case 'still':
      registerFonts()
      await still(arg(0, 'still <reel>'), format, stepOption(), values.out)
      break
    case 'stills':
      refuse('stills', 'step', 'out')
      registerFonts()
      await stills(arg(0, 'stills <reel>'), format)
      break
    case 'render': {
      const fps = Number(values.fps ?? CONFIG.fps ?? 30)
      if (!Number.isInteger(fps) || fps < 1 || fps > 60) fail('--fps must be a whole number from 1 to 60.')
      registerFonts()
      // Asked for one format, render that; otherwise each of the default formats.
      const formats = values.format ? [format] : defaultFormats
      if (values.out && formats.length > 1) fail('--out names one file, so give --format too.')
      for (const each of formats) await render(arg(0, 'render <reel>'), each, fps, values.out)
      break
    }

    case 'show': {
      const { reel } = await load(arg(0, 'show <reel> [--step N]'))
      const step = stepOption()
      if (step !== undefined && (!Number.isInteger(step) || step < 1 || step > reel.steps.length)) {
        fail(`--step must be between 1 and ${reel.steps.length}.`)
      }
      console.log(showText(reel, step, values.color ?? false))
      break
    }
    case 'play': {
      // Without a real terminal there is nothing to animate in, so print the still version.
      const interactive = process.stdin.isTTY && process.stdout.isTTY
      if (args[0]) {
        const { reel } = await load(args[0])
        if (interactive) await play(reel)
        else console.log(showText(reel, undefined, false))
      } else if (interactive) {
        const reels = await libraryReels()
        if (reels.length === 0) fail(`No reels yet in ${LIBRARY}`)
        const entries = reels.map((reel) =>
          'error' in reel
            ? { name: reel.name, title: reel.name, detail: `needs fixing: ${reel.error}`, isBroken: true }
            : { name: reel.name, title: reel.title, detail: `${reel.steps} steps · ${Math.round(reel.seconds)}s`, isBroken: false },
        )
        await browse(entries, async (name) => (await load(name)).reel)
      } else {
        await list(false)
      }
      break
    }

    case 'list':
      await list(values.json ?? false)
      break
    case 'rename':
      changed('Renamed to', await library.renameReel(LIBRARY, arg(0, 'rename <reel> <new-name>'), arg(1, 'rename <reel> <new-name>')))
      break
    case 'move':
      changed('Moved to', await library.moveReel(LIBRARY, arg(0, 'move <reel> <folder>'), arg(1, 'move <reel> <folder>')))
      break
    case 'duplicate':
      changed('Copied to', await library.duplicateReel(LIBRARY, arg(0, 'duplicate <reel> [new-name]'), args[1]))
      break
    case 'delete': {
      arg(0, 'delete <reel>...')
      // Check every name first, so a typo doesn't leave the job half done.
      const targets = await Promise.all(args.map((name) => library.existingReel(LIBRARY, name)))
      await trash(targets)
      console.log(`Moved to the trash: ${args.join(', ')}`)
      break
    }
    case 'folder': {
      const usage = 'folder <create|rename|move|delete> <folder> [new-name|into]'
      const [action, folder] = [arg(0, usage), arg(1, usage)]
      if (action === 'create') {
        await library.createFolder(LIBRARY, folder)
        console.log(`Created folder ${folder}`)
      } else if (action === 'rename') {
        console.log(`Renamed to ${await library.renameFolder(LIBRARY, folder, arg(2, 'folder rename <folder> <new-name>'))}`)
      } else if (action === 'move') {
        console.log(`Moved to ${await library.moveFolder(LIBRARY, folder, arg(2, 'folder move <folder> <into>'))}`)
      } else if (action === 'delete') {
        await trash(await library.existingFolder(LIBRARY, folder))
        console.log(`Moved folder ${folder} to the trash`)
      } else {
        fail(`Usage: sworeel ${usage}`)
      }
      break
    }

    case 'asset': {
      const action = arg(0, 'asset <add|list> [image] [name]')
      if (action === 'add') {
        console.log(await library.addAsset(assetsFolder(), resolve(arg(1, 'asset add <image> [name]')), args[2]))
      } else if (action === 'list') {
        const names = (await readdir(assetsFolder()).catch(() => [])).filter((name) => /\.(png|jpe?g)$/i.test(name)).sort()
        console.log(names.length ? names.join('\n') : 'No pictures stored yet.')
      } else {
        fail('Usage: sworeel asset <add|list> [image] [name]')
      }
      break
    }
    case 'style': {
      const notes = (await readFile(styleFile, 'utf8').catch(() => '')).split('\n').map((line) => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean)
      // The file is a plain list, one preference a line; anything else in it is not kept.
      const save = (lines: string[]) => mkdir(dirname(styleFile), { recursive: true }).then(() => writeFile(styleFile, lines.map((line) => `- ${line}\n`).join('')))
      const [action, ...rest] = args
      if (!action) {
        console.log(notes.length ? notes.map((note, i) => `${i + 1}. ${note}`).join('\n') : 'No preferences noted yet.')
      } else if (action === 'add' && rest.join(' ').trim()) {
        await save([...notes, rest.join(' ').trim().replace(/\s+/g, ' ')])
        console.log(`Noted: ${rest.join(' ').trim()}`)
      } else if (action === 'remove' && Number.isInteger(Number(rest[0])) && notes[Number(rest[0]) - 1] !== undefined) {
        const [removed] = notes.splice(Number(rest[0]) - 1, 1)
        await save(notes)
        console.log(`Removed: ${removed}`)
      } else {
        fail('Usage: sworeel style [add "<preference>" | remove <N>]')
      }
      break
    }
    case 'bundle': {
      arg(0, 'bundle <reel|folder>... [--out file.sworeel]')
      const names = await reelsNamed(LIBRARY, args)
      // Named after the one thing asked for, or the library when it was several.
      const only = args.length === 1 ? basename(args[0]!.replace(/\/+$/, ''), '.json') : ''
      const label = only && only !== '.' ? only : 'sworeel-library'
      const out = resolve(values.out ?? join(exportsFolder(), `${label}.sworeel`))
      await mkdir(dirname(out), { recursive: true })
      await writeFile(out, JSON.stringify(await makeBundle(LIBRARY, assetsFolder(), names)))
      console.log(out)
      break
    }
    case 'import': {
      const file = resolve(arg(0, 'import <file.sworeel> [--into folder]'))
      const text = await readFile(file, 'utf8').catch(() => fail(`Could not read ${file}`))
      const { added, skipped } = await importBundle(LIBRARY, assetsFolder(), text, values.into)
      if (added.length) console.log(`Imported ${added.length === 1 ? '1 reel' : `${added.length} reels`}: ${added.join(', ')}`)
      if (skipped.length) console.log(`Already in the library, unchanged: ${skipped.join(', ')}`)
      break
    }
    case 'exports':
      await listExports(values.json ?? false)
      break
    case 'icons':
      console.log(ICON_NAMES.join('  '))
      break
    case 'open':
      open(arg(0, 'open <reels|exports|file>'))
      break
    case 'paths':
      paths(values.json ?? false)
      break
    case 'app':
      await openInApp(args[0])
      break
    case 'showing': {
      // A note that is missing, or caught half-written, means nothing is known to be showing.
      let note = await readFile(showingFile, 'utf8').then(JSON.parse).catch(() => null) as { reel: string; step: number; at: number; pid?: number } | null
      // A note left by an app that is no longer running says nothing about now. The app names
      // its process; a note without one (from an older app) is believed for half a day.
      if (note && (note.pid !== undefined ? !isRunning(note.pid) : Date.now() - note.at > 12 * 60 * 60 * 1000)) note = null
      if (values.json) console.log(JSON.stringify(note))
      else if (!note) console.log('The SwoReel app is not showing a reel. It may be closed, or on its library.')
      else {
        const { reel } = await load(note.reel)
        const where = note.step < 1 ? 'before the first step' : `at step ${note.step} of ${reel.steps.length}: "${reel.steps[note.step - 1]?.caption}"`
        console.log(`The SwoReel app is showing ${note.reel}, titled "${reel.title}", ${where}`)
      }
      break
    }
    case 'config': {
      const usage = 'config [reels|exports|app <path>] [watermark <text>] [progress <on|off>] [theme [colour #hex]] [formats <list>] [fps <N>]'
      const [name, value] = args
      if (!name) {
        console.log(JSON.stringify({ reels: LIBRARY, exports: exportsFolder(), watermark: CONFIG.watermark ?? '', progress: CONFIG.progress === true, theme: { ...DEFAULT_THEME, ...CONFIG.theme }, formats: defaultFormats, fps: CONFIG.fps ?? 30, app: CONFIG.app ?? '' }, null, 2))
      } else if (name === 'formats') {
        const list = (value ?? '').split(/[\s,]+/).filter(Boolean)
        if (list.length === 0 || !list.every(isFormat)) fail(`Give one or more of: ${Object.keys(FORMATS).join(', ')}, separated by commas.`)
        writeConfig({ formats: [...new Set(list)] })
        console.log(`Default formats set to ${[...new Set(list)].join(', ')}`)
      } else if (name === 'fps') {
        const fps = Number(value)
        if (!Number.isInteger(fps) || fps < 1 || fps > 60) fail('fps must be a whole number from 1 to 60.')
        writeConfig({ fps })
        console.log(`Frames per second set to ${fps}`)
      } else if (name === 'theme') {
        const [, key, color] = args
        const current = CONFIG.theme ?? {}
        if (!key) {
          // Every colour, marking the ones that differ from the defaults.
          for (const each of THEME_KEYS) console.log(`${each.padEnd(11)} ${current[each] ?? DEFAULT_THEME[each]}${current[each] ? '  (changed)' : ''}`)
        } else if (key === 'reset') {
          writeConfig({ theme: undefined })
          console.log('Theme put back to the default colours')
        } else if (!THEME_KEYS.includes(key as keyof Theme)) {
          fail(`"${key}" is not a colour that can be set. Use one of: ${THEME_KEYS.join(', ')}.`)
        } else if (color === 'reset' || color === undefined) {
          if (color === undefined) fail(`Usage: sworeel config theme ${key} <#hex|reset>`)
          const { [key as keyof Theme]: _dropped, ...rest } = current
          writeConfig({ theme: Object.keys(rest).length ? rest : undefined })
          console.log(`${key} put back to ${DEFAULT_THEME[key as keyof Theme]}`)
        } else {
          if (!isColor(color)) fail(`"${color}" is not a hex colour. Give one like "#1acee3".`)
          writeConfig({ theme: { ...current, [key]: color.toLowerCase() } })
          console.log(`${key} set to ${color.toLowerCase()}`)
        }
      } else if (name === 'progress') {
        if (value !== 'on' && value !== 'off') fail('Usage: sworeel config progress <on|off>')
        // Off is the default, so only "on" is written down.
        writeConfig({ progress: value === 'on' ? true : undefined })
        console.log(value === 'on' ? 'Step dots are shown on exports' : 'Step dots are hidden on exports')
      } else if (name === 'watermark') {
        // An empty value, or none, removes it.
        writeConfig({ watermark: value?.trim() || undefined })
        console.log(value?.trim() ? `Watermark set to ${value.trim()}` : 'Watermark removed')
      } else if ((name === 'reels' || name === 'exports' || name === 'app') && value) {
        if (name !== 'app' && process.env.SWOREEL_HOME) fail('SWOREEL_HOME is set, which decides where reels and exports go. Unset it to change this setting.')
        const target = resolve(expandHome(value))
        if (name === 'reels' && target !== LIBRARY) await bringLibrary(target)
        writeConfig({ [name]: target })
        console.log(`${name} set to ${target}`)
      } else {
        fail(`Usage: sworeel ${usage}`)
      }
      break
    }
    default:
      fail(`Unknown command "${command}".\n\n${USAGE}`)
  }
} catch (error) {
  fail((error as Error).message)
}
