// SwoReel inside the Claude Code session: a pane that lists the reel library and plays a
// reel, animated, beside the chat. Everything it changes goes through the `sworeel` command.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Entry, Player } from '../types'
import { parseReel, type Reel } from '../core/reel.ts'
import { describeStep, drawText, TEXT_COLORS, type TextCell } from '../core/text.ts'
import { playheadAt, stepRestTime, timeline } from '../core/timing.ts'

const PANE = 'sworeel'
const TOOL = 'mcp__sworeel__play'
const TICK_MS = 100
const FORMATS = { wide: '16:9', tall: '9:16', square: '1:1' } as const
const IDLE: Player = {
  view: 'library',
  name: '',
  source: null,
  problem: null,
  time: 0,
  isPlaying: false,
  library: [],
  asking: 'nothing',
  notice: null,
  isBusy: false,
}

const player = atom({ plugin: 'sworeel', key: 'player' } as const, IDLE)

// State holds a reel as text, so parse each one once and remember the result.
const parsed = new Map<string, Reel>()

function reelOf(now: Player): Reel | null {
  if (now.source === null) return null
  let reel = parsed.get(now.source)
  if (!reel) {
    reel = parseReel(now.source)
    parsed.clear()
    parsed.set(now.source, reel)
  }
  return reel
}

// The animation timer. A module variable is right for this: a reload drops the timer too.
let timer: Timer | null = null

function stopTimer() {
  timer?.cancel()
  timer = null
}

function startTimer($: EngineInterface) {
  stopTimer()
  timer = $.clock.every(TICK_MS, () => {
    void update($, player, now => {
      const reel = reelOf(now)
      if (!reel || !now.isPlaying) return now
      const end = timeline(reel).duration
      const time = Math.min(now.time + TICK_MS, end)
      if (time >= end) stopTimer()
      return { ...now, time, isPlaying: time < end }
    })
  })
}

/**
 * Runs the sworeel command, resolving to what it printed, or throwing what it complained of.
 * A reel's name goes after `--`, so one that starts with a dash is read as a name.
 */
async function sworeel($: EngineInterface, args: string[], timeoutMs = 20_000): Promise<string> {
  const ran = await $.process.run(['sworeel', ...args], { timeoutMs })
  if (ran.exitCode !== 0) throw new Error(ran.stderr.trim().split('\n')[0] || 'The sworeel command failed.')
  return ran.stdout.trim()
}

async function readLibrary($: EngineInterface): Promise<Entry[]> {
  type Listed = { name: string; title?: string; steps?: number; seconds?: number; error?: string }
  const listed = JSON.parse(await sworeel($, ['list', '--json'])) as Listed[]
  return listed.map(reel =>
    reel.error
      ? { name: reel.name, title: reel.name, detail: `needs fixing: ${reel.error}`, isBroken: true }
      : { name: reel.name, title: reel.title ?? reel.name, detail: `${reel.steps} steps · ${Math.round(reel.seconds ?? 0)}s`, isBroken: false },
  )
}

/** Finds a reel by its library name, by asking the sworeel command where the library is. */
async function loadByName($: EngineInterface, name: string): Promise<Reel> {
  const { reels } = JSON.parse(await sworeel($, ['paths', '--json'])) as { reels: string }
  const text = await $.fs.read(`${reels}/${name}.json`).catch(() => {
    throw new Error(`There is no reel called "${name}". Type /sworeel to pick from the library.`)
  })
  return parseReel(text)
}

const openPane = ($: EngineInterface, title: string, takeKeys: boolean) =>
  $.ui.open(takeKeys ? { id: PANE, title, focus: true } : { id: PANE, title })

