import { ICONS } from './data/icons.ts'
import { validateTheme, type Theme } from './theme.ts'

// The reel file format. A reel is plain JSON, so it can be written by hand or by an agent.
// Every reel has a title, a kind, and steps that each carry a caption; the rest depends on
// the kind.

export type MessageStyle = 'request' | 'reply' | 'error'
export type Kind = 'flow' | 'sequence' | 'tree' | 'timeline' | 'gantt' | 'chart' | 'line' | 'scatter' | 'pie' | 'code' | 'array' | 'math' | 'map' | 'picture' | 'screen' | 'sketch'

// --- flow: boxes on a grid, and messages travelling between them --------------------------

export interface ReelNode {
  id: string
  label: string
  /** Smaller second line, e.g. the technology. */
  sub?: string
  /** One of the bundled icons, drawn beside the label, e.g. `database`. */
  icon?: string
  /** Position on a logical grid; the renderer scales the grid to fit each format. */
  col: number
  row: number
  /** Hidden until a step reveals it with `show`. */
  hidden?: boolean
}

export interface ReelGroup {
  id: string
  label: string
  /** Ids of the nodes the box is drawn around. */
  nodes: string[]
  hidden?: boolean
}

export interface FlowStep {
  /** The sentence shown under the diagram while this step plays. */
  caption: string
  /** Node or group ids to reveal at the start of this step. */
  show?: string[]
  /** A message travelling between two nodes; the same node twice is a loop back to itself. */
  from?: string
  to?: string
  /** Text shown beside the edge while the message travels. */
  label?: string
  /** How the message is drawn. Defaults to `request`. */
  style?: MessageStyle
}

export interface FlowReel {
  kind?: 'flow'
  title: string
  nodes: ReelNode[]
  groups?: ReelGroup[]
  steps: FlowStep[]
}

// --- chart: horizontal bars, for comparing quantities --------------------------------------

export interface Bar {
  id: string
  label: string
  value: number
  /** Hidden until a step reveals it with `show`. */
  hidden?: boolean
}

export interface ChartStep {
  caption: string
  /** Bar ids to reveal, growing from zero. */
  show?: string[]
  /** Bar ids to emphasise; the others are dimmed for this step. */
  highlight?: string[]
  /** New values for bars, by id; each bar animates to its new length and stays there. */
  set?: Record<string, number>
}

export interface ChartReel {
  kind: 'chart'
  title: string
  /** Written after every value, e.g. `ms` or `%`. */
  unit?: string
  /** The value a full-width bar stands for. Defaults to the largest value in the reel. */
  max?: number
  bars: Bar[]
  steps: ChartStep[]
}

// --- code: a listing, with the lines being discussed lit up --------------------------------

export interface CodeFile {
  /** The file's path, shown above the listing: `config/routes.rb`. */
  name: string
  /** The listing, with `\n` between lines. It can be an excerpt. */
  code: string
  /** The line number of the listing's first line in the real file, for an excerpt. Defaults to 1. */
  start?: number
}

export interface CodeStep {
  caption: string
  /** The file to switch to, by name, which stays for the steps after it. */
  file?: string
  /** The line numbers to light up for this step, as they are numbered in the listing. */
  lines?: number[]
}

export interface CodeReel {
  kind: 'code'
  title: string
  /** One listing, with `\n` between lines. Use `files` instead to walk through several. */
  code?: string
  /** Several listings, each with a name. The first shows until a step names another. */
  files?: CodeFile[]
  steps: CodeStep[]
}

// --- array: a row of cells, for walking through an algorithm -------------------------------

export type Cell = string | number

export interface ArrayStep {
  caption: string
  /** Cell positions, from 0, to emphasise. */
  highlight?: number[]
  /** Cell positions to fade, e.g. the part already ruled out. */
  dim?: number[]
  /** Named markers pointing at cells, e.g. `{ "lo": 0, "hi": 5 }`. */
  pointers?: Record<string, number>
  /** Two positions whose cells change places. The change stays for later steps. */
  swap?: [number, number]
  /** Replaces every cell. The change stays for later steps. */
  set?: Cell[]
}

export interface ArrayReel {
  kind: 'array'
  title: string
  cells: Cell[]
  steps: ArrayStep[]
}

// --- sequence: actors side by side, and the messages between them, top to bottom ------------

export interface Actor {
  id: string
  label: string
  /** One of the bundled icons, drawn beside the label, e.g. `user`. */
  icon?: string
}

export interface SequenceStep {
  caption: string
  /** A message from one actor to another; the same actor twice is a note to self. */
  from?: string
  to?: string
  /** Text written on the arrow. */
  label?: string
  style?: MessageStyle
}

export interface SequenceReel {
  kind: 'sequence'
  title: string
  actors: Actor[]
  steps: SequenceStep[]
}

// --- tree: a hierarchy, drawn from the root down --------------------------------------------

export interface TreeNode {
  id: string
  label: string
  /** The id of the node above this one. Exactly one node, the root, has none. */
  parent?: string
  /** In the `list` view, the icon beside the label. Left out, it is a folder or a file, judged from the label. */
  icon?: string
  /** Hidden until a step reveals it with `show`. */
  hidden?: boolean
}

/** How a tree is drawn: `boxes` joined by lines from the root down, or an indented `list` like a file browser. */
export type TreeView = 'boxes' | 'list'

export interface TreeStep {
  caption: string
  /** A different way of drawing the tree to switch to, which stays for the steps after it. */
  view?: TreeView
  show?: string[]
  /** Node ids to emphasise. A line between two emphasised nodes is emphasised too, so a list of ids from the root down marks a path. */
  highlight?: string[]
}

export interface TreeReel {
  kind: 'tree'
  title: string
  /** How the tree is drawn to begin with. Defaults to `boxes`. */
  view?: TreeView
  nodes: TreeNode[]
  steps: TreeStep[]
}

// --- timeline: events in order along a line -------------------------------------------------

export interface TimelineEvent {
  id: string
  /** When it happened, as it should read: `2013`, `Day 2`, `09:41`. */
  when: string
  label: string
  hidden?: boolean
}

