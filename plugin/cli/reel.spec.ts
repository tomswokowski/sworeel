import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateReel } from '../core/reel.ts'
import { describeStep, drawText, gridToLines } from '../core/text.ts'
import { playheadAt, stepRestTime, timeline } from '../core/timing.ts'
import type { Reel } from '../core/reel.ts'

const flow = {
  title: 'Flow',
  nodes: [
    { id: 'a', label: 'A', col: 0, row: 0 },
    { id: 'b', label: 'B', col: 0, row: 1 },
  ],
  steps: [
    { caption: 'A calls B.', from: 'a', to: 'b', label: 'GET /' },
    { caption: 'B retries.', from: 'b', to: 'b', label: 'retry', style: 'error' },
  ],
}
const chart = {
  kind: 'chart',
  title: 'Chart',
  unit: 'ms',
  bars: [
    { id: 'x', label: 'Query', value: 140, hidden: true },
    { id: 'y', label: 'Render', value: 6 },
  ],
  steps: [
    { caption: 'The query appears.', show: ['x'], highlight: ['x'] },
    { caption: 'An index fixes it.', set: { x: 4 } },
  ],
}
const code = { kind: 'code', title: 'Code', code: 'a = 1\nb = 2\nc = a + b', steps: [{ caption: 'Add them.', lines: [3] }, { caption: 'Done.' }] }
const array = {
  kind: 'array',
  title: 'Array',
  cells: [3, 1, 2],
  steps: [
    { caption: 'Swap the first two.', swap: [0, 1], pointers: { i: 0, j: 1 } },
    { caption: 'Start again.', set: [9, 8], highlight: [1] },
  ],
}
const sequence = {
  kind: 'sequence',
  title: 'Sequence',
  actors: [
    { id: 'a', label: 'Browser' },
    { id: 'b', label: 'API' },
  ],
  steps: [
    { caption: 'Ask.', from: 'a', to: 'b', label: 'GET /' },
    { caption: 'Think.', from: 'b', to: 'b', label: 'work' },
    { caption: 'Answer.', from: 'b', to: 'a', label: '200', style: 'reply' },
  ],
}
const tree = {
  kind: 'tree',
  title: 'Tree',
  nodes: [
    { id: 'r', label: 'root' },
    { id: 'a', label: 'left', parent: 'r' },
    { id: 'b', label: 'right', parent: 'r', hidden: true },
    { id: 'c', label: 'leaf', parent: 'a' },
  ],
  steps: [{ caption: 'The left branch.', highlight: ['r', 'a'] }, { caption: 'The right appears.', show: ['b'] }],
}
const timelineReel = {
  kind: 'timeline',
  title: 'Timeline',
  events: [
    { id: 'x', when: '2013', label: 'Docker' },
    { id: 'y', when: '2014', label: 'Kubernetes', hidden: true },
  ],
  steps: [{ caption: 'First.', highlight: ['x'] }, { caption: 'Then.', show: ['y'] }],
}
const line = {
  kind: 'line',
  title: 'Line',
  unit: 'ms',
  x: ['Mon', 'Tue', 'Wed'],
  series: [{ id: 'p', label: 'p95', values: [10, 40, 20] }],
  steps: [{ caption: 'Monday.', upTo: 1 }, { caption: 'The week.', upTo: 3, mark: 1 }],
}
const pie = {
  kind: 'pie',
  title: 'Pie',
  slices: [
    { id: 'a', label: 'Chosen', value: 1 },
    { id: 'b', label: 'Dependencies', value: 3, hidden: true },
  ],
  steps: [{ caption: 'A quarter.', highlight: ['a'] }, { caption: 'The rest.', show: ['b'] }],
}
const gantt = {
  kind: 'gantt',
  title: 'Gantt',
  unit: 'day',
  tasks: [
    { id: 'a', label: 'Build', start: 0, end: 2 },
    { id: 'b', label: 'Ship', start: 2, end: 4, hidden: true },
  ],
  steps: [{ caption: 'Build first.', highlight: ['a'] }, { caption: 'Then ship.', show: ['b'], now: 2 }],
}
const scatter = {
  kind: 'scatter',
  title: 'Scatter',
  xLabel: 'Rows',
  yLabel: 'Time',
  points: [
    { id: 'a', x: 1, y: 2, group: 'Fast', label: 'by id' },
    { id: 'b', x: 80, y: 90, group: 'Slow', label: 'by text', hidden: true },
  ],
  steps: [{ caption: 'Fast ones.' }, { caption: 'Slow ones.', show: ['Slow'], highlight: ['b'] }],
}
const math = {
  kind: 'math',
  title: 'Math',
  lines: [
    { id: 'a', tex: 'k = \\log_2 n', note: 'looks needed' },
    { id: 'b', tex: '\\frac{n}{2^k} \\le 1 \\cdots', hidden: true },
  ],
  steps: [{ caption: 'The answer.', highlight: ['a'] }, { caption: 'Where it comes from.', show: ['b'] }],
}
const map = {
  kind: 'map',
  title: 'Map',
  view: 'europe',
  places: [
    { id: 'l', label: 'London', lat: 51.5, lon: -0.1 },
    { id: 'r', label: 'Rome', lat: 41.9, lon: 12.5 },
  ],
  steps: [{ caption: 'A request.', from: 'l', to: 'r', label: 'GET' }, { caption: 'Rome.', highlight: ['r'] }],
}
const picture = {
  kind: 'picture',
  title: 'Picture',
  src: 'shots/cart.png',
  steps: [{ caption: 'The whole thing.' }, { caption: 'The button.', focus: [0.5, 0.5, 0.25, 0.25], label: 'pay' }],
}
const screen = {
  kind: 'screen',
  title: 'Screen',
  address: 'shop.test/cart',
  elements: [
    { type: 'nav', text: 'shop', items: ['Cart'] },
    { type: 'heading', text: 'Your cart' },
    { type: 'row', children: [{ id: 'email', type: 'input', label: 'Email', value: 'a@b.c' }, { type: 'image' }] },
    { id: 'oops', type: 'notice', style: 'error', text: 'Card declined', hidden: true },
    { id: 'pay', type: 'button', style: 'primary', text: 'Pay' },
  ],
  steps: [{ caption: 'Press pay.', highlight: ['pay'], set: { pay: { text: 'Paying' } } }, { caption: 'It fails.', show: ['oops'] }],
}
const sketch = {
  kind: 'sketch',
  title: 'Sketch',
  shapes: [
    { id: 'a', type: 'box', x: 20, y: 30, w: 24, h: 14, label: 'Producer' },
    { id: 'b', type: 'ellipse', x: 80, y: 30, w: 24, h: 14, label: 'Worker' },
    { id: 'ab', type: 'arrow', from: 'a', to: 'b', label: 'jobs' },
    { id: 'job', type: 'icon', name: 'mail', x: 20, y: 30, hidden: true },
    { id: 'note', type: 'text', x: 50, y: 52, label: 'at its own pace' },
  ],
  steps: [{ caption: 'A job is made.', show: ['job'] }, { caption: 'It travels.', move: { job: [80, 30] }, highlight: ['b'] }],
}
const all = { flow, sequence, tree, timeline: timelineReel, gantt, chart, line, scatter, pie, code, array, math, map, picture, screen, sketch } as unknown as Record<string, Reel>