/** Shows the reel library in the pane. */
async function showLibrary($: EngineInterface, takeKeys: boolean): Promise<string> {
  stopTimer()
  let library: Entry[] = []
  let problem: string | null = null
  try {
    library = await readLibrary($)
  } catch (error) {
    problem = error instanceof Error ? error.message : String(error)
  }
  await update($, player, (was): Player => ({ ...IDLE, library, problem, notice: was.notice }))
  await openPane($, 'SwoReel · Reels', takeKeys)
  return problem ?? `Showing ${library.length} reel${library.length === 1 ? '' : 's'} in the SwoReel pane.`
}

/**
 * Loads a reel, given a library name or the reel itself as JSON, and plays it in the pane.
 * `takeKeys` hands the pane the keyboard: right when the person asked for it themselves, wrong
 * when the model opens it while they may be typing.
 */
async function open($: EngineInterface, source: string | Reel, takeKeys: boolean, atStep?: number): Promise<string> {
  const isInline = typeof source !== 'string' || source.trim().startsWith('{')
  const name = isInline ? '' : (source as string).trim().replace(/\.json$/, '')
  let reel: Reel | null = null
  let problem: string | null = null
  try {
    reel = typeof source !== 'string' ? parseReel(JSON.stringify(source)) : isInline ? parseReel(source) : await loadByName($, name)
  } catch (error) {
    problem = error instanceof Error ? error.message : String(error)
  }

  await update($, player, (was): Player => ({
    ...IDLE,
    view: 'player',
    library: was.library,
    name,
    source: reel ? JSON.stringify(reel) : null,
    problem,
    // Asked to open at a step, it waits there, paused, so a change made to that step can be looked at.
    time: reel && atStep ? stepRestTime(reel, Math.min(Math.max(atStep, 1), reel.steps.length) - 1) : 0,
    isPlaying: reel !== null && !atStep,
  }))
  if (reel && !atStep) startTimer($)
  else stopTimer()

  const opened = await openPane($, reel ? `SwoReel · ${reel.title}` : 'SwoReel', takeKeys)
  if (!reel) return problem ?? 'Could not load the reel.'
  if (!opened.isPlaced) return `Loaded "${reel.title}", but the pane has no room to show. Widen the terminal.`
  if (atStep) return `Showing "${reel.title}" in the SwoReel pane, paused at step ${Math.min(Math.max(atStep, 1), reel.steps.length)} of ${reel.steps.length}.`
  return `Playing "${reel.title}" in the SwoReel pane (${reel.steps.length} steps, ${Math.round(timeline(reel).duration / 1000)}s).`
}

/** Something that needs the playing reel to be a file in the library. */
async function withSavedReel($: EngineInterface, doing: string, run: (name: string, now: Player) => Promise<string>): Promise<string> {
  const now = await read($, player)
  if (!reelOf(now)) return 'Nothing is playing. Type /sworeel to pick a reel.'
  if (!now.name) return `This reel was shown without being saved, so there is no file to ${doing}. Ask Claude to save it first.`

  await update($, player, (was): Player => ({ ...was, isBusy: true, asking: 'nothing', notice: null }))
  let notice: string
  try {
    notice = await run(now.name, now)
  } catch (error) {
    notice = error instanceof Error ? error.message : String(error)
  }
  await update($, player, was => ({ ...was, isBusy: false, notice }))
  return notice
}

/** Renders the playing reel: a video in one of the formats, or a still of the step showing. */
function exportReel($: EngineInterface, kind: keyof typeof FORMATS | 'still'): Promise<string> {
  return withSavedReel($, 'export', async (name, now) => {
    const reel = reelOf(now)!
    const args =
      kind === 'still'
        ? ['still', '--step', String(Math.max(playheadAt(reel, now.time).index + 1, 1)), '--', name]
        : ['render', '--format', kind, '--', name]
    await update($, player, was => ({ ...was, notice: kind === 'still' ? 'Saving a still…' : `Rendering the ${FORMATS[kind]} video…` }))
    return `Saved ${await sworeel($, args, 300_000)}`
  })
}