export interface TimelineStep {
  caption: string
  show?: string[]
  highlight?: string[]
}

export interface TimelineReel {
  kind: 'timeline'
  title: string
  events: TimelineEvent[]
  steps: TimelineStep[]
}

// --- line: one to three series plotted over the same points ---------------------------------

export interface Series {
  id: string
  label: string
  /** One value for each entry in `x`. */
  values: number[]
}

export interface LineStep {
  caption: string
  /** How many points, from the left, are drawn by the end of this step. Stays for later steps. */
  upTo?: number
  /** Series ids to emphasise for this step. */
  highlight?: string[]
  /** A position in `x`, from 0, to mark with a guide line and its values. */
  mark?: number
}

export interface LineReel {
  kind: 'line'
  title: string
  unit?: string
  /** The labels along the bottom, left to right. */
  x: string[]
  series: Series[]
  steps: LineStep[]
}

// --- pie: shares of a whole -----------------------------------------------------------------

export interface Slice {
  id: string
  label: string
  value: number
  hidden?: boolean
}

export interface PieStep {
  caption: string
  show?: string[]
  highlight?: string[]
}

export interface PieReel {
  kind: 'pie'
  title: string
  slices: Slice[]
  steps: PieStep[]
}

// --- gantt: tasks as bars along a shared scale, showing when each starts and ends ----------

export interface Task {
  id: string
  label: string
  /** Where the bar starts and ends on the scale, in the reel's unit. */
  start: number
  end: number
  hidden?: boolean
}

export interface GanttStep {
  caption: string
  show?: string[]
  highlight?: string[]
  /** A position on the scale to mark with a vertical line, e.g. today. */
  now?: number
}

export interface GanttReel {
  kind: 'gantt'
  title: string
  /** What the scale counts, e.g. `week` or `ms`. */
  unit?: string
  tasks: Task[]
  steps: GanttStep[]
}

// --- scatter: points placed by two measurements ---------------------------------------------

export interface Point {
  id: string
  x: number
  y: number
  /** Written beside the point when it is emphasised. */
  label?: string
  /** Points in the same group share a colour, and can be revealed or emphasised together. */
  group?: string
  hidden?: boolean
}

export interface ScatterStep {
  caption: string
  /** Point ids or group names to reveal. */
  show?: string[]
  /** Point ids or group names to emphasise. */
  highlight?: string[]
}

export interface ScatterReel {
  kind: 'scatter'
  title: string
  /** What each axis measures, written along it. */
  xLabel: string
  yLabel: string
  points: Point[]
  steps: ScatterStep[]
}

// --- math: formulas, one under another, as a derivation or a set of definitions -------------

export interface MathLine {
  id: string
  /** The formula in TeX, without dollar signs: `x = \\frac{a}{b}`. */
  tex: string
  /** A few plain words shown under the formula, e.g. what it is called. */
  note?: string
  hidden?: boolean
}

export interface MathStep {
  caption: string
  show?: string[]
  highlight?: string[]
}

export interface MathReel {
  kind: 'math'
  title: string
  lines: MathLine[]
  steps: MathStep[]
}

// --- map: places on a map of the world, and messages between them --------------------------

export interface Place {
  id: string
  label: string
  /** Degrees north (negative for south) and east (negative for west). */
  lat: number
  lon: number
  hidden?: boolean
}

export type MapView = 'world' | 'europe' | 'north-america' | 'south-america' | 'asia' | 'africa' | 'oceania'

export interface MapStep {
  caption: string
  show?: string[]
  highlight?: string[]
  /** A message travelling from one place to another. */
  from?: string
  to?: string
  label?: string
  style?: MessageStyle
}

export interface MapReel {
  kind: 'map'
  title: string
  /** The part of the world to show: a named region, or `[west, south, east, north]` in degrees. Left out, it fits the places. */
  view?: MapView | [number, number, number, number]
  places: Place[]
  steps: MapStep[]
}

// --- picture: an image, with parts of it picked out one at a time ---------------------------

/** Something drawn over a picture for one step. Positions are fractions of the picture, from its top left. */
export interface Mark {
  type: 'arrow' | 'circle' | 'box' | 'note'
  /** For arrow: where it points. For circle: its centre. For note: where the words go. */
  at?: [number, number]
  /** For arrow: where it starts. Left out, it comes in from the side with more room. */
  from?: [number, number]
  /** For box: `[x, y, width, height]`. Unlike `focus`, it dims nothing. */
  area?: [number, number, number, number]
  /** For circle: its width as a fraction of the picture's width. Defaults to 0.08. */
  size?: number
  /** Words at an arrow's tail, beside a circle, above a box; for a note, the words themselves. */
  label?: string
  color?: SketchColor
}

export interface PictureStep {
  caption: string
  /** Arrows, circles, boxes and notes drawn over the picture for this step. */
  marks?: Mark[]
  /** A different image to switch to, which stays for the steps after it. Lets one reel walk through several screenshots. */
  src?: string
  /** The part to pick out, as `[x, y, width, height]` in fractions of the picture, from its top left. Left out, the whole picture shows. */
  focus?: [number, number, number, number]
  /** A few words written beside the part picked out. */
  label?: string
}

export interface PictureReel {
  kind: 'picture'
  title: string
  /** The image file: a PNG or JPEG, as a path from the reel file's own folder, or an absolute path. May be left out when the first step names one. */
  src?: string
  steps: PictureStep[]
}

// --- screen: a wireframe of a page or app screen ---------------------------------------------

export type ElementType = 'nav' | 'heading' | 'text' | 'image' | 'input' | 'button' | 'list' | 'notice' | 'gap' | 'row'

export interface ScreenElement {
  /** Needed only for elements a step refers to. */
  id?: string
  type: ElementType
  /** The words on a heading, paragraph, button or notice; the brand on a nav bar. */
  text?: string
  /** The entries of a nav bar or a list. */
  items?: string[]
  /** The caption above an input. */
  label?: string
  /** What an input holds. Left out, the input is empty. */
  value?: string
  /** For `text` with no words: how many grey placeholder lines to draw. */
  lines?: number
  /** `primary` for the main button; `error` or `info` for a notice. */
  style?: 'primary' | 'plain' | 'error' | 'info'
  /** For `image`: `tall` is about twice the height of the default. */
  size?: 'short' | 'tall'
  /** For `row`: elements laid side by side. */
  children?: ScreenElement[]
  hidden?: boolean
}

