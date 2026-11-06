// One small, valid reel of every kind, for the tests to draw and check.
import type { Reel } from '../../plugin/core/reel.ts'

export const flow = {
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
export const chart = {
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
export const code = { kind: 'code', title: 'Code', code: 'a = 1\nb = 2\nc = a + b', steps: [{ caption: 'Add them.', lines: [3] }, { caption: 'Done.' }] }
export const array = {
  kind: 'array',
  title: 'Array',
  cells: [3, 1, 2],
  steps: [
    { caption: 'Swap the first two.', swap: [0, 1], pointers: { i: 0, j: 1 } },
    { caption: 'Start again.', set: [9, 8], highlight: [1] },
  ],
}
export const sequence = {
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
export const tree = {
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
export const timelineReel = {
  kind: 'timeline',
  title: 'Timeline',
  events: [
    { id: 'x', when: '2013', label: 'Docker' },
    { id: 'y', when: '2014', label: 'Kubernetes', hidden: true },
  ],
  steps: [{ caption: 'First.', highlight: ['x'] }, { caption: 'Then.', show: ['y'] }],
}
export const line = {
  kind: 'line',
  title: 'Line',
  unit: 'ms',
  x: ['Mon', 'Tue', 'Wed'],
  series: [{ id: 'p', label: 'p95', values: [10, 40, 20] }],
  steps: [{ caption: 'Monday.', upTo: 1 }, { caption: 'The week.', upTo: 3, mark: 1 }],
}
export const pie = {
  kind: 'pie',
  title: 'Pie',
  slices: [
    { id: 'a', label: 'Chosen', value: 1 },
    { id: 'b', label: 'Dependencies', value: 3, hidden: true },
  ],
  steps: [{ caption: 'A quarter.', highlight: ['a'] }, { caption: 'The rest.', show: ['b'] }],
}
export const gantt = {
  kind: 'gantt',
  title: 'Gantt',
  unit: 'day',
  tasks: [
    { id: 'a', label: 'Build', start: 0, end: 2 },
    { id: 'b', label: 'Ship', start: 2, end: 4, hidden: true },
  ],
  steps: [{ caption: 'Build first.', highlight: ['a'] }, { caption: 'Then ship.', show: ['b'], now: 2 }],
}
export const scatter = {
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
export const math = {
  kind: 'math',
  title: 'Math',
  lines: [
    { id: 'a', tex: 'k = \\log_2 n', note: 'looks needed' },
    { id: 'b', tex: '\\frac{n}{2^k} \\le 1 \\cdots', hidden: true },
  ],
  steps: [{ caption: 'The answer.', highlight: ['a'] }, { caption: 'Where it comes from.', show: ['b'] }],
}
export const map = {
  kind: 'map',
  title: 'Map',
  view: 'europe',
  places: [
    { id: 'l', label: 'London', lat: 51.5, lon: -0.1 },
    { id: 'r', label: 'Rome', lat: 41.9, lon: 12.5 },
  ],
  steps: [{ caption: 'A request.', from: 'l', to: 'r', label: 'GET' }, { caption: 'Rome.', highlight: ['r'] }],
}
export const picture = {
  kind: 'picture',
  title: 'Picture',
  src: 'shots/cart.png',
  steps: [{ caption: 'The whole thing.' }, { caption: 'The button.', focus: [0.5, 0.5, 0.25, 0.25], label: 'pay' }],
}
export const screen = {
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
export const sketch = {
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
export const all = { flow, sequence, tree, timeline: timelineReel, gantt, chart, line, scatter, pie, code, array, math, map, picture, screen, sketch } as unknown as Record<string, Reel>
