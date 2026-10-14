// Where SwoReel keeps things. The desktop app (`src-tauri/src/paths.rs`) follows the same rules.
//
//   Reels    Linux    ~/.local/share/sworeel/reels
//             macOS    ~/Library/Application Support/SwoReel/reels
//             Windows  %APPDATA%\SwoReel\reels
//   Settings  Linux    ~/.config/sworeel/config.json
//             macOS    ~/Library/Application Support/SwoReel/config.json
//             Windows  %APPDATA%\SwoReel\config.json
//   Exports   Documents/SwoReel on all three
//
//   Pictures  an `assets` folder beside the reels folder
//
// Reels are the app's working files; exports are what the user publishes, so only exports go
// in Documents. `reels` and `exports` in config.json override the defaults.
//
// SWOREEL_HOME moves everything into one folder: its `reels`, `assets` and `exports` folders
// and its own `config.json` and `style.md`. Nothing outside it is read or written, which is
// what tests and try-outs need.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { Theme } from '../core/theme.ts'

const home = homedir()
const env = process.env

function appFolder(linuxBase: string) {
  if (process.platform === 'win32') return join(env.APPDATA || join(home, 'AppData', 'Roaming'), 'SwoReel')
  if (process.platform === 'darwin') return join(home, 'Library', 'Application Support', 'SwoReel')
  return join(linuxBase, 'sworeel')
}

/** The one folder everything lives in when SWOREEL_HOME is set. */
const sandbox = env.SWOREEL_HOME ? resolve(env.SWOREEL_HOME) : null

export const configFile = join(sandbox ?? appFolder(env.XDG_CONFIG_HOME || join(home, '.config')), 'config.json')

export type Config = {
  reels?: string
  exports?: string
  /** A credit drawn in the corner of every export, such as a handle. */
  watermark?: string
  /** Colours that replace the default ones on every reel. */
  theme?: Partial<Theme>
  /** True draws the row of step dots on every frame; they are off otherwise. */
  progress?: boolean
  /** False stops Claude offering a reel nobody asked for; it offers otherwise. */
  suggest?: boolean
  /** Where the desktop app is installed, if not on PATH. */
  app?: string
  /** The formats a video is rendered in when none is asked for: any of `wide`, `tall`, `square`. */
  formats?: string[]
  /** Frames per second for video. */
  fps?: number
}

/** Where the command leaves a note asking the desktop app to show a reel. */
export const requestFile = join(dirname(configFile), 'open-request.json')

/** Where the desktop app notes which reel and step it is showing. */
export const showingFile = join(dirname(configFile), 'showing.json')

/**
 * The settings. A missing file is no settings yet; a file that can't be read as settings is an
 * error, so that a slip in it is reported and never written over.
 */
export function readConfig(): Config {
  let text: string
  try {
    text = readFileSync(configFile, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw new Error(`Could not read the settings at ${configFile}: ${(error as Error).message}`)
  }
  let config: unknown
  try {
    config = JSON.parse(text)
  } catch (error) {
    throw new Error(`The settings at ${configFile} are not valid JSON (${(error as Error).message}). Fix or delete that file.`)
  }
  if (typeof config !== 'object' || config === null || Array.isArray(config)) throw new Error(`The settings at ${configFile} must be a JSON object. Fix or delete that file.`)
  return config
}

/** Changes some settings, leaving the rest. A setting given as `undefined` is removed. */
export function writeConfig(changes: Config) {
  const text = `${JSON.stringify({ ...readConfig(), ...changes }, null, 2)}\n`
  mkdirSync(dirname(configFile), { recursive: true })
  // Written beside the file and moved into place, so nothing ever reads half of it.
  const draft = `${configFile}.tmp`
  writeFileSync(draft, text)
  renameSync(draft, configFile)
}

/** `~` and `~/…` as the user's home folder, since a path typed into the app is not seen by a shell. */
export function expandHome(path: string) {
  return path === '~' ? home : /^~[/\\]/.test(path) ? join(home, path.slice(2)) : path
}

/** The user's Documents folder. On Linux it can be renamed or translated, so ask XDG. */
function documentsFolder() {
  if (process.platform === 'linux') {
    try {
      const dirs = readFileSync(join(env.XDG_CONFIG_HOME || join(home, '.config'), 'user-dirs.dirs'), 'utf8')
      const match = dirs.match(/^XDG_DOCUMENTS_DIR="(.+)"$/m)
      if (match) return match[1]!.replace(/^\$HOME/, home)
    } catch {
      // No user-dirs file: fall through to the conventional name.
    }
  }
  return join(home, 'Documents')
}

export function reelsFolder() {
  if (sandbox) return join(sandbox, 'reels')
  return readConfig().reels || join(appFolder(env.XDG_DATA_HOME || join(home, '.local', 'share')), 'reels')
}

/**
 * Where images that reels use are kept: beside the reels folder, not inside it, so they stay
 * out of the library and nothing done to a reel can break its pictures.
 */
export function assetsFolder() {
  return join(dirname(reelsFolder()), 'assets')
}

/** Where the user's standing preferences for how reels are made are kept, as plain notes. */
export const styleFile = join(dirname(configFile), 'style.md')

export function exportsFolder() {
  if (sandbox) return join(sandbox, 'exports')
  const configured = readConfig().exports
  if (configured) return configured

  // Remember the default, so the app and the CLI agree even where they would locate
  // Documents differently.
  const exports = join(documentsFolder(), 'SwoReel')
  writeConfig({ exports })
  return exports
}