export interface ScreenStep {
  caption: string
  show?: string[]
  highlight?: string[]
  /** New words or values for elements, by id, which they keep: `{ "pay": { "text": "Paying…" } }`. */
  set?: Record<string, Pick<ScreenElement, 'text' | 'value' | 'items' | 'style'>>
}

export interface ScreenReel {
  kind: 'screen'
  title: string
  /** The frame around the screen. Defaults to `browser`. */
  device?: 'browser' | 'phone'
  /** Shown in a browser's address bar. */
  address?: string
  elements: ScreenElement[]
  steps: ScreenStep[]
}

// --- sketch: shapes placed freely, for anything the other kinds can't draw ------------------

export type SketchColor = 'cyan' | 'violet' | 'amber' | 'green' | 'red' | 'muted'
/** A place on the sketch: a shape's id, or a position `[x, y]`. */
export type Anchor = string | [number, number]

export interface Shape {
  id: string
  type: 'box' | 'ellipse' | 'text' | 'icon' | 'line' | 'arrow'
  /** For box, ellipse, text and icon: the centre, in the sketch's own units. */
  x?: number
  y?: number
  /** For box and ellipse: the size. For icon: `w` is its size. */
  w?: number
  h?: number
  /** Words in a box or ellipse, under an icon, or beside a line. For `text`, the words themselves. */
  label?: string
  /** For `icon`: one of the bundled icons. */
  name?: string
  /** For line and arrow: where it runs from and to. */
  from?: Anchor
  to?: Anchor
  dashed?: boolean
  color?: SketchColor
  /** For `text`: `large` for a heading, `small` for a note. */
  size?: 'small' | 'large'
  hidden?: boolean
}

export interface SketchStep {
  caption: string
  show?: string[]
  highlight?: string[]
  /** New centres for shapes, by id, which they slide to and keep: `{ "packet": [60, 20] }`. */
  move?: Record<string, [number, number]>
}

export interface SketchReel {
  kind: 'sketch'
  title: string
  /** The width and height of the drawing space the positions are measured in. Defaults to `[100, 60]`. */
  size?: [number, number]
  shapes: Shape[]
  steps: SketchStep[]
}

/** What any reel can carry, whatever its kind. */
interface Themed {
  /** Colours for this reel alone, on top of the theme in the settings. */
  theme?: Partial<Theme>
}

export type Reel = (FlowReel | SequenceReel | GanttReel | ScatterReel | ScreenReel | SketchReel | MathReel | MapReel | PictureReel | TreeReel | TimelineReel | ChartReel | LineReel | PieReel | CodeReel | ArrayReel) & Themed
export type ReelStep = Reel['steps'][number]

export const KINDS: Kind[] = ['flow', 'sequence', 'tree', 'timeline', 'gantt', 'chart', 'line', 'scatter', 'pie', 'code', 'array', 'math', 'map', 'picture', 'screen', 'sketch']

export function kindOf(reel: Reel): Kind {
  return reel.kind ?? 'flow'
}

// --- validation ----------------------------------------------------------------------------

type Json = Record<string, unknown>

/** Checks an optional `icon` names one of the bundled icons. */
function checkIcon(item: Json, at: string, errors: string[]) {
  if (item.icon === undefined) return
  if (typeof item.icon !== 'string' || !(item.icon in ICONS)) {
    errors.push(`${at}.icon "${item.icon}" is not one of the bundled icons. Run "sworeel icons" to list them.`)
  }
}

const STYLES: MessageStyle[] = ['request', 'reply', 'error']
/** The furthest column or row a flow node may sit in; far beyond what fits a frame. */
const MAX_GRID = 40
const MARK_TYPES = ['arrow', 'circle', 'box', 'note']
const SKETCH_COLORS = ['cyan', 'violet', 'amber', 'green', 'red', 'muted']
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const isIndex = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** What an optional field may hold, by name: a type, or a list of the words it may be. */
type FieldShape = 'string' | 'number' | 'boolean' | 'strings' | readonly string[]

/** Reports optional fields that are present but hold the wrong kind of value. */
function checkFields(item: Json, at: string, errors: string[], fields: Record<string, FieldShape>) {
  for (const [name, shape] of Object.entries(fields)) {
    const value = item[name]
    if (value === undefined) continue
    // A field of the reel itself is quoted, as the other messages about the reel are.
    const field = at ? `${at}.${name}` : `"${name}"`
    if (shape === 'strings') {
      if (!Array.isArray(value) || !value.every((each) => typeof each === 'string')) errors.push(`${field} must be an array of strings.`)
    } else if (typeof shape !== 'string') {
      if (!shape.includes(value as string)) errors.push(`${field} must be one of: ${shape.join(', ')}.`)
    } else if (shape === 'number' ? !isNumber(value) : typeof value !== shape) {
      errors.push(`${field} must be a ${shape}.`)
    }
  }
}

/**
 * Checks the message a step may send between two things, as flow, sequence and map steps do:
 * both ends or neither, ends that exist, and a label and style only of the right kind.
 */
function checkMessage(step: Json, at: string, known: Set<string>, what: string, errors: string[]) {
  if ((step.from === undefined) !== (step.to === undefined)) errors.push(`${at} needs both "from" and "to", or neither.`)
  for (const end of ['from', 'to'] as const) {
    if (step[end] !== undefined && !known.has(step[end] as string)) errors.push(`${at}.${end} refers to unknown ${what} "${step[end]}".`)
  }
  if (step.label !== undefined && step.from === undefined) errors.push(`${at}.label needs "from" and "to".`)
  checkFields(step, at, errors, { label: 'string', style: STYLES })
}

/** Checks each step is an object with a caption, then hands it to the kind's own checks. */
function checkSteps(value: Json, errors: string[], check: (step: Json, at: string) => void) {
  if (!Array.isArray(value.steps) || value.steps.length === 0) return void errors.push('"steps" must be a non-empty array.')
  value.steps.forEach((step, i) => {
    const at = `steps[${i}]`
    if (!isObject(step)) return void errors.push(`${at} must be an object.`)
    if (!isText(step.caption)) errors.push(`${at}.caption must be a non-empty string.`)
    check(step, at)
  })
}

