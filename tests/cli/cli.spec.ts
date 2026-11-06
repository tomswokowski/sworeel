// The command as a person or an agent runs it: what it prints, how it exits, what it leaves behind.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { all } from './samples.ts'

const run = promisify(execFile)
const main = join(import.meta.dirname, '..', '..', 'plugin', 'cli', 'main.ts')
const flow = { title: 'Front door', nodes: [{ id: 'a', label: 'A', col: 0, row: 0 }, { id: 'b', label: 'B', col: 1, row: 0 }], steps: [{ caption: 'A calls B.', from: 'a', to: 'b', label: 'GET /' }] }

let home: string

/** Runs the command inside a folder of its own, so nothing real is read or written. */
async function sworeel(...args: string[]) {
  try {
    const { stdout, stderr } = await run(process.execPath, [main, ...args], { env: { ...process.env, SWOREEL_HOME: home } })
    return { code: 0, out: stdout.trim(), err: stderr.trim() }
  } catch (error) {
    const failed = error as { code: number; stdout: string; stderr: string }
    return { code: failed.code, out: failed.stdout.trim(), err: failed.stderr.trim() }
  }
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'sworeel-cli-'))
  await mkdir(join(home, 'reels', 'web'), { recursive: true })
  await writeFile(join(home, 'reels', 'front-door.json'), JSON.stringify(flow))
  await writeFile(join(home, 'reels', 'web', 'cors.json'), JSON.stringify(flow))
})

afterEach(() => rm(home, { recursive: true }))

test('everything lives in SWOREEL_HOME when it is set', async () => {
  const paths = JSON.parse((await sworeel('paths', '--json')).out) as Record<string, string>
  for (const path of Object.values(paths)) assert.ok(path.startsWith(home), `${path} is outside the sandbox`)
  await sworeel('config', 'watermark', '@test')
  assert.equal(JSON.parse(await readFile(join(home, 'config.json'), 'utf8')).watermark, '@test')
})

test('a slip on the command line is answered in a sentence, not a stack trace', async () => {
  const unknown = await sworeel('list', '--bogus')
  assert.equal(unknown.code, 1)
  assert.match(unknown.err, /^Unknown option '--bogus'\.\nRun "sworeel --help"/)
  assert.doesNotMatch(unknown.err, /\n\s+at /)

  const missing = await sworeel('validate', 'nope')
  assert.equal(missing.code, 1)
  assert.match(missing.err, /^No reel file at /)

  assert.match((await sworeel('stills', 'front-door', '--out', 'x')).err, /does not take --out/)
  assert.match((await sworeel('still', 'front-door', '--step', '')).err, /--step must be between 0/)
})

test('while developing, an installed app is never started in place of the one from the project', async () => {
  const asked = run(process.execPath, [main, 'app', 'front-door'], { env: { ...process.env, SWOREEL_HOME: home, SWOREEL_DEV: '1' } })
  await assert.rejects(asked, /The development app is not running\. Start it in another terminal with: npm run dev:app/)
  await assert.rejects(readFile(join(home, 'open-request.json')), 'the request is withdrawn')
})

test('text that starts with a dash is taken as text after --', async () => {
  assert.equal((await sworeel('config', 'watermark', '--', '-tom')).out, 'Watermark set to -tom')
  assert.equal(JSON.parse(await readFile(join(home, 'config.json'), 'utf8')).watermark, '-tom')
})

test('settings that cannot be read are reported and never written over', async () => {
  const broken = '{ "watermark": "@me", }'
  await writeFile(join(home, 'config.json'), broken)
  for (const args of [['paths'], ['list'], ['config', 'fps', '60']]) {
    const result = await sworeel(...args)
    assert.equal(result.code, 1)
    assert.match(result.err, /are not valid JSON/)
    assert.doesNotMatch(result.err, /\n\s+at /)
  }
  assert.equal(await readFile(join(home, 'config.json'), 'utf8'), broken)

  await writeFile(join(home, 'config.json'), 'null')
  assert.match((await sworeel('list')).err, /must be a JSON object/)
  // A setting of the wrong kind is ignored, not fatal.
  await writeFile(join(home, 'config.json'), '{ "formats": "wide" }')
  assert.equal((await sworeel('list')).code, 0)
})

test('exports are named after the reel and its folders, so same-named reels do not collide', async () => {
  const top = await sworeel('still', 'front-door')
  const nested = await sworeel('still', 'web/cors')
  assert.match(top.out, /front-door-wide-step1\.png$/)
  assert.match(nested.out, /web-cors-wide-step1\.png$/)
  assert.deepEqual((await readdir(join(home, 'exports'))).sort(), ['front-door-wide-step1.png', 'web-cors-wide-step1.png'])
})