/** What the pane is showing, in words: for the model to work out what "this" and "that step" mean. */
async function status($: EngineInterface): Promise<string> {
  const now = await read($, player)
  const reel = reelOf(now)
  if (!reel || now.view === 'library') return 'The SwoReel pane is on the reel library; no reel is showing.'
  const index = playheadAt(reel, now.time).index
  const where = index < 0 ? 'before the first step.' : `at step ${index + 1} of ${reel.steps.length}: "${reel.steps[index]!.caption}"`
  const which = now.name ? `the reel "${now.name}"` : 'a reel that has not been saved'
  return `The SwoReel pane last showed ${which}, titled "${reel.title}", ${now.isPlaying ? 'playing' : 'paused'} ${where}`
}

/** Reads the showing reel's file again, staying on the step it was at, so an edit can be seen where it was made. */
async function reload($: EngineInterface): Promise<string> {
  const now = await read($, player)
  const before = reelOf(now)
  if (!before) return 'Nothing is playing. Type /sworeel to pick a reel.'
  if (!now.name) return 'This reel was shown without being saved, so there is no file to read again. Show the changed reel instead.'

  let reel: Reel
  try {
    reel = await loadByName($, now.name)
  } catch (error) {
    const problem = error instanceof Error ? error.message : String(error)
    await update($, player, (was): Player => ({ ...was, problem, source: null, isPlaying: false }))
    stopTimer()
    return problem
  }
  const index = Math.min(Math.max(playheadAt(before, now.time).index, 0), reel.steps.length - 1)
  stopTimer()
  await update($, player, (was): Player => ({ ...was, source: JSON.stringify(reel), problem: null, time: stepRestTime(reel, index), isPlaying: false }))
  await openPane($, `SwoReel · ${reel.title}`, false)
  return `Reloaded "${reel.title}", paused at step ${index + 1} of ${reel.steps.length}.`
}

const CONTROLS = ['pause', 'play', 'next', 'back', 'restart', 'status', 'reload', 'keys', 'library', 'app', 'close'] as const
type Control = (typeof CONTROLS)[number]

const isControl = (word: unknown): word is Control => CONTROLS.includes(word as Control)

/** Drives the pane: the one place the buttons, the /sworeel words and the model's tool all go through. */
async function control($: EngineInterface, action: Control): Promise<string> {
  if (action === 'close') {
    stopTimer()
    await $.ui.close({ id: PANE })
    return 'Closed the SwoReel pane.'
  }
  if (action === 'library') return showLibrary($, false)
  if (action === 'status') return status($)
  if (action === 'reload') return reload($)
  if (action === 'app') return withSavedReel($, 'open in the app', name => sworeel($, ['app', '--', name]))

  const before = await read($, player)
  const reel = reelOf(before)
  if (action === 'keys') {
    await openPane($, reel ? `SwoReel · ${reel.title}` : 'SwoReel · Reels', true)
    return 'The SwoReel pane has the keyboard. Esc gives it back to the chat.'
  }
  if (!reel) return 'Nothing is playing. Type /sworeel to pick a reel.'

  const end = timeline(reel).duration
  const step = (delta: number) => (was: Player): Player => {
    const index = Math.min(Math.max(playheadAt(reel, was.time).index + delta, -1), reel.steps.length - 1)
    return { ...was, time: index === -1 ? 0 : stepRestTime(reel, index), isPlaying: false }
  }
  const changes = {
    pause: (was: Player): Player => ({ ...was, isPlaying: false }),
    // Play from the end starts over.
    play: (was: Player): Player => ({ ...was, time: was.time >= end ? 0 : was.time, isPlaying: true }),
    restart: (was: Player): Player => ({ ...was, time: 0, isPlaying: true }),
    next: step(1),
    back: step(-1),
  }

  const after = await update($, player, changes[action])
  if (after.isPlaying) startTimer($)
  else stopTimer()

  const at = playheadAt(reel, after.time).index
  return `${after.isPlaying ? 'Playing' : 'Paused'} "${reel.title}" at ${at < 0 ? 'the start' : `step ${at + 1} of ${reel.steps.length}`}.`
}