/** Checks an optional list of ids against the ids that exist. */
function checkIds(list: unknown, known: Set<string>, at: string, errors: string[]) {
  if (list === undefined) return
  if (!Array.isArray(list)) return void errors.push(`${at} must be an array of ids.`)
  for (const id of list) if (!known.has(id as string)) errors.push(`${at} refers to unknown id "${id}".`)
}

/** Checks an optional list of cell positions against the number of cells. */
function checkPositions(list: unknown, count: number, at: string, errors: string[]) {
  if (list === undefined) return
  if (!Array.isArray(list)) return void errors.push(`${at} must be an array of positions.`)
  for (const position of list) {
    if (!isIndex(position) || position >= count) errors.push(`${at} has ${JSON.stringify(position)}, but positions run from 0 to ${count - 1}.`)
  }
}

function validateFlow(value: Json, errors: string[]) {
  const ids = new Set<string>()
  const nodeIds = new Set<string>()
  const cells = new Map<string, string>()

  if (!Array.isArray(value.nodes) || value.nodes.length === 0) {
    errors.push('"nodes" must be a non-empty array.')
  } else {
    value.nodes.forEach((node, i) => {
      const at = `nodes[${i}]`
      if (!isObject(node)) return void errors.push(`${at} must be an object.`)
      if (!isText(node.id)) return void errors.push(`${at}.id must be a non-empty string.`)
      if (ids.has(node.id)) errors.push(`${at}.id "${node.id}" is used more than once.`)
      ids.add(node.id)
      nodeIds.add(node.id)
      if (!isText(node.label)) errors.push(`${at}.label must be a non-empty string.`)
      if (node.sub !== undefined && typeof node.sub !== 'string') errors.push(`${at}.sub must be a string.`)
      checkIcon(node, at, errors)
      if (!isIndex(node.col) || !isIndex(node.row) || node.col > MAX_GRID || node.row > MAX_GRID) {
        errors.push(`${at} needs whole-number "col" and "row" from 0 to ${MAX_GRID}.`)
      } else {
        const cell = `${node.col},${node.row}`
        if (cells.has(cell)) errors.push(`${at} "${node.id}" is in the same grid cell as "${cells.get(cell)}".`)
        cells.set(cell, node.id)
      }
    })
  }

  if (value.groups !== undefined) {
    if (!Array.isArray(value.groups)) {
      errors.push('"groups" must be an array.')
    } else {
      value.groups.forEach((group, i) => {
        const at = `groups[${i}]`
        if (!isObject(group)) return void errors.push(`${at} must be an object.`)
        if (!isText(group.id)) return void errors.push(`${at}.id must be a non-empty string.`)
        if (ids.has(group.id)) errors.push(`${at}.id "${group.id}" is used more than once.`)
        ids.add(group.id)
        if (!isText(group.label)) errors.push(`${at}.label must be a non-empty string.`)
        if (!Array.isArray(group.nodes) || group.nodes.length === 0) errors.push(`${at}.nodes must be a non-empty array of node ids.`)
        else for (const id of group.nodes) if (!nodeIds.has(id as string)) errors.push(`${at}.nodes refers to unknown node "${id}".`)
      })
    }
  }

  checkSteps(value, errors, (step, at) => {
    checkMessage(step, at, nodeIds, 'node', errors)
    checkIds(step.show, ids, `${at}.show`, errors)
  })
}

function validateChart(value: Json, errors: string[]) {
  const ids = new Set<string>()
  if (value.unit !== undefined && typeof value.unit !== 'string') errors.push('"unit" must be a string.')
  if (value.max !== undefined && (!isNumber(value.max) || value.max <= 0)) errors.push('"max" must be a number above 0.')

  if (!Array.isArray(value.bars) || value.bars.length === 0) {
    errors.push('"bars" must be a non-empty array.')
  } else {
    value.bars.forEach((bar, i) => {
      const at = `bars[${i}]`
      if (!isObject(bar)) return void errors.push(`${at} must be an object.`)
      if (!isText(bar.id)) return void errors.push(`${at}.id must be a non-empty string.`)
      if (ids.has(bar.id)) errors.push(`${at}.id "${bar.id}" is used more than once.`)
      ids.add(bar.id)
      if (!isText(bar.label)) errors.push(`${at}.label must be a non-empty string.`)
      if (!isNumber(bar.value) || bar.value < 0) errors.push(`${at}.value must be a number of 0 or more.`)
    })
  }

  checkSteps(value, errors, (step, at) => {
    checkIds(step.show, ids, `${at}.show`, errors)
    checkIds(step.highlight, ids, `${at}.highlight`, errors)
    if (step.set === undefined) return
    if (!isObject(step.set)) return void errors.push(`${at}.set must be an object of bar ids and their new values.`)
    for (const [id, amount] of Object.entries(step.set)) {
      if (!ids.has(id)) errors.push(`${at}.set refers to unknown id "${id}".`)
      if (!isNumber(amount) || amount < 0) errors.push(`${at}.set.${id} must be a number of 0 or more.`)
    }
  })
}