/** The picture as plain text once a step has settled. */
const shown = (reel: Reel, step: number) => gridToLines(drawText(reel, playheadAt(reel, stepRestTime(reel, step))), false).join('\n')

test('a valid reel of every kind passes, and has a length', () => {
  for (const [kind, reel] of Object.entries(all)) {
    assert.deepEqual(validateReel(reel), [], kind)
    assert.ok(timeline(reel).duration > 3000, kind)
  }
})

test('every kind draws as text and describes its steps', () => {
  assert.match(shown(all.flow!, 1), /↻/)
  assert.equal(describeStep(all.flow!, all.flow!.steps[1]!).text, 'B ↻  retry')

  assert.match(shown(all.chart!, 0), /Query +█{40} 140 ms/)
  assert.match(shown(all.chart!, 1), /Query +█ 4 ms/)
  assert.equal(describeStep(all.chart!, all.chart!.steps[1]!).text, 'Query → 4 ms')

  assert.match(shown(all.code!, 0), /▶ 3 │ c = a \+ b/)
  assert.equal(describeStep(all.code!, { caption: 'x', lines: [5, 3, 4, 9] }).text, 'lines 3–5, 9')

  // A walkthrough across files: each step shows the file named at or before it, with real line numbers.
  const files = {
    kind: 'code',
    title: 'Files',
    files: [
      { name: 'app/a.rb', code: 'def a\n  b\nend', start: 10 },
      { name: 'app/b.rb', code: 'x = ' + 'long_call(argument) '.repeat(6) },
    ],
    steps: [{ caption: 'Here.', lines: [11] }, { caption: 'There.', file: 'app/b.rb', lines: [1] }, { caption: 'Still there.' }],
  } as unknown as Reel
  assert.deepEqual(validateReel(files), [])
  assert.match(shown(files, 0), /app\/a\.rb\n.*\n +10 │ def a\n +▶ 11 │ +b/)
  assert.match(shown(files, 2), /app\/b\.rb/)
  // A long line is carried over, and only its first row has the number.
  assert.match(shown(files, 1), /▶ 1 │ x = long_call.*\n +│ +long_call/)
  assert.equal(describeStep(files, files.steps[1]!).text, 'app/b.rb   line 1')

  assert.match(shown(all.array!, 0), /│ +1 +│ +3 +│ +2 +│/)
  assert.match(shown(all.array!, 1), /│ +9 +│ +8 +│/)
  assert.equal(describeStep(all.array!, all.array!.steps[0]!).text, 'swap [0] ↔ [1]   i=0 j=1')
})

