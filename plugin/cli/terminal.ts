// The text-only views: a static diagram for chat windows, and an animated player for terminals.
import { kindOf, type Reel } from '../core/reel.ts'
import { describeStep, drawText, gridToLines, paint, TEXT_COLORS } from '../core/text.ts'
import { playheadAt, stepRestTime, timeline } from '../core/timing.ts'

function wrap(text: string, width: number) {
  const lines: string[] = []
  for (const word of text.split(/\s+/)) {
    const last = lines.at(-1)
    if (last !== undefined && last.length + 1 + word.length <= width) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}

/**
 * The whole reel as plain text: the diagram, then every step.
 * With `step`, the diagram is drawn as it stands at that step, with its message highlighted.
 */
export function showText(reel: Reel, step: number | undefined, color: boolean) {
  // A flow is shown with its message mid-flight; the other kinds once the step has settled.
  const playhead = step ? playheadAt(reel, stepRestTime(reel, step - 1) - (kindOf(reel) === 'flow' ? 600 : 0)) : null
  const grid = drawText(reel, playhead)
  const width = Math.max(grid[0]!.length, 60)
  const out = [reel.title, '', ...gridToLines(grid, color), '']
  reel.steps.forEach((item, i) => {
    const head = `${i + 1 === step ? '▶' : ' '}${String(i + 1).padStart(2)}. `
    const what = describeStep(reel, item).text
    if (what) out.push(`${head}${what}`)
    wrap(item.caption, width - 5).forEach((line, n) => out.push(`${what || n > 0 ? '     ' : head}${line}`))
  })
  return out.join('\n')
}

/** Whether the terminal is on the full-screen page with its cursor hidden. */
let onScreen = false
// However the command ends, the terminal is given back as it was found.
const restore = () => onScreen && process.stdout.write('\x1b[?25h\x1b[?1049l')

const enterScreen = () => {
  process.stdout.write('\x1b[?1049h\x1b[?25l')
  process.stdin.setRawMode(true)
  process.stdin.resume()
  if (!onScreen) process.once('exit', restore)
  onScreen = true
}

const leaveScreen = () => {
  process.stdin.setRawMode(false)
  process.stdin.pause()
  restore()
  onScreen = false
}

interface LibraryEntry {
  name: string
  /** The reel's title, or why it can't be played. */
  title: string
  detail: string
  isBroken: boolean
}

/** A reel picker: arrow keys to choose, Enter to play, and back to the list afterwards. */
export async function browse(entries: LibraryEntry[], load: (name: string) => Promise<Reel>) {
  const { stdin, stdout } = process
  const paintText = (text: string, color: string, bold = false) => [...text].map((ch) => paint({ ch, color, bold })).join('')
  let selected = 0

  const draw = () => {
    const room = Math.max(3, (stdout.rows || 24) - 7)
    const first = Math.min(Math.max(0, selected - Math.floor(room / 2)), Math.max(0, entries.length - room))
    const lines = ['', `  ${paintText('SwoReel', TEXT_COLORS.text, true)}  ${paintText(`${entries.length} reels`, TEXT_COLORS.muted)}`, '']
    entries.slice(first, first + room).forEach((entry, i) => {
      const on = first + i === selected
      const title = paintText(entry.title, entry.isBroken ? TEXT_COLORS.error : on ? TEXT_COLORS.request : TEXT_COLORS.text, on)
      lines.push(`  ${on ? paintText('❯', TEXT_COLORS.request, true) : ' '} ${title}  ${paintText(`${entry.name} · ${entry.detail}`, TEXT_COLORS.muted)}`)
    })
    lines.push('', `  ${paintText('↑/↓ choose · enter play · q quit', TEXT_COLORS.muted)}`)
    stdout.write(`\x1b[H${lines.map((line) => `${line}\x1b[0m\x1b[K`).join('\n')}\x1b[J`)
  }

  enterScreen()
  draw()
  await new Promise<void>((done) => {
    const onKey = async (key: Buffer) => {
      const pressed = key.toString()
      if (pressed === 'q' || pressed === '\x03' || pressed === '\x1b') {
        stdin.off('data', onKey)
        return done()
      }
      if (pressed === '\x1b[A' || pressed === 'k') selected = Math.max(0, selected - 1)
      else if (pressed === '\x1b[B' || pressed === 'j') selected = Math.min(entries.length - 1, selected + 1)
      else if (pressed === '\r' && entries[selected] && !entries[selected]!.isBroken) {
        stdin.off('data', onKey)
        await play(await load(entries[selected]!.name), true)
        stdin.on('data', onKey)
      }
      draw()
    }
    stdin.on('data', onKey)
  })
  leaveScreen()
}

/**
 * Plays the reel in the terminal until the user quits.
 * `nested` means a caller owns the screen and keyboard, and gets them back afterwards.
 */
export function play(reel: Reel, nested = false): Promise<void> {
  const { stdin, stdout } = process
  let finish: () => void = () => {}
  const finished = new Promise<void>((done) => (finish = done))
  const { duration } = timeline(reel)
  const dim = (text: string) => [...text].map((ch) => paint({ ch, color: TEXT_COLORS.muted })).join('')
  const colored = (text: string, color: string, bold = false) => [...text].map((ch) => paint({ ch, color, bold })).join('')

  let time = 0
  let playing = true
  let last = Date.now()

  const frame = () => {
    const playhead = playheadAt(reel, time)
    const step = reel.steps[playhead.index]
    const grid = drawText(reel, playhead)
    const width = Math.min(Math.max(grid[0]!.length, 40), (stdout.columns || 80) - 2)
    const doing = step ? describeStep(reel, step) : null
    const message = doing?.text ? colored(`● ${doing.text}`, TEXT_COLORS[doing.style]) : ''
    const caption = step ? wrap(step.caption, width) : []
    const dots = reel.steps.map((_, i) => (i <= playhead.index ? '●' : '○')).join(' ')
    const lines = [
      '',
      `  ${colored(reel.title, TEXT_COLORS.text, true)}`,
      '',
      ...gridToLines(grid, true),
      '',
      `  ${message}`,
      '',
      // Captions are padded to three lines so the controls below don't jump about.
      ...[0, 1, 2].map((i) => `  ${colored(caption[i] ?? '', TEXT_COLORS.text)}`),
      '',
      `  ${dim(dots)}`,
      '',
      `  ${dim(`${playing ? 'space pause' : 'space play '} · ←/→ step · r restart · q ${nested ? 'back' : 'quit'}`)}`,
    ]
    stdout.write(`\x1b[H${lines.map((line) => `${line}\x1b[0m\x1b[K`).join('\n')}\x1b[J`)
  }

  const quit = () => {
    clearInterval(timer)
    stdin.off('data', onKey)
    process.off('SIGTERM', quit)
    if (!nested) leaveScreen()
    finish()
  }

  const showStep = (index: number) => {
    const clamped = Math.min(Math.max(index, -1), reel.steps.length - 1)
    time = clamped === -1 ? 0 : stepRestTime(reel, clamped)
    playing = false
  }

  const onKey = (key: Buffer) => {
    const pressed = key.toString()
    if (pressed === 'q' || pressed === '\x03' || pressed === '\x1b') return quit()
    if (pressed === ' ') {
      if (time >= duration) time = 0
      playing = !playing
    } else if (pressed === 'r') {
      time = 0
      playing = true
    } else if (pressed === '\x1b[C') showStep(playheadAt(reel, time).index + 1)
    else if (pressed === '\x1b[D') showStep(playheadAt(reel, time).index - 1)
    last = Date.now()
    frame()
  }

  if (!nested) enterScreen()
  stdin.on('data', onKey)

  const timer = setInterval(() => {
    const now = Date.now()
    if (playing) {
      time = Math.min(time + (now - last), duration)
      if (time >= duration) playing = false
    }
    last = now
    frame()
  }, 50)
  process.on('SIGTERM', quit)
  frame()
  return finished
}