function validateCode(value: Json, errors: string[]) {
  // Each listing's name and the line numbers it covers.
  const ranges = new Map<string, [number, number]>()
  if (value.files !== undefined) {
    if (value.code !== undefined) errors.push('Use "code" for one listing or "files" for several, not both.')
    if (!Array.isArray(value.files) || value.files.length === 0) errors.push('"files" must be a non-empty array.')
    else {
      value.files.forEach((file, i) => {
        const at = `files[${i}]`
        if (!isObject(file)) return void errors.push(`${at} must be an object.`)
        if (!isText(file.name)) return void errors.push(`${at}.name must be a non-empty string.`)
        if (ranges.has(file.name)) errors.push(`${at}.name "${file.name}" is used more than once.`)
        if (!isText(file.code)) return void errors.push(`${at}.code must be a non-empty string.`)
        if (file.start !== undefined && !(Number.isInteger(file.start) && (file.start as number) >= 1)) errors.push(`${at}.start must be a whole number of 1 or more.`)
        const start = Number.isInteger(file.start) ? (file.start as number) : 1
        ranges.set(file.name, [start, start + file.code.split('\n').length - 1])
      })
    }
  } else if (isText(value.code)) {
    ranges.set('', [1, value.code.split('\n').length])
  } else {
    errors.push('A code reel needs "code", or "files" for several listings.')
  }

  let showing = [...ranges.keys()][0]
  checkSteps(value, errors, (step, at) => {
    if (step.file !== undefined) {
      if (typeof step.file !== 'string' || !ranges.has(step.file)) errors.push(`${at}.file refers to unknown file "${step.file}".`)
      else showing = step.file
    }
    if (step.lines === undefined) return
    if (!Array.isArray(step.lines)) return void errors.push(`${at}.lines must be an array of line numbers.`)
    const [first, last] = ranges.get(showing ?? '') ?? [1, 0]
    for (const line of step.lines) {
      if (!Number.isInteger(line) || line < first || line > last) {
        errors.push(`${at}.lines has ${JSON.stringify(line)}, but ${showing ? `"${showing}"` : 'the code'} has lines ${first} to ${last}.`)
      }
    }
  })
}

function validateArray(value: Json, errors: string[]) {
  const isCell = (v: unknown) => typeof v === 'string' || isNumber(v)
  const isCells = (v: unknown): v is unknown[] => Array.isArray(v) && v.length > 0 && v.every(isCell)
  if (!isCells(value.cells)) errors.push('"cells" must be a non-empty array of strings and numbers.')
  let count = isCells(value.cells) ? value.cells.length : 0

  checkSteps(value, errors, (step, at) => {
    if (step.set !== undefined) {
      if (isCells(step.set)) count = step.set.length
      else errors.push(`${at}.set must be a non-empty array of strings and numbers.`)
    }
    if (step.set !== undefined && step.swap !== undefined) errors.push(`${at} has both "set" and "swap". Use one step for each.`)
    checkPositions(step.highlight, count, `${at}.highlight`, errors)
    checkPositions(step.dim, count, `${at}.dim`, errors)
    if (step.swap !== undefined) {
      if (!Array.isArray(step.swap) || step.swap.length !== 2) errors.push(`${at}.swap must be two positions, e.g. [0, 3].`)
      else checkPositions(step.swap, count, `${at}.swap`, errors)
    }
    if (step.pointers !== undefined) {
      if (!isObject(step.pointers)) errors.push(`${at}.pointers must be an object of names and positions.`)
      else checkPositions(Object.values(step.pointers), count, `${at}.pointers`, errors)
    }
  })
}

/**
 * Checks a list of things that each need a unique `id` and a `label`, and returns the ids.
 * `more` adds the checks particular to that kind of thing.
 */
function checkItems(value: Json, key: string, errors: string[], more: (item: Json, at: string) => void = () => {}) {
  const ids = new Set<string>()
  const list = value[key]
  if (!Array.isArray(list) || list.length === 0) {
    errors.push(`"${key}" must be a non-empty array.`)
    return ids
  }
  list.forEach((item, i) => {
    const at = `${key}[${i}]`
    if (!isObject(item)) return void errors.push(`${at} must be an object.`)
    if (!isText(item.id)) return void errors.push(`${at}.id must be a non-empty string.`)
    if (ids.has(item.id)) errors.push(`${at}.id "${item.id}" is used more than once.`)
    ids.add(item.id)
    if (!isText(item.label)) errors.push(`${at}.label must be a non-empty string.`)
    more(item, at)
  })
  return ids
}

/** The checks for kinds whose steps only reveal and emphasise things. */
function checkShowAndHighlight(value: Json, ids: Set<string>, errors: string[]) {
  checkSteps(value, errors, (step, at) => {
    checkIds(step.show, ids, `${at}.show`, errors)
    checkIds(step.highlight, ids, `${at}.highlight`, errors)
  })
}

function validateSequence(value: Json, errors: string[]) {
  const ids = checkItems(value, 'actors', errors, (actor, at) => checkIcon(actor, at, errors))
  checkSteps(value, errors, (step, at) => {
    checkMessage(step, at, ids, 'actor', errors)
  })
}

function validateTree(value: Json, errors: string[]) {
  const parents = new Map<string, string | undefined>()
  const ids = checkItems(value, 'nodes', errors, (node, at) => {
    checkIcon(node, at, errors)
    if (node.parent !== undefined && typeof node.parent !== 'string') errors.push(`${at}.parent must be a node id.`)
    parents.set(node.id as string, node.parent as string | undefined)
  })
  for (const [id, parent] of parents) if (parent !== undefined && !ids.has(parent)) errors.push(`Node "${id}" has unknown parent "${parent}".`)

  const roots = [...parents].filter(([, parent]) => parent === undefined).map(([id]) => id)
  if (ids.size && roots.length !== 1) errors.push(`A tree needs exactly one node without a "parent"; this one has ${roots.length}.`)
  // Following parents upwards from any node must reach the root, not go round in a circle.
  for (const id of ids) {
    const seen = new Set<string>()
    for (let at: string | undefined = id; at !== undefined; at = parents.get(at)) {
      if (seen.has(at)) {
        errors.push(`Node "${id}" is its own ancestor.`)
        break
      }
      seen.add(at)
    }
  }
  const isView = (view: unknown) => view === undefined || view === 'boxes' || view === 'list'
  if (!isView(value.view)) errors.push('"view" must be "boxes" or "list".')
  checkSteps(value, errors, (step, at) => {
    checkIds(step.show, ids, `${at}.show`, errors)
    checkIds(step.highlight, ids, `${at}.highlight`, errors)
    if (!isView(step.view)) errors.push(`${at}.view must be "boxes" or "list".`)
  })
}

function validateTimeline(value: Json, errors: string[]) {
  const ids = checkItems(value, 'events', errors, (event, at) => {
    if (!isText(event.when)) errors.push(`${at}.when must be a non-empty string.`)
  })
  checkShowAndHighlight(value, ids, errors)
}