/** Joins neighbouring cells that share a style, so a row is a handful of Text elements. */
function runs(row: TextCell[]) {
  const out: { text: string; color?: string; bold?: boolean }[] = []
  for (const cell of row) {
    const last = out[out.length - 1]
    if (last && last.color === cell.color && last.bold === cell.bold) last.text += cell.ch
    else out.push({ text: cell.ch, color: cell.color, bold: cell.bold })
  }
  return out
}

/**
 * What Claude is told about offering a reel nobody asked for. It is part of every prompt, so
 * it is short; what to do once the person says yes is in the skill.
 */
const OFFER = `# Offering a SwoReel reel

The user has SwoReel, which shows an explanation as a short animation that builds step by step. When you have just explained something that is naturally a picture changing over time (how the parts of a system talk to each other, the order of a protocol or a request, a path through code, an algorithm working along a list, a few quantities compared) and the user did not ask for a visual, you may end that reply with one short line offering to show it as a reel, such as "Want to see this as a reel?".

- Only offer after a real explanation, never after a short answer, in the middle of a task, or while the user is fixing something.
- Offer once for a topic. If the user ignores or declines an offer, make no more in this session.
- Never make, show or save a reel nobody asked for. The offer is one line and nothing else.
- When they accept, load the sworeel:reel skill and follow "Offering a reel" in it.
- If they ask you to stop offering, run \`sworeel config suggest off\` and stop.`

/** Whether the person's settings let Claude offer reels; asked once, the first time it matters. */
let offers: Promise<boolean> | null = null

const mayOffer = ($: EngineInterface) =>
  (offers ??= sworeel($, ['config'], 5_000)
    .then(printed => (JSON.parse(printed) as { suggest?: boolean }).suggest !== false)
    // Without an answer, say nothing this time and ask again next time: an offer the person
    // turned off is worse than a missing one.
    .catch(() => ((offers = null), false)))