test('the kinds that build up show only what has been reached', () => {
  assert.match(shown(all.sequence!, 0), /Browser +API/)
  assert.match(shown(all.sequence!, 0), /GET \/ ━+▶/)
  assert.doesNotMatch(shown(all.sequence!, 0), /200/)
  assert.match(shown(all.sequence!, 2), /◀━+ 200/)
  assert.equal(describeStep(all.sequence!, all.sequence!.steps[1]!).text, 'API ⟲  work')

  assert.match(shown(all.tree!, 0), /root ◀\n +└─ left ◀\n +└─ leaf/)
  assert.match(shown(all.tree!, 1), /├─ left\n +│ +└─ leaf\n +└─ right/)
  assert.equal(describeStep(all.tree!, all.tree!.steps[1]!).text, '+ right')
  const listed = { ...tree, view: 'list', steps: [{ caption: 'As boxes.', view: 'boxes' }, { caption: 'As a listing.', view: 'list' }] } as unknown as Reel
  assert.deepEqual(validateReel(listed), [])
  assert.equal(describeStep(listed, listed.steps[1]!).text, 'as a listing')

  assert.match(shown(all.timeline!, 0), /2013 ◆─ Docker/)
  assert.doesNotMatch(shown(all.timeline!, 0), /Kubernetes/)
  assert.match(shown(all.timeline!, 1), /2014 ●─ Kubernetes/)

  assert.match(shown(all.line!, 0), /p95 +▂{4} +10 ms → 10 ms/)
  assert.match(shown(all.line!, 1), /p95 +▂{4}▇{4}▄{4} +10 ms → 20 ms/)
  assert.equal(describeStep(all.line!, all.line!.steps[1]!).text, 'up to Wed   at Tue: 40 ms')

  assert.match(shown(all.pie!, 0), /Chosen +█{6}░{18} 25% ◀/)
  assert.doesNotMatch(shown(all.pie!, 0), /Dependencies/)
  assert.match(shown(all.pie!, 1), /Dependencies +█{18}░{6} 75%/)
})

