import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyTheme, COLORS, PALETTE, TINTS } from '../../plugin/core/canvas.ts'
import { validateReel } from '../../plugin/core/reel.ts'
import { DEFAULT_THEME, mix, validateTheme } from '../../plugin/core/theme.ts'

test('a theme replaces only the colours it names, and the next frame starts clean', () => {
  applyTheme({ primary: '#ff6600', background: '#ffffff' })
  assert.equal(COLORS.request, '#ff6600')
  assert.equal(COLORS.bg, '#ffffff')
  assert.equal(COLORS.text, DEFAULT_THEME.text)
  assert.equal(PALETTE[0], '#ff6600')
  assert.equal(TINTS.cyan, '#ff6600')
  // The calm accent follows the main one.
  assert.equal(COLORS.quiet, mix('#ff6600', '#ffffff', 0.4))

  applyTheme()
  assert.equal(COLORS.request, DEFAULT_THEME.primary)
  assert.equal(COLORS.bg, DEFAULT_THEME.background)
  assert.equal(COLORS.quiet, '#17829a')
  assert.deepEqual(PALETTE, [DEFAULT_THEME.primary, DEFAULT_THEME.secondary, DEFAULT_THEME.warning, DEFAULT_THEME.success, DEFAULT_THEME.error, DEFAULT_THEME.muted])
})

test('only known colours in hex are accepted', () => {
  assert.deepEqual(validateTheme(undefined, 'theme'), [])
  assert.deepEqual(validateTheme({ primary: '#f60', text: '#102030' }, 'theme'), [])
  assert.match(validateTheme({ primary: 'orange' }, 'theme')[0]!, /must be a hex colour/)
  assert.match(validateTheme({ accent: '#ff6600' }, 'theme')[0]!, /not a colour that can be set/)
  assert.match(validateTheme('dark', 'theme')[0]!, /must be an object/)
})

test('a reel can carry its own theme, and a bad one is a problem with the reel', () => {
  const reel = { title: 'T', nodes: [{ id: 'a', label: 'A', col: 0, row: 0 }, { id: 'b', label: 'B', col: 1, row: 0 }], steps: [{ caption: 'A calls B.', from: 'a', to: 'b', label: 'GET /' }] }
  assert.deepEqual(validateReel({ ...reel, theme: { primary: '#ff6600' } }), [])
  assert.match(validateReel({ ...reel, theme: { primary: 'nope' } })[0]!, /"theme".primary must be a hex colour/)
})

test('mixing colours', () => {
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080')
  assert.equal(mix('#f00', '#00f', 0), '#ff0000')
})
