import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { importBundle, makeBundle, reelsNamed } from '../../plugin/cli/bundle.ts'

const flow = { title: 'Front door', nodes: [{ id: 'a', label: 'A', col: 0, row: 0 }, { id: 'b', label: 'B', col: 1, row: 0 }], steps: [{ caption: 'A calls B.', from: 'a', to: 'b', label: 'GET /' }] }
const picture = (src: string) => ({ title: 'A page', kind: 'picture', src, steps: [{ caption: 'The whole page.' }, { caption: 'Another page.', src: 'second.png' }] })

const png = (text: string) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(text)])
const read = async (path: string) => (await readFile(path)).subarray(8).toString()

let here: string
let there: string
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'))

beforeEach(async () => {
  here = await mkdtemp(join(tmpdir(), 'sworeel-here-'))
  there = await mkdtemp(join(tmpdir(), 'sworeel-there-'))
  await mkdir(join(here, 'reels', 'web'), { recursive: true })
  await mkdir(join(here, 'assets'))
  await writeFile(join(here, 'reels', 'front-door.json'), JSON.stringify(flow))
  await writeFile(join(here, 'reels', 'web', 'page.json'), JSON.stringify(picture('first.png')))
  await writeFile(join(here, 'assets', 'first.png'), png('first image'))
  await writeFile(join(here, 'assets', 'second.png'), png('second image'))
})

afterEach(async () => {
  await rm(here, { recursive: true })
  await rm(there, { recursive: true })
})

const pack = async (...names: string[]) => JSON.stringify(await makeBundle(join(here, 'reels'), join(here, 'assets'), await reelsNamed(join(here, 'reels'), names)))
const unpack = (text: string, into?: string) => importBundle(join(there, 'reels'), join(there, 'assets'), text, into)

test('a name is a reel, a folder of reels, or the whole library', async () => {
  const root = join(here, 'reels')
  assert.deepEqual(await reelsNamed(root, ['front-door']), ['front-door'])
  assert.deepEqual(await reelsNamed(root, ['web']), ['web/page'])
  assert.deepEqual(await reelsNamed(root, ['web/']), ['web/page'])
  assert.deepEqual(await reelsNamed(root, ['.']), ['front-door', 'web/page'])
  await assert.rejects(reelsNamed(root, ['nope']), /no reel or folder/)
})

test('a bundle carries reels, folders and pictures to another library', async () => {
  const result = await unpack(await pack('.'))
  assert.deepEqual(result, { added: ['front-door', 'web/page'], skipped: [] })
  assert.deepEqual(await json(join(there, 'reels', 'front-door.json')), flow)
  assert.deepEqual(await json(join(there, 'reels', 'web', 'page.json')), picture('first.png'))
  assert.equal(await read(join(there, 'assets', 'first.png')), 'first image')
  assert.equal(await read(join(there, 'assets', 'second.png')), 'second image')
})

test('importing twice changes nothing, and never replaces a different reel', async () => {
  const bundle = await pack('front-door')
  await unpack(bundle)
  assert.deepEqual(await unpack(bundle), { added: [], skipped: ['front-door'] })

  await writeFile(join(there, 'reels', 'front-door.json'), JSON.stringify({ ...flow, title: 'Mine' }))
  assert.deepEqual(await unpack(bundle), { added: ['front-door-2'], skipped: [] })
  assert.equal((await json(join(there, 'reels', 'front-door.json'))).title, 'Mine')
})

test('a picture whose name is taken arrives under a new name, and its reel follows', async () => {
  await mkdir(join(there, 'assets'), { recursive: true })
  await writeFile(join(there, 'assets', 'first.png'), png('a different image'))
  await unpack(await pack('web'), 'from-laptop')
  const reel = await json(join(there, 'reels', 'from-laptop', 'web', 'page.json'))
  assert.equal(reel.src, 'first-2.png')
  assert.equal(reel.steps[1].src, 'second.png')
  assert.equal(await read(join(there, 'assets', 'first.png')), 'a different image')
  assert.equal(await read(join(there, 'assets', 'first-2.png')), 'first image')
})

test('a bad bundle is refused before anything is written', async () => {
  await assert.rejects(unpack('not json'), /not a SwoReel bundle/)
  await assert.rejects(unpack('{"sworeel":2,"reels":[]}'), /newer version/)
  const bad = JSON.stringify({ sworeel: 1, reels: [{ name: 'ok', reel: flow }, { name: 'broken', reel: { title: 'No steps' } }], pictures: {} })
  await assert.rejects(unpack(bad), /"broken" is not valid/)
  assert.equal(existsSync(join(there, 'reels', 'ok.json')), false)
  // Pictures are checked for what they are, and extras the reels don't use are left out.
  const fake = JSON.stringify({ sworeel: 1, reels: [{ name: 'page', reel: { ...picture('first.png'), steps: [{ caption: 'One.' }] } }], pictures: { 'first.png': Buffer.from('not an image').toString('base64') } })
  await assert.rejects(unpack(fake), /not a PNG or JPEG image/)
  const extra = JSON.stringify({ sworeel: 1, reels: [{ name: 'ok', reel: flow }], pictures: { 'stray.png': png('x').toString('base64') } })
  await unpack(extra)
  assert.equal(existsSync(join(there, 'assets', 'stray.png')), false)
  await rm(join(there, 'reels', 'ok.json'))
  // A name can't climb out of the library.
  const escape = JSON.stringify({ sworeel: 1, reels: [{ name: '../outside', reel: flow }], pictures: {} })
  await assert.rejects(unpack(escape), /can't start with a dot/)
  assert.equal(existsSync(join(there, 'outside.json')), false)
})

test('a reel with a missing picture is not bundled', async () => {
  await rm(join(here, 'assets', 'second.png'))
  await assert.rejects(pack('web'), /"second.png", which is missing/)
})

test('one bad name stops the whole import, wherever it comes in the bundle', async () => {
  const mixed = JSON.stringify({ sworeel: 1, reels: [{ name: 'good', reel: flow }, { name: 'page', reel: picture('first.png') }, { name: '../evil', reel: flow }], pictures: { 'first.png': png('a').toString('base64'), 'second.png': png('b').toString('base64') } })
  await assert.rejects(unpack(mixed), /can't start with a dot/)
  assert.equal(existsSync(join(there, 'reels', 'good.json')), false)
  assert.equal(existsSync(join(there, 'assets', 'first.png')), false)
  await assert.rejects(unpack(JSON.stringify({ sworeel: 1, reels: [{ name: 'good', reel: flow }], pictures: {} }), '../outside'), /can't start with a dot/)
  assert.equal(existsSync(join(there, 'reels')), false)
})

test('a broken file already in the library is left alone, and the reel arrives beside it', async () => {
  await mkdir(join(there, 'reels'), { recursive: true })
  await writeFile(join(there, 'reels', 'front-door.json'), '{ not json')
  assert.deepEqual(await unpack(await pack('front-door')), { added: ['front-door-2'], skipped: [] })
  assert.equal(await readFile(join(there, 'reels', 'front-door.json'), 'utf8'), '{ not json')
})

test('a reel that cannot be read is named when bundling fails', async () => {
  await writeFile(join(here, 'reels', 'web', 'broken.json'), '{ not json')
  await assert.rejects(pack('.'), /"web\/broken" could not be read/)
})