function validateLine(value: Json, errors: string[]) {
  if (value.unit !== undefined && typeof value.unit !== 'string') errors.push('"unit" must be a string.')
  const points = Array.isArray(value.x) && value.x.length >= 2 && value.x.every((label) => typeof label === 'string') ? value.x.length : 0
  if (!points) errors.push('"x" must be an array of at least two labels.')

  const ids = checkItems(value, 'series', errors, (series, at) => {
    if (!Array.isArray(series.values) || !series.values.every((v) => isNumber(v) && v >= 0)) errors.push(`${at}.values must be an array of numbers of 0 or more.`)
    else if (points && series.values.length !== points) errors.push(`${at}.values has ${series.values.length} values, but "x" has ${points} labels.`)
  })
  if (ids.size > 3) errors.push('"series" can have at most three lines.')

  checkSteps(value, errors, (step, at) => {
    checkIds(step.highlight, ids, `${at}.highlight`, errors)
    if (step.upTo !== undefined && (!Number.isInteger(step.upTo) || (step.upTo as number) < 1 || (step.upTo as number) > points)) {
      errors.push(`${at}.upTo must be a whole number from 1 to ${points}.`)
    }
    if (step.mark !== undefined) checkPositions([step.mark], points, `${at}.mark`, errors)
  })
}

function validatePie(value: Json, errors: string[]) {
  let total = 0
  const ids = checkItems(value, 'slices', errors, (slice, at) => {
    if (!isNumber(slice.value) || slice.value < 0) errors.push(`${at}.value must be a number of 0 or more.`)
    else total += slice.value
  })
  if (ids.size && total <= 0) errors.push('The slices must add up to more than 0.')
  if (ids.size > 6) errors.push('"slices" can have at most six; fold the small ones into "Other".')
  checkShowAndHighlight(value, ids, errors)
}

function validateGantt(value: Json, errors: string[]) {
  if (value.unit !== undefined && typeof value.unit !== 'string') errors.push('"unit" must be a string.')
  // The scale runs from the earliest start to the latest end, as it is drawn.
  const scale = { from: Infinity, to: -Infinity }
  const ids = checkItems(value, 'tasks', errors, (task, at) => {
    if (!isNumber(task.start) || !isNumber(task.end)) return void errors.push(`${at} needs numbers for "start" and "end".`)
    if (task.end <= task.start) errors.push(`${at}.end must be after its start.`)
    scale.from = Math.min(scale.from, task.start)
    scale.to = Math.max(scale.to, task.end)
  })
  checkSteps(value, errors, (step, at) => {
    checkIds(step.show, ids, `${at}.show`, errors)
    checkIds(step.highlight, ids, `${at}.highlight`, errors)
    if (step.now !== undefined && !(isNumber(step.now) && step.now >= scale.from && step.now <= scale.to)) {
      errors.push(`${at}.now must be a number on the scale, which runs from ${scale.from} to ${scale.to}.`)
    }
  })
}

function validateScatter(value: Json, errors: string[]) {
  for (const axis of ['xLabel', 'yLabel']) if (!isText(value[axis])) errors.push(`"${axis}" must be a non-empty string.`)
  const names = new Set<string>()
  if (!Array.isArray(value.points) || value.points.length === 0) {
    errors.push('"points" must be a non-empty array.')
  } else {
    value.points.forEach((point, i) => {
      const at = `points[${i}]`
      if (!isObject(point)) return void errors.push(`${at} must be an object.`)
      if (!isText(point.id)) return void errors.push(`${at}.id must be a non-empty string.`)
      if (names.has(point.id)) errors.push(`${at}.id "${point.id}" is used more than once.`)
      names.add(point.id)
      if (!isNumber(point.x) || !isNumber(point.y) || point.x < 0 || point.y < 0) errors.push(`${at} needs numbers of 0 or more for "x" and "y".`)
      if (point.label !== undefined && typeof point.label !== 'string') errors.push(`${at}.label must be a string.`)
      if (point.group !== undefined && !isText(point.group)) errors.push(`${at}.group must be a non-empty string.`)
    })
    // A step can name a point or a whole group.
    for (const point of value.points) if (isObject(point) && isText(point.group)) names.add(point.group)
  }
  checkShowAndHighlight(value, names, errors)
}

const ELEMENT_TYPES = ['nav', 'heading', 'text', 'image', 'input', 'button', 'list', 'notice', 'gap', 'row']

/** The fields of a screen element that hold words or a choice, and what each may hold. */
const ELEMENT_FIELDS: Record<string, FieldShape> = { text: 'string', label: 'string', value: 'string', items: 'strings', style: ['primary', 'plain', 'error', 'info'], size: ['short', 'tall'] }
/** What a step's `set` may change on an element. */
const CHANGEABLE = ['text', 'value', 'items', 'style']