/** Sessions with nobody there to take up an offer: scripts, other programs, helpers of another Claude. */
const UNATTENDED = ['bare', 'print', 'sdk-preset', 'teammate'] as const

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'sworeel',
      description: 'Browse, play and export your SwoReel reels in a pane, here in the session',
      argumentHint: '[reel]',
    })
    await $.tool.register({
      name: 'play',
      description:
        'Shows the user an animated SwoReel reel in a pane inside this session, without leaving the chat, and controls it. ' +
        'Use it when the user asks to see, play, watch or be walked through a reel, or to pause, step, restart or close the one showing. ' +
        'To show one pass `reel`: the name of a reel in the library (as `sworeel list` prints it, e.g. "web/cors"), ' +
        'or a whole reel object to show one without saving it. ' +
        'Add `step` to open it paused at that step, which is the way to show a change you have just made. ' +
        'To control what is already showing pass `control` instead: `status` says which reel and step the pane is on ' +
        '(use it to work out what the user means by "this" or "that step"), `reload` reads the showing reel\'s file again ' +
        'and stays on the same step, `library` lists the reels to pick from, `app` opens the playing reel in the ' +
        'desktop app, `keys` hands the pane the keyboard.',
      inputSchema: {
        type: 'object',
        properties: {
          reel: { description: 'A reel name from the library, or a reel object', anyOf: [{ type: 'string' }, { type: 'object' }] },
          step: { description: 'With `reel`: the step to open paused at, counting from 1', type: 'integer', minimum: 1 },
          control: { description: 'What to do with the pane as it stands', enum: [...CONTROLS] },
        },
      },
    })

    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (UNATTENDED.some(trait => e.traits.includes(trait)) || !(await mayOffer($))) return composed
    return { sections: [...composed.sections, { id: 'sworeel:offer', text: OFFER, scope: 'session' }] }
  })

  on('command.run', { command: 'sworeel' }, async ($, e) => {
    const [word = '', second = ''] = e.args.trim().split(/\s+/)
    if (!word) return { text: await showLibrary($, true) }
    if (word === 'library') return { text: await showLibrary($, true) }
    if (word === 'export') {
      if (second === 'still' || second in FORMATS) return { text: await exportReel($, second as keyof typeof FORMATS | 'still') }
      return { text: 'Usage: /sworeel export wide | tall | square | still' }
    }
    if (isControl(word)) return { text: await control($, word) }

    return { text: await open($, e.args, true) }
  })

  on('tool.call', { tool: TOOL }, ($, e) => {
    const { reel, control: action, step } = e.input as { reel?: unknown; control?: unknown; step?: unknown }
    const answer = async () => {
      if (isControl(action)) return { result: await control($, action) }
      if (typeof reel !== 'string' && (typeof reel !== 'object' || reel === null)) {
        return { deny: 'Pass `reel` (a reel name from the library, or a reel object) or `control`.' }
      }
      return { result: await open($, reel as string | Reel, false, typeof step === 'number' ? step : undefined) }
    }
    // Whatever goes wrong is told to the model as the result, never left to stall the call.
    return answer().catch((error: unknown) => ({ result: `The SwoReel pane could not do that: ${error instanceof Error ? error.message : String(error)}` }))
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) stopTimer()

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const now = await read($, player)
    const reel = reelOf(now)

    // Say plainly where the next keypress goes: this is the question the pane raises.
    const keys = e.props.isFocused ? (
      <Box gap={1}>
        <Text inverse bold color={TEXT_COLORS.request}>
          {' KEYS: THIS PANE '}
        </Text>
        <Text wrap="truncate">press a key shown below · Esc back to chat</Text>
      </Box>
    ) : (
      <Box gap={1}>
        <Text inverse dimColor>
          {' KEYS: CHAT '}
        </Text>
        <Text dimColor wrap="truncate">
          /sworeel keys or click here for hotkeys
        </Text>
      </Box>
    )
    const notice = now.notice && (
      <Box paddingLeft={2}>
        <Text color={now.isBusy ? TEXT_COLORS.muted : TEXT_COLORS.request} wrap="wrap">
          {now.notice}
        </Text>
      </Box>
    )

    if (now.view === 'library' || !reel) {
      const room = Math.max(3, (e.viewport?.rows ?? 30) - 9)
      const shown = now.library.slice(0, room)

      return (
        <Box flexDirection="column">
          {keys}
          <Text> </Text>
          {now.problem && <Text color="error">{now.problem}</Text>}
          {!now.problem && now.library.length === 0 && <Text dimColor>No reels yet. Ask Claude to explain something as a reel.</Text>}
          {shown.map((entry, i) => (
            <Box gap={1}>
              {entry.isBroken ? (
                <Text color="error">{`   ${entry.title}`}</Text>
              ) : (
                <Button
                  key={`reel-${i}`}
                  plain
                  label={entry.title}
                  hotkey={i < 9 ? String(i + 1) : undefined}
                  onPress={() => void open($, entry.name, e.props.isFocused)}
                />
              )}
              <Text dimColor wrap="truncate">{`${entry.name} · ${entry.detail}`}</Text>
            </Box>
          ))}
          {now.library.length > shown.length && (
            <Text dimColor>{`…and ${now.library.length - shown.length} more. Type /sworeel and a name to play one.`}</Text>
          )}
          <Text> </Text>
          {notice}
          <Box gap={2}>
            <Button key="refresh" plain label="Refresh" hotkey="r" onPress={() => void showLibrary($, e.props.isFocused)} />
            <Button key="close" plain label="Close" hotkey="q" role="dismiss" onPress={() => void control($, 'close')} />
          </Box>
        </Box>
      )
    }

    const playhead = playheadAt(reel, now.time)
    const step = reel.steps[playhead.index]
    const grid = drawText(reel, playhead)
    const doing = step ? describeStep(reel, step) : null
    const message = doing?.text ? `● ${doing.text}` : ' '
    const atEnd = now.time >= timeline(reel).duration
    const ask = (asking: Player['asking']) => () => void update($, player, (was): Player => ({ ...was, asking }))

    return (
      <Box flexDirection="column">
        {keys}
        {grid.map(row => (
          <Box>
            {runs(row).map(run => (
              <Text color={run.color} bold={run.bold} wrap="truncate">
                {run.text}
              </Text>
            ))}
          </Box>
        ))}
        <Text color={TEXT_COLORS[doing?.style ?? 'request']} wrap="truncate">
          {`  ${message}`}
        </Text>
        <Box paddingLeft={2} minHeight={3}>
          <Text wrap="wrap">{step?.caption ?? ' '}</Text>
        </Box>
        <Box paddingLeft={2} gap={2}>
          <Text dimColor>{reel.steps.map((_, i) => (i <= playhead.index ? '●' : '○')).join(' ')}</Text>
          <Text dimColor>{playhead.index < 0 ? `${reel.steps.length} Steps` : `Step ${playhead.index + 1} of ${reel.steps.length}`}</Text>
        </Box>
        <Box paddingLeft={2} gap={2}>
          <Button
            key="play"
            plain
            label={now.isPlaying ? 'Pause' : atEnd ? 'Replay' : 'Play'}
            hotkey="p"
            onPress={() => void control($, now.isPlaying ? 'pause' : 'play')}
          />
          <Button key="back" plain label="◀ Step" hotkey="b" onPress={() => void control($, 'back')} />
          <Button key="forward" plain label="Step ▶" hotkey="n" onPress={() => void control($, 'next')} />
          <Button key="restart" plain label="Restart" hotkey="r" onPress={() => void control($, 'restart')} />
        </Box>
        {now.asking === 'export' && (
          <Box paddingLeft={2} gap={2}>
            <Text>Export as</Text>
            <Button key="export-wide" plain label="16:9 Video" hotkey="1" onPress={() => void exportReel($, 'wide')} />
            <Button key="export-tall" plain label="9:16 Video" hotkey="2" onPress={() => void exportReel($, 'tall')} />
            <Button key="export-square" plain label="1:1 Video" hotkey="3" onPress={() => void exportReel($, 'square')} />
            <Button key="export-still" plain label="Still of This Step" hotkey="s" onPress={() => void exportReel($, 'still')} />
            <Button key="cancel" plain label="Cancel" hotkey="c" onPress={ask('nothing')} />
          </Box>
        )}
        {now.asking === 'delete' && (
          <Box paddingLeft={2} gap={2}>
            <Text color="error" wrap="truncate">{`Move "${reel.title}" to the trash?`}</Text>
            <Button
              key="delete-yes"
              plain
              label="Yes, delete"
              hotkey="y"
              onPress={() =>
                void (async () => {
                  // Once the reel is gone there is nothing left to play, so back to the library.
                  let isGone = false
                  await withSavedReel($, 'delete', async name => {
                    const said = await sworeel($, ['delete', '--', name])
                    isGone = true
                    return said
                  })
                  if (isGone) await showLibrary($, e.props.isFocused)
                })()
              }
            />
            <Button key="cancel" plain label="Cancel" hotkey="c" onPress={ask('nothing')} />
          </Box>
        )}
        {now.asking === 'nothing' && (
          <Box paddingLeft={2} gap={2}>
            <Button key="library" plain label="Library" hotkey="l" onPress={() => void showLibrary($, e.props.isFocused)} />
            <Button key="export" plain label="Export…" hotkey="e" onPress={ask('export')} />
            <Button key="app" plain label="Open in App" hotkey="o" onPress={() => void control($, 'app')} />
            <Button key="delete" plain label="Delete…" hotkey="d" onPress={ask('delete')} />
            <Button key="close" plain label="Close" hotkey="q" role="dismiss" onPress={() => void control($, 'close')} />
          </Box>
        )}
        {notice}
      </Box>
    )
  })
}
