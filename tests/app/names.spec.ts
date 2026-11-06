// How the desktop app names reels, folders and files, which must agree with the command.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { baseName, fullName, within } from '../../src/names.ts'

test('a reel is named as the command names it: its folder, then its name', () => {
  assert.equal(fullName({ name: 'cors', folder: 'web' }), 'web/cors')
  assert.equal(fullName({ name: 'cors', folder: '' }), 'cors')
})

test('a folder is within itself and its parents, and not within a folder that merely starts the same', () => {
  assert.ok(within('web', 'web'))
  assert.ok(within('web/auth', 'web'))
  assert.ok(!within('website', 'web'))
  assert.ok(!within('web', 'web/auth'))
})

test("a path's last part is found with either kind of slash", () => {
  assert.equal(baseName('/home/me/Documents/SwoReel/cors-wide.mp4'), 'cors-wide.mp4')
  assert.equal(baseName('C:\\Users\\me\\Documents\\SwoReel\\cors-wide.mp4'), 'cors-wide.mp4')
  assert.equal(baseName('cors.json'), 'cors.json')
})