function validateScreen(value: Json, errors: string[]) {
  checkFields(value, '', errors, { device: ['browser', 'phone'], address: 'string' })
  const ids = new Set<string>()
  const checkElements = (list: unknown, at: string, nested: boolean) => {
    if (!Array.isArray(list) || list.length === 0) return void errors.push(`${at} must be a non-empty array.`)
    list.forEach((element, i) => {
      const here = `${at}[${i}]`
      if (!isObject(element)) return void errors.push(`${here} must be an object.`)
      if (!ELEMENT_TYPES.includes(element.type as string)) return void errors.push(`${here}.type must be one of: ${ELEMENT_TYPES.join(', ')}.`)
      if (element.id !== undefined) {
        if (!isText(element.id)) errors.push(`${here}.id must be a non-empty string.`)
        else if (ids.has(element.id)) errors.push(`${here}.id "${element.id}" is used more than once.`)
        else ids.add(element.id)
      }
      checkFields(element, here, errors, ELEMENT_FIELDS)
      if (element.lines !== undefined && !(Number.isInteger(element.lines) && (element.lines as number) >= 1 && (element.lines as number) <= 20)) errors.push(`${here}.lines must be a whole number from 1 to 20.`)
      if ((element.type === 'nav' || element.type === 'list') && !Array.isArray(element.items)) errors.push(`${here} needs "items".`)
      if ((element.type === 'heading' || element.type === 'button' || element.type === 'notice') && !isText(element.text)) errors.push(`${here} needs "text".`)
      if (element.type === 'row') {
        if (nested) errors.push(`${here}: a row can't be inside another row.`)
        else checkElements(element.children, `${here}.children`, true)
      }
    })
  }
  checkElements(value.elements, 'elements', false)

  checkSteps(value, errors, (step, at) => {
    checkIds(step.show, ids, `${at}.show`, errors)
    checkIds(step.highlight, ids, `${at}.highlight`, errors)
    if (step.set === undefined) return
    if (!isObject(step.set)) return void errors.push(`${at}.set must be an object of element ids and their changes.`)
    for (const [id, change] of Object.entries(step.set)) {
      if (!ids.has(id)) errors.push(`${at}.set refers to unknown id "${id}".`)
      if (!isObject(change)) {
        errors.push(`${at}.set.${id} must be an object, e.g. { "text": "Paying…" }.`)
        continue
      }
      for (const name of Object.keys(change)) {
        if (!CHANGEABLE.includes(name)) errors.push(`${at}.set.${id}.${name} can't be changed by a step. A step can set: ${CHANGEABLE.join(', ')}.`)
      }
      checkFields(change, `${at}.set.${id}`, errors, ELEMENT_FIELDS)
    }
  })
}

const SHAPE_TYPES = ['box', 'ellipse', 'text', 'icon', 'line', 'arrow']

function validateSketch(value: Json, errors: string[]) {
  const isPair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(isNumber)
  // The shape of the space is what matters, so one far longer than it is wide (or the other way) is a slip.
  const isSize = isPair(value.size) && value.size[0] > 0 && value.size[1] > 0 && value.size[0] / value.size[1] <= 20 && value.size[1] / value.size[0] <= 20
  if (value.size !== undefined && !isSize) errors.push('"size" must be two numbers above 0, neither more than twenty times the other, e.g. [100, 60].')

  const ids = new Set<string>()
  const placed = new Set<string>()
  const lines: [Json, string][] = []
  if (!Array.isArray(value.shapes) || value.shapes.length === 0) {
    errors.push('"shapes" must be a non-empty array.')
  } else {
    value.shapes.forEach((shape, i) => {
      const at = `shapes[${i}]`
      if (!isObject(shape)) return void errors.push(`${at} must be an object.`)
      if (!isText(shape.id)) return void errors.push(`${at}.id must be a non-empty string.`)
      if (ids.has(shape.id)) errors.push(`${at}.id "${shape.id}" is used more than once.`)
      ids.add(shape.id)
      if (!SHAPE_TYPES.includes(shape.type as string)) return void errors.push(`${at}.type must be one of: ${SHAPE_TYPES.join(', ')}.`)
      checkFields(shape, at, errors, { color: SKETCH_COLORS, label: 'string', size: ['small', 'large'] })

      if (shape.type === 'line' || shape.type === 'arrow') return void lines.push([shape, at])
      placed.add(shape.id)
      if (!isNumber(shape.x) || !isNumber(shape.y)) errors.push(`${at} needs numbers for "x" and "y", its centre.`)
      if ((shape.type === 'box' || shape.type === 'ellipse') && !(isNumber(shape.w) && isNumber(shape.h) && shape.w > 0 && shape.h > 0)) {
        errors.push(`${at} needs "w" and "h" above 0.`)
      }
      if (shape.type === 'text' && !isText(shape.label)) errors.push(`${at} needs a "label", the words to write.`)
      if (shape.type === 'icon') {
        if (typeof shape.name !== 'string' || !(shape.name in ICONS)) errors.push(`${at}.name "${shape.name}" is not one of the bundled icons. Run "sworeel icons" to list them.`)
        if (shape.w !== undefined && !(isNumber(shape.w) && shape.w > 0)) errors.push(`${at}.w must be a number above 0.`)
      }
    })
  }
  // A line's ends are checked last, since it may join shapes listed after it.
  for (const [shape, at] of lines) {
    for (const end of ['from', 'to'] as const) {
      const anchor = shape[end]
      if (isPair(anchor)) continue
      if (typeof anchor !== 'string' || !placed.has(anchor)) errors.push(`${at}.${end} must be a position [x, y] or the id of a box, ellipse, text or icon.`)
    }
  }

  checkSteps(value, errors, (step, at) => {
    checkIds(step.show, ids, `${at}.show`, errors)
    checkIds(step.highlight, ids, `${at}.highlight`, errors)
    if (step.move === undefined) return
    if (!isObject(step.move)) return void errors.push(`${at}.move must be an object of shape ids and positions.`)
    for (const [id, to] of Object.entries(step.move)) {
      if (!placed.has(id)) errors.push(`${at}.move refers to "${id}", which is not a box, ellipse, text or icon.`)
      if (!isPair(to)) errors.push(`${at}.move.${id} must be a position [x, y].`)
    }
  })
}

function validateMath(value: Json, errors: string[]) {
  const ids = new Set<string>()
  if (!Array.isArray(value.lines) || value.lines.length === 0) {
    errors.push('"lines" must be a non-empty array.')
  } else {
    value.lines.forEach((line, i) => {
      const at = `lines[${i}]`
      if (!isObject(line)) return void errors.push(`${at} must be an object.`)
      if (!isText(line.id)) return void errors.push(`${at}.id must be a non-empty string.`)
      if (ids.has(line.id)) errors.push(`${at}.id "${line.id}" is used more than once.`)
      ids.add(line.id)
      if (!isText(line.tex)) errors.push(`${at}.tex must be a non-empty string of TeX.`)
      else if (/^\s*\$/.test(line.tex)) errors.push(`${at}.tex should be the formula alone, without dollar signs.`)
      if (line.note !== undefined && typeof line.note !== 'string') errors.push(`${at}.note must be a string.`)
    })
  }
  checkShowAndHighlight(value, ids, errors)
}

const MAP_VIEWS = ['world', 'europe', 'north-america', 'south-america', 'asia', 'africa', 'oceania']

