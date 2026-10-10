import assert from 'node:assert/strict'
import { test } from 'node:test'
import { typeset } from '../host/typeset.ts'

test('a formula becomes shapes with a size in ems', () => {
  const formula = typeset('x = \\frac{a}{b}', (d) => d)
  assert.ok(formula.width > 2 && formula.width < 6, `width ${formula.width}`)
  assert.ok(formula.height > 1.5, `height ${formula.height}`)
  // x, =, a, b and the fraction bar.
  assert.equal(formula.shapes.length, 5)
  for (const shape of formula.shapes) {
    assert.ok(shape.x >= 0 && shape.x <= formula.width)
    assert.ok(shape.y >= 0 && shape.y <= formula.height)
  }
})

test('bad TeX is reported with what is wrong', () => {
  assert.throws(() => typeset('\\frac{1}{', (d) => d), /not valid TeX: Missing close brace/)
  assert.throws(() => typeset('\\nosuchthing', (d) => d), /Undefined control sequence/)
})
