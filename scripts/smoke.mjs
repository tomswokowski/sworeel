// Runs SwoReel the way a person's machine would: through the `sworeel` launcher, against a
// library of its own, and (with --app) against the desktop app as installed from a release.
// It is how the systems nobody on the project sits at are checked: see .github/workflows/smoke.yml.
//
//   node scripts/smoke.mjs            the command, end to end
//   node scripts/smoke.mjs --app      also start the installed desktop app and ask it what it shows
//   SWOREEL_BIN=<folder> node scripts/smoke.mjs    use an installed plugin's command, not this checkout's
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'
// On a build machine the library sits in the home folder, on the same drive as the system
// trash, so that deleting can be tested. Anywhere else it is a temporary folder, and deleting
// is left out so that nothing lands in a real person's trash.
const onBuildMachine = Boolean(process.env.CI)
const home = mkdtempSync(join(onBuildMachine ? homedir() : tmpdir(), 'sworeel-smoke-'))
// SWOREEL_BIN is the `bin` folder of a plugin installed by Claude Code. The launcher is then run
// from there and is not put on the PATH, so the desktop app has to find the plugin by itself,
// as it does when a person opens it. Without it, this checkout's launcher is found by name.
const installed = process.env.SWOREEL_BIN
const env = { ...process.env, SWOREEL_HOME: home, PATH: installed ? process.env.PATH : `${join(root, 'plugin', 'bin')}${isWindows ? ';' : ':'}${process.env.PATH}` }
const name = isWindows ? 'sworeel.cmd' : 'sworeel'
const launcher = installed ? (isWindows ? `"${join(installed, name)}"` : join(installed, name)) : name

function launch(args, withEnv) {
  return spawnSync(launcher, args, { env: withEnv, encoding: 'utf8', shell: isWindows })
}
function sworeel(...args) {
  const ran = launch(args, env)
  return { code: ran.status, out: (ran.stdout ?? '').trim(), err: (ran.stderr ?? '').trim() }
}

let failed = 0
function check(name, ok, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n      ${String(detail).split('\n').join('\n      ')}`}`)
}
/** Runs a command and checks it succeeded and, if given, that what it printed matches. */
function run(name, args, expect) {
  const result = sworeel(...args)
  const ok = result.code === 0 && (!expect || expect.test(result.out))
  check(name, ok, `sworeel ${args.join(' ')} -> exit ${result.code}\n${result.out}\n${result.err}`)
  return result
}
const sized = (path) => existsSync(path) && statSync(path).size > 1000

mkdirSync(join(home, 'reels'), { recursive: true })
for (const file of readdirSync(join(root, 'src', 'dev', 'fixtures'))) if (file.endsWith('.json')) cpSync(join(root, 'src', 'dev', 'fixtures', file), join(home, 'reels', file))

console.log(`SwoReel smoke test on ${process.platform} ${process.arch}, Node ${process.version}\nLibrary: ${home}\nCommand: ${installed ? join(installed, name) : 'this checkout'}\n`)

run('the launcher starts and lists the library', ['list'], /front-door/)
run('paths are inside the test folder', ['paths'], new RegExp(home.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&').slice(0, 20)))
run('a reel validates', ['validate', 'front-door'], /^OK/)
run('a reel shows as text', ['show', 'front-door', '--step', '2'], /Browser/)

const still = run('a still is exported', ['still', 'front-door', '--format', 'tall'])
check('the still is a real image file', sized(still.out), still.out)
const stills = run('every step is exported as a still', ['stills', 'compose-up', '--format', 'square'])
check('the stills folder has one image per step', existsSync(stills.out) && readdirSync(stills.out).length === 6, stills.out)
// The ffmpeg that comes with the command's dependencies, whatever else this computer has.
env.SWOREEL_FFMPEG = 'bundled'
const video = run('a video is rendered with the bundled ffmpeg', ['render', 'two-addresses', '--format', 'square'])
delete env.SWOREEL_FFMPEG
check('the video is a real file', sized(video.out), video.out)

run('a reel is duplicated', ['duplicate', 'front-door', 'copy'], /Copied to copy/)
run('a reel is renamed', ['rename', 'copy', 'renamed'], /Renamed to renamed/)
run('a folder is created', ['folder', 'create', 'web'], /Created folder web/)
run('a reel is moved into it', ['move', 'renamed', 'web'], /Moved to web\/renamed/)
run('a name that starts with a dash is taken as a name', ['config', 'watermark', '--', '-x'], /Watermark set to -x/)
run('a setting is changed and read back', ['config', 'fps', '24'], /24/)
check('settings were written inside the test folder', existsSync(join(home, 'config.json')) && JSON.parse(readFileSync(join(home, 'config.json'), 'utf8')).fps === 24)

const bundle = run('the library is bundled into one file', ['bundle', '.'])
check('the bundle is a real file', sized(bundle.out), bundle.out)
const otherHome = mkdtempSync(join(tmpdir(), 'sworeel-smoke-other-'))
const other = { ...env, SWOREEL_HOME: otherHome }
const imported = launch(['import', bundle.out], other)
check('the bundle is imported into another library', imported.status === 0 && /Imported 4 reels/.test(imported.stdout), `${imported.stdout}\n${imported.stderr}`)

if (onBuildMachine) {
  run('a reel is sent to the system trash', ['delete', 'web/renamed'], /Moved to the trash/)
  check('the deleted reel is gone from the library', !existsSync(join(home, 'reels', 'web', 'renamed.json')))
}
const bad = sworeel('list', '--bogus')
check('a wrong option gives a sentence, not a stack trace', bad.code === 1 && /Unknown option/.test(bad.err) && !/\n\s+at /.test(bad.err), bad.err)

if (process.argv.includes('--app')) {
  console.log('\nThe desktop app, as installed:')
  const started = run('`sworeel app` finds the installed app and starts it on a reel', ['app', 'front-door'], /SwoReel app/)
  // The app takes a moment to open its window, read the library and report what it is showing.
  let showing = { out: '' }
  for (let waited = 0; waited < 60 && !/is showing front-door/.test(showing.out); waited += 3) {
    spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 3000)'])
    showing = sworeel('showing')
  }
  check('the app opened that reel and says so', /is showing front-door, titled "One front door"/.test(showing.out), `${started.out}\n${showing.out}\n${showing.err}`)
}

// Leave nothing behind. With --app the library stays, because the app is still running on it.
if (!process.argv.includes('--app')) rmSync(home, { recursive: true, force: true })
rmSync(otherHome, { recursive: true, force: true })

console.log(failed ? `\n${failed} check${failed === 1 ? '' : 's'} failed.` : '\nEverything passed.')
process.exit(failed ? 1 : 0)