function validateMap(value: Json, errors: string[]) {
  if (value.view !== undefined && !MAP_VIEWS.includes(value.view as string)) {
    const box = value.view
    // Kept short of the poles, where a flat map stretches without end.
    const isBox = Array.isArray(box) && box.length === 4 && box.every(isNumber) && box[0]! < box[2]! && box[1]! < box[3]! && box[0]! >= -180 && box[2]! <= 180 && box[1]! >= -85 && box[3]! <= 85
    if (!isBox) errors.push(`"view" must be one of ${MAP_VIEWS.join(', ')}, or [west, south, east, north] in degrees, with latitudes from -85 to 85.`)
  }
  const ids = checkItems(value, 'places', errors, (place, at) => {
    if (!isNumber(place.lat) || Math.abs(place.lat) > 90) errors.push(`${at}.lat must be a number from -90 to 90.`)
    if (!isNumber(place.lon) || Math.abs(place.lon) > 180) errors.push(`${at}.lon must be a number from -180 to 180.`)
  })
  checkSteps(value, errors, (step, at) => {
    checkIds(step.show, ids, `${at}.show`, errors)
    checkIds(step.highlight, ids, `${at}.highlight`, errors)
    checkMessage(step, at, ids, 'place', errors)
    if (step.from !== undefined && step.from === step.to) errors.push(`${at} sends a message from a place to itself.`)
  })
}

function validatePicture(value: Json, errors: string[]) {
  const checkSrc = (src: unknown, at: string) => {
    if (!isText(src)) errors.push(`${at} must be the path of an image file.`)
    else if (!/\.(png|jpe?g)$/i.test(src)) errors.push(`${at} must be a PNG or JPEG file.`)
  }
  if (value.src !== undefined) checkSrc(value.src, '"src"')
  else if (!(Array.isArray(value.steps) && isObject(value.steps[0]) && value.steps[0].src !== undefined)) {
    errors.push('A picture needs "src", on the reel or on its first step.')
  }
  checkSteps(value, errors, (step, at) => {
    if (step.src !== undefined) checkSrc(step.src, `${at}.src`)
    if (step.label !== undefined && typeof step.label !== 'string') errors.push(`${at}.label must be a string.`)
    if (step.marks !== undefined) {
      const isSpot = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every((n) => isNumber(n) && n >= 0 && n <= 1)
      if (!Array.isArray(step.marks)) errors.push(`${at}.marks must be an array.`)
      else {
        step.marks.forEach((mark, i) => {
          const here = `${at}.marks[${i}]`
          if (!isObject(mark)) return void errors.push(`${here} must be an object.`)
          if (!MARK_TYPES.includes(mark.type as string)) return void errors.push(`${here}.type must be one of: ${MARK_TYPES.join(', ')}.`)
          checkFields(mark, here, errors, { color: SKETCH_COLORS, label: 'string' })
          if (mark.size !== undefined && !(isNumber(mark.size) && mark.size > 0 && mark.size <= 1)) errors.push(`${here}.size must be a fraction of the picture's width, above 0 and at most 1.`)
          if (mark.type === 'box') {
            const box = mark.area
            if (!(Array.isArray(box) && box.length === 4 && box.every((n) => isNumber(n) && n >= 0 && n <= 1))) errors.push(`${here}.area must be [x, y, width, height] as fractions from 0 to 1.`)
            return
          }
          if (!isSpot(mark.at)) errors.push(`${here}.at must be a position [x, y] as fractions from 0 to 1.`)
          if (mark.from !== undefined && !isSpot(mark.from)) errors.push(`${here}.from must be a position [x, y] as fractions from 0 to 1.`)
          if (mark.type === 'note' && !isText(mark.label)) errors.push(`${here} needs a "label", the words to write.`)
        })
      }
    }
    if (step.focus === undefined) return
    const box = step.focus
    const inside = Array.isArray(box) && box.length === 4 && box.every((n) => isNumber(n) && n >= 0 && n <= 1) && box[2] > 0 && box[3] > 0 && box[0] + box[2] <= 1.001 && box[1] + box[3] <= 1.001
    if (!inside) errors.push(`${at}.focus must be [x, y, width, height] as fractions from 0 to 1 that stay inside the picture.`)
  })
}

const VALIDATORS: Record<Kind, (value: Json, errors: string[]) => void> = {
  map: validateMap,
  picture: validatePicture,
  math: validateMath,
  screen: validateScreen,
  sketch: validateSketch,
  flow: validateFlow,
  gantt: validateGantt,
  scatter: validateScatter,
  sequence: validateSequence,
  tree: validateTree,
  timeline: validateTimeline,
  chart: validateChart,
  line: validateLine,
  pie: validatePie,
  code: validateCode,
  array: validateArray,
}

/** Returns a list of problems; an empty list means the value is a usable reel. */
export function validateReel(value: unknown): string[] {
  if (!isObject(value)) return ['The reel must be a JSON object.']
  const errors: string[] = []
  if (!isText(value.title)) errors.push('"title" must be a non-empty string.')
  errors.push(...validateTheme(value.theme, '"theme"'))

  const kind = value.kind ?? 'flow'
  if (!KINDS.includes(kind as Kind)) return [...errors, `"kind" must be one of: ${KINDS.join(', ')}.`]
  VALIDATORS[kind as Kind](value, errors)

  // Whatever the kind, `hidden` is yes or no: the text "false" would hide a thing for good.
  const checkHidden = (list: unknown, at: string) => {
    if (!Array.isArray(list)) return
    list.forEach((item, i) => {
      if (!isObject(item)) return
      if (item.hidden !== undefined && typeof item.hidden !== 'boolean') errors.push(`${at}[${i}].hidden must be true or false.`)
      checkHidden(item.children, `${at}[${i}].children`)
    })
  }
  for (const [key, list] of Object.entries(value)) if (key !== 'steps') checkHidden(list, key)
  return errors
}

/** Parses the text of a reel file, throwing one readable error that lists every problem. */
export function parseReel(text: string): Reel {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new Error(`Not valid JSON: ${(error as Error).message}`)
  }
  const errors = validateReel(value)
  if (errors.length) throw new Error(errors.join('\n'))
  return value as Reel
}