test('the later kinds draw as text too', () => {
  assert.match(shown(all.gantt!, 0), /Build +█{22}/)
  assert.doesNotMatch(shown(all.gantt!, 0), /Ship/)
  assert.match(shown(all.gantt!, 1), /Ship +·{22}█{22}/)
  assert.equal(describeStep(all.gantt!, all.gantt!.steps[1]!).text, '+ Ship   at 2 day')

  assert.match(shown(all.scatter!, 1), /▲ by text/)
  assert.match(shown(all.scatter!, 1), /● Fast +▲ Slow/)

  // Without a typesetter, formulas are written out in plain characters.
  assert.match(shown(all.math!, 0), /k = log_2 n ◀\n +looks needed/)
  assert.match(shown(all.math!, 1), /\(n\)\/\(2\^k\) ≤ 1 …/)

  assert.match(shown(all.map!, 1), /● London/)
  assert.match(shown(all.map!, 1), /◆ Rome/)
  assert.match(shown(all.map!, 1), /░{6}/)
  assert.equal(describeStep(all.map!, all.map!.steps[0]!).text, 'London → Rome  GET')

  assert.match(shown(all.picture!, 0), /picture: cart\.png/)
  assert.match(shown(all.picture!, 1), /┏━+┓/)
  // Marks show as a symbol where they point, with their words.
  const marked = { ...picture, steps: [{ caption: 'Look.', marks: [{ type: 'arrow', at: [0.2, 0.5], label: 'here' }, { type: 'circle', at: [0.7, 0.2] }, { type: 'box', area: [0.1, 0.7, 0.2, 0.2], label: 'these' }] }] } as unknown as Reel
  assert.deepEqual(validateReel(marked), [])
  assert.match(shown(marked, 0), /➤ here/)
  assert.match(shown(marked, 0), /◯/)
  assert.equal(describeStep(marked, marked.steps[0]!).text, 'here   these')
  // A step can switch to another image, which stays until the next switch.
  const flow = { kind: 'picture', title: 'Flow', steps: [{ caption: 'One.', src: 'a.png' }, { caption: 'Look.', focus: [0, 0, 0.5, 0.5] }, { caption: 'Two.', src: 'b.png' }, { caption: 'Still two.' }] } as unknown as Reel
  assert.deepEqual(validateReel(flow), [])
  assert.deepEqual([0, 1, 2, 3].map((step) => /picture: (\w)\.png/.exec(shown(flow, step))![1]), ['a', 'a', 'b', 'b'])
  assert.equal(describeStep(flow, flow.steps[2]!).text, '→ b.png')

  assert.match(shown(all.screen!, 0), /shop\.test\/cart/)
  assert.match(shown(all.screen!, 0), /\[ Paying \] +│ ◀/)
  assert.doesNotMatch(shown(all.screen!, 0), /Card declined/)
  assert.match(shown(all.screen!, 1), /! Card declined/)
  assert.equal(describeStep(all.screen!, all.screen!.steps[0]!).text, '◆ Pay   Pay → Paying')

  assert.match(shown(all.sketch!, 1), /│ +Producer +│/)
  assert.match(shown(all.sketch!, 1), /╭─+╮/)
  assert.match(shown(all.sketch!, 1), /jobs/)
})