test('moving the reels folder brings the library along and leaves the originals', async () => {
  // SWOREEL_HOME fixes where reels go, so this runs against a config folder of its own instead.
  const config = join(home, 'config')
  const data = join(home, 'data')
  const env = { ...process.env, SWOREEL_HOME: '', XDG_CONFIG_HOME: config, XDG_DATA_HOME: data, HOME: home, APPDATA: config }
  const at = async (...args: string[]) => (await run(process.execPath, [main, ...args], { env })).stdout.trim()
  const { reels } = JSON.parse(await at('paths', '--json')) as { reels: string }
  await mkdir(reels, { recursive: true })
  await writeFile(join(reels, 'one.json'), JSON.stringify(flow))

  const moved = join(home, 'elsewhere', 'reels')
  assert.match(await at('config', 'reels', moved), /Copied 1 reel and their pictures to the new folder\. The originals are still in /)
  assert.ok(existsSync(join(moved, 'one.json')))
  assert.ok(existsSync(join(reels, 'one.json')))
  assert.match(await at('list'), /^one /)
})

test('a note about what the app is showing is believed only while that app is running', async () => {
  const note = (pid: number) => writeFile(join(home, 'showing.json'), JSON.stringify({ reel: 'front-door', step: 1, at: Date.now(), pid }))
  await note(process.pid)
  assert.match((await sworeel('showing')).out, /is showing front-door, titled "Front door", at step 1 of 1/)

  // A process that has already ended: its id is free again.
  const { pid } = await new Promise<{ pid: number }>((done) => {
    const child = execFile(process.execPath, ['-e', ''], () => done({ pid: child.pid! }))
  })
  await note(pid)
  assert.match((await sworeel('showing')).out, /is not showing a reel/)
  assert.equal((await sworeel('showing', '--json')).out, 'null')

  // A note with no process named says nothing about now either.
  await writeFile(join(home, 'showing.json'), JSON.stringify({ reel: 'front-door', step: 1 }))
  assert.match((await sworeel('showing')).out, /is not showing a reel/)
})

test('what the app is showing is told plainly when the reel has changed since', async () => {
  const note = (reel: string, step: number) => writeFile(join(home, 'showing.json'), JSON.stringify({ reel, step, pid: process.pid }))
  await note('front-door', 9)
  assert.match((await sworeel('showing')).out, /at step 1 of 1: "A calls B\."/)
  await note('gone', 1)
  assert.equal((await sworeel('showing')).out, 'The SwoReel app is showing gone, which is no longer in the library.')
})

test('the desktop app gets the replies it reads, from the arguments it sends', async () => {
  // The same argument lists as src-tauri/src/lib.rs, which reads a JSON path or one path a line.
  const moved = (reply: { out: string }) => JSON.parse(reply.out) as { name: string; path: string }
  assert.deepEqual(moved(await sworeel('rename', '--json', '--', 'front-door', 'door')), { name: 'door', path: join(home, 'reels', 'door.json') })
  assert.deepEqual(moved(await sworeel('move', '--json', '--', 'door', 'web')), { name: 'web/door', path: join(home, 'reels', 'web', 'door.json') })
  assert.deepEqual(moved(await sworeel('move', '--json', '--', 'web/door', '.')), { name: 'door', path: join(home, 'reels', 'door.json') })
  assert.deepEqual(moved(await sworeel('duplicate', '--json', '--', 'door')), { name: 'door copy', path: join(home, 'reels', 'door copy.json') })

  assert.equal((await sworeel('folder', 'create', '--', 'web/new')).code, 0)
  assert.equal((await sworeel('folder', 'rename', '--', 'web/new', 'newer')).code, 0)
  assert.equal((await sworeel('folder', 'move', '--', 'web/newer', '.')).code, 0)
  assert.ok(existsSync(join(home, 'reels', 'newer')))

  const still = await sworeel('still', '--format', 'square', '--step', '0', '--', 'door')
  assert.deepEqual(still.out.split('\n'), [join(home, 'exports', 'door-square-step0.png')])
  const stills = await sworeel('stills', '--format', 'tall', '--', 'door')
  assert.deepEqual(stills.out.split('\n'), [join(home, 'exports', 'door-tall-stills')])
  await sworeel('config', 'fps', '2')
  await sworeel('config', 'formats', 'wide,square')
  const videos = await sworeel('render', '--', 'door')
  assert.deepEqual(videos.out.split('\n'), ['wide', 'square'].map((format) => join(home, 'exports', `door-${format}.mp4`)))

  const bundle = await sworeel('bundle', '--', 'web/')
  assert.equal(bundle.out, join(home, 'exports', 'web.sworeel'))
  const imported = await sworeel('import', '--', bundle.out)
  assert.equal(imported.out, 'Already in the library, unchanged: web/cors')
})

