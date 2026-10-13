// Everything the interface asks of the outside world. The desktop app answers through Tauri;
// in a plain browser during development an in-memory stand-in answers instead.
import type { Theme } from '../plugin/core/theme.ts'
import { invoke } from '@tauri-apps/api/core'
import type { Format } from '../plugin/core/render.ts'

export interface ReelFile {
  path: string
  /** File name without the extension. */
  name: string
  /** Folder relative to the library, with `/` separators; empty for the top level. */
  folder: string
  modified: number
}

/** A reel's name as the sworeel command and Claude know it: its folder and file name, `web/cors`. */
export const fullName = (file: ReelFile) => `${file.folder ? `${file.folder}/` : ''}${file.name}`

/** Whether a folder is `parent` or somewhere inside it. */
export const within = (candidate: string, parent: string) => candidate === parent || candidate.startsWith(`${parent}/`)

/** The last part of a path, on any system. */
export const baseName = (path: string) => path.split(/[/\\]/).pop() ?? path

/** The settings the app can change. */
export type SettingKey = 'watermark' | 'progress' | 'formats' | 'fps' | 'exports'

export interface Library {
  reels: ReelFile[]
  folders: string[]
}

export interface Paths {
  reels: string
  exports: string
}

export interface Settings {
  /** A credit drawn in the corner of every frame; empty when there is none. */
  watermark: string
  /** Whether the row of step dots is drawn on every frame. */
  progress: boolean
  /** Colours that replace the default ones on every reel; set by Claude with `sworeel config theme`. */
  theme: Partial<Theme>
  /** The formats a video is rendered in when none is asked for. */
  formats: Format[]
  /** Frames per second for video. */
  fps: number
}

/** What an export makes: one video, a video per default format, one still, or every step as a still. */
export type ExportKind = 'video' | 'videos' | 'still' | 'stills'

export interface Backend {
  paths(): Promise<Paths>
  settings(): Promise<Settings>
  /** Changes one setting, where both the app and Claude's exports read it. */
  setSetting(key: SettingKey, value: string): Promise<void>
  /** A request from `sworeel app` to show a reel (named as the command names it), if one is waiting. */
  takeRequest(): Promise<{ reel: string | null } | null>
  /** Notes which reel (by path) and step (from 1; 0 before the first) is on screen, or that none is. */
  setShowing(reelPath: string | null, step: number): Promise<void>
  list(): Promise<Library>
  read(path: string): Promise<string>
  /** The bytes of the image a picture reel names with `src`. */
  readPicture(reelPath: string, src: string): Promise<ArrayBuffer>
  renameReel(path: string, name: string): Promise<string>
  moveReel(path: string, folder: string): Promise<string>
  duplicateReel(path: string): Promise<string>
  deleteReel(path: string): Promise<void>
  createFolder(parent: string, name: string): Promise<void>
  renameFolder(folder: string, name: string): Promise<void>
  /** Moves a folder and everything in it into another folder; '' is the top level. */
  moveFolder(folder: string, into: string): Promise<void>
  deleteFolder(folder: string): Promise<void>
  /** Renders a reel. Resolves to what was written: files, or for `stills` the folder they are in. */
  exportReel(path: string, what: ExportKind, format: Format, step: number): Promise<string[]>
  /**
   * Packs reels and their pictures into one file for another computer, and returns where it
   * was saved. `name` is a reel as the command names it, a folder ending in `/`, or `.` for all.
   */
  bundle(name: string): Promise<string>
  /** Adds the reels in a bundle file's text to the library, and returns what happened in words. */
  importBundle(text: string): Promise<string>
  open(path: string): Promise<void>
  /** Whether the `sworeel` command, which comes with the Claude Code plugin, can be found. */
  pluginFound(): Promise<boolean>
  /** The newer version of the app that has been fetched and opens after a restart, if there is one. */
  updateReady(): Promise<string | null>
  /** Closes the app and opens the newer version. */
  restartToUpdate(): Promise<void>
}

const tauri: Backend = {
  paths: () => invoke('get_paths'),
  settings: () => invoke('get_settings'),
  setSetting: (key, value) => invoke('set_setting', { key, value }),
  takeRequest: () => invoke('take_request'),
  setShowing: (reel, step) => invoke('set_showing', { reel, step }),
  list: () => invoke('list_library'),
  read: (path) => invoke('read_reel', { path }),
  readPicture: (reel, src) => invoke('read_picture', { reel, src }),
  renameReel: (path, name) => invoke('rename_reel', { path, name }),
  moveReel: (path, folder) => invoke('move_reel', { path, folder }),
  duplicateReel: (path) => invoke('duplicate_reel', { path }),
  deleteReel: (path) => invoke('delete_reel', { path }),
  createFolder: (parent, name) => invoke('create_folder', { parent, name }),
  renameFolder: (folder, name) => invoke('rename_folder', { folder, name }),
  moveFolder: (folder, into) => invoke('move_folder', { folder, into }),
  deleteFolder: (folder) => invoke('delete_folder', { folder }),
  exportReel: (path, what, format, step) => invoke('export_reel', { path, what, format, step }),
  bundle: (name) => invoke('bundle', { name }),
  importBundle: (text) => invoke('import_bundle', { text }),
  open: (path) => invoke('open_path', { path }),
  pluginFound: () => invoke('plugin_found'),
  updateReady: () => invoke('update_ready'),
  restartToUpdate: () => invoke('restart_to_update'),
}

export async function loadBackend(): Promise<Backend> {
  if ('__TAURI_INTERNALS__' in window) return tauri
  if (import.meta.env.DEV) return (await import('./dev/mock.ts')).mockBackend
  throw new Error('SwoReel must be run as the desktop app.')
}