test('mistakes are named precisely', () => {
  const problems = (reel: object) => validateReel(reel).join(' | ')
  assert.match(problems({ ...chart, kind: 'hologram' }), /"kind" must be one of: flow, sequence, tree, timeline, gantt, chart, line, scatter, pie, code, array, math, map, picture, screen, sketch/)
  assert.match(problems({ ...flow, nodes: [{ id: 'a', label: 'A', col: 0, row: 0, icon: 'unicorn' }] }), /icon "unicorn" is not one of the bundled icons/)
  assert.match(problems({ ...gantt, tasks: [{ id: 'a', label: 'A', start: 3, end: 1 }] }), /tasks\[0\]\.end must be after its start/)
  assert.match(problems({ ...scatter, steps: [{ caption: 'x', show: ['Nope'] }] }), /show refers to unknown id "Nope"/)
  assert.match(problems({ ...math, lines: [{ id: 'a', tex: '$x$' }] }), /without dollar signs/)
  assert.match(problems({ ...map, places: [{ id: 'a', label: 'A', lat: 120, lon: 0 }] }), /lat must be a number from -90 to 90/)
  assert.match(problems({ ...map, view: 'atlantis' }), /"view" must be one of world, europe/)
  assert.match(problems({ ...picture, src: 'notes.txt' }), /"src" must be a PNG or JPEG file/)
  assert.match(problems({ kind: 'picture', title: 'x', steps: [{ caption: 'c' }] }), /needs "src", on the reel or on its first step/)
  assert.match(problems({ ...picture, steps: [{ caption: 'c', marks: [{ type: 'squiggle' }] }] }), /marks\[0\]\.type must be one of: arrow, circle, box, note/)
  assert.match(problems({ ...picture, steps: [{ caption: 'c', marks: [{ type: 'arrow', at: [1.4, 0] }] }] }), /marks\[0\]\.at must be a position \[x, y\] as fractions/)
  assert.match(problems({ ...picture, steps: [{ caption: 'c', marks: [{ type: 'note', at: [0.5, 0.5] }] }] }), /marks\[0\] needs a "label"/)
  assert.match(problems({ ...picture, steps: [{ caption: 'c', src: 'clip.mp4' }] }), /steps\[0\]\.src must be a PNG or JPEG file/)
  assert.match(problems({ ...picture, steps: [{ caption: 'x', focus: [0.8, 0, 0.5, 0.5] }] }), /focus must be \[x, y, width, height\] as fractions/)
  assert.match(problems({ ...screen, elements: [{ type: 'carousel' }] }), /elements\[0\]\.type must be one of: nav, heading/)
  assert.match(problems({ ...screen, steps: [{ caption: 'x', set: { nope: { text: 'y' } } }] }), /set refers to unknown id "nope"/)
  assert.match(problems({ ...sketch, shapes: [{ id: 'l', type: 'line', from: 'ghost', to: [1, 2] }] }), /from must be a position \[x, y\] or the id of/)
  assert.match(problems({ ...sketch, steps: [{ caption: 'x', move: { ab: [1, 2] } }] }), /move refers to "ab", which is not a box/)
  assert.match(problems({ ...sequence, steps: [{ caption: 'x', from: 'a', to: 'zzz' }] }), /steps\[0\]\.to refers to unknown actor "zzz"/)
  assert.match(problems({ ...tree, nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }), /exactly one node without a "parent"; this one has 2/)
  assert.match(problems({ ...tree, view: 'radial' }), /"view" must be "boxes" or "list"/)
  assert.match(problems({ ...tree, steps: [{ caption: 'c', view: 'grid' }] }), /steps\[0\]\.view must be "boxes" or "list"/)
  assert.match(problems({ ...tree, nodes: [{ id: 'r', label: 'R' }, { id: 'a', label: 'A', parent: 'b' }, { id: 'b', label: 'B', parent: 'a' }] }), /is its own ancestor/)
  assert.match(problems({ ...timelineReel, events: [{ id: 'x', label: 'No date' }] }), /events\[0\]\.when must be a non-empty string/)
  assert.match(problems({ ...line, series: [{ id: 'p', label: 'p95', values: [1, 2] }] }), /values has 2 values, but "x" has 3 labels/)
  assert.match(problems({ ...line, steps: [{ caption: 'x', upTo: 9 }] }), /upTo must be a whole number from 1 to 3/)
  assert.match(problems({ ...pie, slices: [{ id: 'a', label: 'A', value: 0 }] }), /must add up to more than 0/)
  assert.match(problems({ ...flow, steps: [{ caption: 'x', from: 'a', to: 'zzz' }] }), /steps\[0\]\.to refers to unknown node "zzz"/)
  assert.match(problems({ ...chart, steps: [{ caption: 'x', set: { nope: 1 } }] }), /steps\[0\]\.set refers to unknown id "nope"/)
  assert.match(problems({ ...chart, bars: [{ id: 'x', label: 'X', value: -1 }] }), /bars\[0\]\.value must be a number of 0 or more/)
  assert.match(problems({ ...code, steps: [{ caption: 'x', lines: [4] }] }), /lines has 4, but the code has lines 1 to 3/)
  assert.match(problems({ kind: 'code', title: 'x', files: [{ name: 'a.rb', code: 'a', start: 5 }], steps: [{ caption: 'c', lines: [1] }] }), /lines has 1, but "a\.rb" has lines 5 to 5/)
  assert.match(problems({ kind: 'code', title: 'x', files: [{ name: 'a.rb', code: 'a' }], steps: [{ caption: 'c', file: 'b.rb' }] }), /file refers to unknown file "b\.rb"/)
  assert.match(problems({ kind: 'code', title: 'x', steps: [{ caption: 'c' }] }), /needs "code", or "files"/)
  assert.match(problems({ ...array, steps: [{ caption: 'x', swap: [0, 3] }] }), /swap has 3, but positions run from 0 to 2/)
  // After a step replaces the cells, later positions are checked against the new length.
  assert.match(problems({ ...array, steps: [{ caption: 'x', set: [1] }, { caption: 'y', highlight: [1] }] }), /steps\[1\]\.highlight has 1, but positions run from 0 to 0/)
  assert.match(problems({ ...flow, steps: [{}] }), /steps\[0\]\.caption must be a non-empty string/)
})

