// The command as a person or an agent runs it: what it prints, how it exits, what it leaves behind.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { promisify } from 'node:util'

const run = promisify(execFile)
const main = join(import.meta.dirname, 'main.ts')
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
})