test('a command refuses an option it has no use for', async () => {
  assert.equal((await sworeel('show', 'front-door', '--json')).err, '"sworeel show" does not take --json.')
  assert.equal((await sworeel('validate', 'front-door', '--step', '1')).err, '"sworeel validate" does not take --step.')
  assert.equal((await sworeel('stills', 'front-door', '--out', 'x')).err, '"sworeel stills" does not take --out.')
  assert.match((await sworeel('nothing', '--json')).err, /^Unknown command "nothing"/)
})

test('every kind of export is listed, and a picture keeps the name it is given', async () => {
  await sworeel('stills', 'front-door')
  await sworeel('still', 'front-door')
  await sworeel('bundle', 'front-door')
  const listed = (JSON.parse((await sworeel('exports', '--json')).out) as { file: string }[]).map((each) => each.file).sort()
  assert.deepEqual(listed, ['front-door-wide-step1.png', 'front-door-wide-stills', 'front-door.sworeel'])

  const image = join(home, 'shot.png')
  await writeFile(image, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'))
  assert.equal((await sworeel('asset', 'add', image, 'logo.png')).out, 'logo.png')
  assert.equal((await sworeel('asset', 'add', image, 'badge')).out, 'badge.png')
})

test('show and still both start at step 0, before the first step', async () => {
  assert.equal((await sworeel('show', 'front-door', '--step', '0')).code, 0)
  assert.match((await sworeel('show', 'front-door', '--step', '2')).err, /--step must be between 0 \(before the first step\) and 1\./)
})

test('a setting that cannot be used is named as the setting, not as an option', async () => {
  await writeFile(join(home, 'config.json'), JSON.stringify({ fps: 'fast' }))
  assert.equal((await sworeel('render', 'front-door')).err, 'The fps setting must be a whole number from 1 to 60.')
  assert.equal((await sworeel('render', 'front-door', '--fps', '0')).err, '--fps must be a whole number from 1 to 60.')
})

test('a long reel passes, with a note suggesting it be split', async () => {
  const steps = Array.from({ length: 21 }, (_, i) => ({ caption: `Step ${i + 1}.`, from: 'a', to: 'b' }))
  await writeFile(join(home, 'reels', 'long.json'), JSON.stringify({ ...flow, steps }))
  const checked = await sworeel('validate', 'long')
  assert.equal(checked.code, 0)
  assert.match(checked.out + checked.err, /21 steps/)
})

test('every kind draws as an image in every format', async () => {
  // A one-pixel PNG for the picture kind to show.
  await mkdir(join(home, 'kinds', 'shots'), { recursive: true })
  await writeFile(join(home, 'kinds', 'shots', 'cart.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'))
  const sizes = { wide: [1600, 900], tall: [1080, 1920], square: [1080, 1080] }
  for (const [kind, reel] of Object.entries(all)) {
    const file = join(home, 'kinds', `${kind}.json`)
    await writeFile(file, JSON.stringify(reel))
    for (const [format, size] of Object.entries(sizes)) {
      const out = join(home, 'kinds', `${kind}-${format}.png`)
      const drawn = await sworeel('still', file, '--format', format, '--out', out)
      assert.equal(drawn.code, 0, `${kind} ${format}: ${drawn.err}`)
      // A PNG's width and height are the two numbers after its signature and header name.
      const png = await readFile(out)
      assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], size, `${kind} ${format}`)
    }
  }
})

test('a preview is a still kept apart from exports, one per reel, with a link to it', async () => {
  const first = (await sworeel('preview', 'web/cors')).out.split('\n')
  const path = join(home, 'previews', 'web-cors.png')
  assert.deepEqual(first, [path, pathToFileURL(path).href])
  const before = await readFile(path)
  await sworeel('preview', 'web/cors', '--step', '0', '--format', 'square')
  assert.notDeepEqual(await readFile(path), before, 'the preview is replaced')
  assert.deepEqual(await readdir(join(home, 'previews')), ['web-cors.png'])
  assert.match((await sworeel('exports')).out, /^Nothing exported yet/)
  assert.equal((await sworeel('preview', 'web/cors', '--out', 'x')).err, '"sworeel preview" does not take --out.')
})

test('asking for the app where it is not installed says where to get it', async () => {
  // Nowhere the command looks has the app: no PATH, and every system folder inside the sandbox.
  const { SWOREEL_DEV: _developing, ...outside } = process.env
  const env = { ...outside, SWOREEL_HOME: home, PATH: '', HOME: home, LOCALAPPDATA: home, ProgramFiles: home }
  const asked = await run(process.execPath, [main, 'app', 'front-door'], { env }).catch((error: { stderr: string }) => error)
  assert.match((asked as { stderr: string }).stderr, /not installed\. It is free and optional.*https:\/\/sworeel\.com\/#download/)
  assert.match((asked as { stderr: string }).stderr, /sworeel config app <path>/)
})
