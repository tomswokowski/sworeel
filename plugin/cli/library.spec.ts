import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { addAsset, createFolder, duplicateReel, existingFolder, moveFolder, moveReel, renameFolder, renameReel, reelPath } from './library.ts'

let root: string
const has = (relative: string) => existsSync(join(root, relative))

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'sworeel-test-'))
  await mkdir(join(root, 'web'))
  await writeFile(join(root, 'front-door.json'), '{}')
  await writeFile(join(root, 'web', 'cors.json'), '{}')
})

afterEach(() => rm(root, { recursive: true }))

test('renames a reel inside its folder and refuses to overwrite', async () => {
  assert.equal(await renameReel(root, 'web/cors', 'preflight'), 'web/preflight')
  assert.ok(has('web/preflight.json'))
  await writeFile(join(root, 'other.json'), '{}')
  await assert.rejects(renameReel(root, 'front-door', 'other'), /already exists/)
})

test('moves a reel, creating the folder, and back to the top level', async () => {
  assert.equal(await moveReel(root, 'front-door', 'web/gateway'), 'web/gateway/front-door')
  assert.ok(has('web/gateway/front-door.json'))
  assert.equal(await moveReel(root, 'web/gateway/front-door', '.'), 'front-door')
  assert.ok(has('front-door.json'))
})

test('duplicates with numbered names, or a given name', async () => {
  assert.equal(await duplicateReel(root, 'front-door'), 'front-door copy')
  assert.equal(await duplicateReel(root, 'front-door'), 'front-door copy 2')
  assert.equal(await duplicateReel(root, 'web/cors', 'cors-v2'), 'web/cors-v2')
  await assert.rejects(duplicateReel(root, 'web/cors', 'cors-v2'), /already exists/)
})

test('creates and renames folders', async () => {
  await createFolder(root, 'web/auth')
  assert.ok(has('web/auth'))
  await assert.rejects(createFolder(root, 'web/auth'), /already exists/)
  assert.equal(await renameFolder(root, 'web', 'frontend'), 'frontend')
  assert.ok(has('frontend/cors.json'))
  await assert.rejects(existingFolder(root, 'web'), /no folder/)
})

test('moves a folder with its reels, but never into itself', async () => {
  await createFolder(root, 'drafts')
  assert.equal(await moveFolder(root, 'web', 'drafts'), 'drafts/web')
  assert.ok(has('drafts/web/cors.json'))
  assert.equal(await moveFolder(root, 'drafts/web', '.'), 'web')
  assert.ok(has('web/cors.json'))
  await assert.rejects(moveFolder(root, 'web', 'web'), /into itself/)
  await createFolder(root, 'web/inner')
  await assert.rejects(moveFolder(root, 'web', 'web/inner'), /into itself/)
  await createFolder(root, 'drafts/web')
  await assert.rejects(moveFolder(root, 'web', 'drafts'), /already exists/)
})

test('rejects names that are unsafe or escape the library', async () => {
  for (const name of ['', '  ', '../escape', 'a/b', '.hidden', 'what?']) {
    await assert.rejects(renameReel(root, 'front-door', name), Error, `${JSON.stringify(name)} should be rejected`)
  }
  assert.throws(() => reelPath(root, '../outside'))
  assert.throws(() => reelPath(root, 'web/../../outside'))
  await assert.rejects(moveReel(root, 'front-door', '../elsewhere'))
  await assert.rejects(createFolder(root, '..'))
})

test('says so when the reel does not exist', async () => {
  await assert.rejects(renameReel(root, 'missing', 'x'), /no reel called "missing"/)
})

test('adds pictures to the store once, and keeps different ones apart', async () => {
  const store = `${root}-assets`
  const png = (text: string) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(text)])
  await writeFile(join(root, 'shot.png'), png('first image'))
  assert.equal(await addAsset(store, join(root, 'shot.png')), 'shot.png')
  // The same picture again is the same entry.
  assert.equal(await addAsset(store, join(root, 'shot.png')), 'shot.png')
  // A different picture with the same name is kept alongside it.
  await writeFile(join(root, 'shot.png'), png('second image'))
  assert.equal(await addAsset(store, join(root, 'shot.png')), 'shot-2.png')
  assert.equal(await addAsset(store, join(root, 'shot.png'), 'checkout'), 'checkout.png')
  await assert.rejects(addAsset(store, join(root, 'front-door.json')), /PNG or JPEG/)
  await rm(store, { recursive: true })
})
