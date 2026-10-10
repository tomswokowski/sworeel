// Runs the command or the desktop app from this folder against a sandbox, so that working on
// SwoReel never touches the reels, pictures, settings or exports of the copy you actually use.
//
//   npm run sworeel -- <args>    the command, e.g. `npm run sworeel -- list`
//   npm run dev:app              the desktop app, with live reload
//
// The sandbox is `.dev-home/` here (or wherever SWOREEL_HOME already points). It starts with a
// few sample reels. The app is built under another name ("SwoReel Dev"), so it can sit beside
// an installed SwoReel without sharing its window, its remembered state or its place in menus.
import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const home = process.env.SWOREEL_HOME ? resolve(process.env.SWOREEL_HOME) : join(root, '.dev-home')
const isWindows = process.platform === 'win32'
const cli = join(root, 'plugin', 'bin', isWindows ? 'sworeel.cmd' : 'sworeel')

// A new sandbox gets the sample reels, so there is something to look at.
const reels = join(home, 'reels')
if (!existsSync(reels)) {
  mkdirSync(reels, { recursive: true })
  const samples = join(root, 'src', 'dev', 'fixtures')
  for (const file of readdirSync(samples)) if (file.endsWith('.json') && file !== 'broken.json') cpSync(join(samples, file), join(reels, file))
  console.error(`Made a sandbox with sample reels at ${home}`)
}

const [what, ...args] = process.argv.slice(2)
const env = { ...process.env, SWOREEL_HOME: home, SWOREEL_CLI: cli }
const [program, programArgs] =
  what === 'app'
    ? [join(root, 'node_modules', '.bin', isWindows ? 'tauri.cmd' : 'tauri'), ['dev', '--config', join('src-tauri', 'tauri.dev.conf.json'), ...args]]
    : what === 'sworeel'
      ? [cli, args]
      : [null, []]
if (!program) {
  console.error('Usage: node scripts/dev.mjs <sworeel|app> [args]')
  process.exit(1)
}

spawn(program, programArgs, { cwd: what === 'app' ? root : process.cwd(), env, stdio: 'inherit', shell: isWindows }).on('exit', (code) => process.exit(code ?? 1))