const problems = (reel: unknown) => validateReel(reel).join('\n')

test('values of the wrong kind are refused, not left to break the drawing', () => {
  const screen = (elements: unknown[], steps: unknown[] = [{ caption: 'A page.' }]) => ({ kind: 'screen', title: 'Screen', elements, steps })
  assert.match(problems(screen([{ type: 'text', text: 5 }])), /elements\[0\]\.text must be a string/)
  assert.match(problems(screen([{ type: 'input', value: 5 }])), /elements\[0\]\.value must be a string/)
  assert.match(problems(screen([{ type: 'image', size: 'huge' }])), /elements\[0\]\.size must be one of: short, tall/)
  const set = (change: unknown) => screen([{ id: 'p', type: 'text', text: 'Hi' }], [{ caption: 'It changes.', set: { p: change } }])
  assert.match(problems(set({ text: 5 })), /set\.p\.text must be a string/)
  assert.match(problems(set({ type: 'row' })), /set\.p\.type can't be changed by a step/)
  assert.equal(problems(set({ text: 'Bye' })), '')

  const picture = (mark: unknown) => ({ kind: 'picture', title: 'Picture', src: 'a.png', steps: [{ caption: 'Look.', marks: [mark] }] })
  assert.match(problems(picture({ type: 'circle', at: [0.5, 0.5], size: -0.2 })), /size must be a fraction/)
  assert.equal(problems(picture({ type: 'circle', at: [0.5, 0.5], size: 0.2 })), '')

  const sketch = (shape: unknown) => ({ kind: 'sketch', title: 'Sketch', shapes: [shape], steps: [{ caption: 'A shape.' }] })
  assert.match(problems(sketch({ id: 'a', type: 'box', x: 10, y: 10, w: 10, h: 10, label: 5 })), /shapes\[0\]\.label must be a string/)
  assert.match(problems(sketch({ id: 'a', type: 'icon', x: 10, y: 10, name: 'nope' })), /shapes\[0\]\.name "nope" is not one of the bundled icons/)

  assert.match(problems({ ...flow, nodes: [{ id: 'a', label: 'A', col: 100000000, row: 0 }, flow.nodes[1]] }), /"col" and "row" from 0 to 40/)
  assert.match(problems({ ...flow, steps: [{ caption: 'A calls B.', from: 'a', to: 'b', label: 5 }] }), /steps\[0\]\.label must be a string/)
  assert.match(problems({ ...chart, bars: [{ id: 'x', label: 'Query', value: 1, hidden: 'false' }, chart.bars[1]] }), /bars\[0\]\.hidden must be true or false/)
})

test('a step is checked against what the reel can show', () => {
  const gantt = { kind: 'gantt', title: 'Plan', tasks: [{ id: 't', label: 'Build', start: 0, end: 10 }], steps: [{ caption: 'Now.', now: 25 }] }
  assert.match(problems(gantt), /now must be a number on the scale, which runs from 0 to 10/)
  const array = { kind: 'array', title: 'Array', cells: [1, 2, 3], steps: [{ caption: 'Both.', set: [7, 8, 9], swap: [0, 2] }] }
  assert.match(problems(array), /has both "set" and "swap"/)
  const map = { kind: 'map', title: 'Map', view: [0, 80, 40, 100], places: [{ id: 'p', label: 'P', lat: 0, lon: 0 }], steps: [{ caption: 'A place.' }] }
  assert.match(problems(map), /latitudes from -85 to 85/)
})

test('numbers keep the decimals their size makes worth reading', async () => {
  const { formatNumber } = await import('../core/canvas.ts')
  assert.deepEqual([0, 0.02, 1.875, 3.75, 18.75, 187.5, 1250, 1234567.5, -2.5, 100].map(formatNumber), ['0', '0.02', '1.875', '3.75', '18.75', '187.5', '1,250', '1,234,567.5', '-2.5', '100'])
})

test('a formula that cannot be typeset still reads correctly as text', async () => {
  const maths = (tex: string) => gridToLines(drawText({ kind: 'math', title: 'M', lines: [{ id: 'l', tex }], steps: [{ caption: 'A line.' }] } as unknown as Reel, null), false).join('\n')
  assert.match(maths('2^{32}'), /2³²/)
  assert.match(maths('x^{n+1}'), /xⁿ⁺¹/)
  assert.match(maths('e^{-x}'), /e\^\(-x\)/)
  assert.match(maths('a \\pmod n'), /a pmod n/)
  assert.match(maths('x \\leftarrow y'), /x ← y/)
})

test('a line grows one point at a time, reaching its last point only at the end', async () => {
  const { draw } = await import('../core/kinds/line.ts')
  const { FORMATS } = await import('../core/canvas.ts')
  const reel = { kind: 'line', title: 'L', x: ['a', 'b', 'c', 'd', 'e'], series: [{ id: 's', label: 'S', values: [1, 2, 3, 4, 5] }], steps: [{ caption: 'It grows.', upTo: 5 }] }
  assert.equal(problems(reel), '')
  // Count the dots (full circles of radius 7) drawn at a moment in the step.
  const dotsAt = (elapsed: number) => {
    let dots = 0
    const ctx = new Proxy({ measureText: () => ({ width: 10 }), arc: (_x: number, _y: number, radius: number) => void (radius === 7 && dots++) } as Record<string, unknown>, {
      get: (target, key: string) => target[key] ?? (() => {}),
      set: () => true,
    })
    const f = FORMATS.wide
    draw(ctx as never, reel as never, f, { x: f.side, y: f.top, w: f.w - f.side * 2, h: f.h - f.top - f.bottom }, { index: 0, elapsed })
    return dots
  }
  const counts = [35, 200, 350, 500, 700].map(dotsAt)
  assert.equal(counts[0], 1)
  assert.equal(counts.at(-1), 5)
  assert.deepEqual(counts, [...counts].sort((a, b) => a - b))
  assert.ok(new Set(counts).size >= 4, `expected the points to arrive one by one, got ${counts}`)
})
