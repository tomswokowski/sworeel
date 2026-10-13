import { expect, mock, test, type TestBody } from 'claude-code/testing'
import type { On, PromptComposeTrait } from 'claude-code'

const REEL = {
  title: 'Tiny',
  nodes: [
    { id: 'a', label: 'Browser', col: 0, row: 0 },
    { id: 'b', label: 'Gateway', col: 0, row: 1 },
  ],
  steps: [
    { caption: 'The browser calls the gateway.', from: 'a', to: 'b', label: 'GET /' },
    { caption: 'The gateway answers.', from: 'b', to: 'a', label: '200 OK', style: 'reply' },
  ],
}

const LIST = [
  { name: 'tiny', title: 'Tiny', steps: 2, seconds: 9.1 },
  { name: 'web/cors', title: 'Preflight', steps: 6, seconds: 28.6 },
  { name: 'drafts/broken', error: '"nodes" must be a non-empty array.' },
]

/** A `/sworeel` typed by the person in a fullscreen terminal. */
const typed = (args: string) =>
  ({ command: 'sworeel', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } }) as const

const PANE = {
  plugin: 'sworeel',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'sworeel',
  props: { title: 'SwoReel', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

/**
 * Stands in for the world outside the plugin: the pane opening, the reel file, and the
 * `sworeel` command, whose calls it records.
 */
function world(on: On) {
  const opened: unknown[] = []
  const closed: string[] = []
  const commands: string[] = []
  on('ui.open', async (_, e) => {
    opened.push(e)
    return { value: { isPlaced: true } }
  })
  on('ui.close', async (_, e) => {
    closed.push(e.id)
    return { value: undefined }
  })
  on('fs.read', async (_, e) => {
    // On Windows the path arrives as that system writes it, with a drive and backslashes.
    if (!e.path.replaceAll('\\', '/').endsWith('/library/tiny.json')) throw new Error(`no such file: ${e.path}`)
    return { value: JSON.stringify(REEL) }
  })
  on('process.run', async (_, e) => {
    const args = e.argv.slice(1).join(' ')
    commands.push(args)
    const stdout =
      args === 'list --json' ? JSON.stringify(LIST)
      : args === 'paths --json' ? JSON.stringify({ reels: '/library' })
      : args.startsWith('render') ? '/exports/tiny-tall.mp4'
      : args.startsWith('still') ? '/exports/tiny-wide-step1.png'
      : args.startsWith('app') ? 'Showing tiny in the SwoReel app.'
      : args.startsWith('delete') ? 'Moved to the trash: tiny'
      : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return { opened, closed, commands }
}

test('/sworeel alone lists the library, and picking a reel plays it', async ($, on) => {
  const { opened } = world(on)
  expect((await $.command.run(typed(''))).text).toBe('Showing 3 reels in the SwoReel pane.')
  expect(opened).toEqual([{ id: 'sworeel', title: 'SwoReel · Reels', focus: true }])

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ key: 'reel-0' }))?.text).toMatch(/Tiny/)
  expect((await ui.find({ key: 'reel-1' }))?.text).toMatch(/Preflight/)
  expect(await ui.find({ type: 'Text', text: /web\/cors · 6 steps · 29s/ })).toBeDefined()
  // A broken reel is listed with its problem, and cannot be pressed.
  expect(await ui.find({ type: 'Text', text: /needs fixing/ })).toBeDefined()
  expect(await ui.find({ key: 'reel-2' })).toBeUndefined()

  await ui.press({ key: 'reel-0' })
  expect(await ui.find({ type: 'Text', text: /Browser/ })).toBeDefined()
  expect(await ui.find({ key: 'play' })).toBeDefined()

  await ui.press({ key: 'library' })
  expect(await ui.find({ key: 'reel-0' })).toBeDefined()
  await ui.unmount()
})

test('/sworeel with a name plays the reel through its steps', async ($, on) => {
  const clock = mock.clock(on)
  world(on)
  expect((await $.command.run(typed('tiny'))).text).toMatch(/Playing "Tiny"/)

  const ui = await $.ui.mount(PANE)
  await clock.advance(2000)
  expect(await ui.find({ type: 'Text', text: /Browser → Gateway {2}GET \// })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /The browser calls the gateway\./ })).toBeDefined()

  await ui.press({ key: 'forward' })
  expect(await ui.find({ type: 'Text', text: /The gateway answers\./ })).toBeDefined()
  await ui.press({ key: 'back' })
  expect(await ui.find({ type: 'Text', text: /The browser calls the gateway\./ })).toBeDefined()
  await ui.unmount()
})

test('/sworeel words drive the player from the chat', async ($, on) => {
  const clock = mock.clock(on)
  world(on)
  await $.command.run(typed('tiny'))

  const ui = await $.ui.mount(PANE)
  expect((await $.command.run(typed('next'))).text).toBe('Paused "Tiny" at step 1 of 2.')
  expect((await $.command.run(typed('next'))).text).toBe('Paused "Tiny" at step 2 of 2.')
  expect((await $.command.run(typed('back'))).text).toBe('Paused "Tiny" at step 1 of 2.')

  // Paused means paused: time passing changes nothing.
  await clock.advance(5000)
  expect(await ui.find({ type: 'Text', text: /The browser calls the gateway\./ })).toBeDefined()

  expect((await $.command.run(typed('play'))).text).toMatch(/^Playing "Tiny"/)
  await clock.advance(5000)
  expect(await ui.find({ type: 'Text', text: /The gateway answers\./ })).toBeDefined()
  expect((await $.command.run(typed('restart'))).text).toBe('Playing "Tiny" at the start.')
  await ui.unmount()
})

test('the pane says where the keys go, and the person decides', async ($, on) => {
  const { opened } = world(on)
  // Asked for by the person's own command, it takes the keyboard.
  await $.command.run(typed('tiny'))
  expect(opened).toEqual([{ id: 'sworeel', title: 'SwoReel · Tiny', focus: true }])

  const holding = await $.ui.mount(PANE)
  expect(await holding.find({ type: 'Text', text: /KEYS: THIS PANE/ })).toBeDefined()
  await holding.unmount()

  const watching = await $.ui.mount({ ...PANE, props: { ...PANE.props, isFocused: false } })
  expect(await watching.find({ type: 'Text', text: /KEYS: CHAT/ })).toBeDefined()
  expect(await watching.find({ type: 'Text', text: /\/sworeel keys/ })).toBeDefined()
  await watching.unmount()

  expect((await $.command.run(typed('keys'))).text).toMatch(/has the keyboard/)
  expect(opened[1]).toEqual({ id: 'sworeel', title: 'SwoReel · Tiny', focus: true })
})

test('exporting, opening in the app and deleting all go through the sworeel command', async ($, on) => {
  const { commands } = world(on)
  await $.command.run(typed('tiny'))
  await $.command.run(typed('next'))
  const ui = await $.ui.mount(PANE)

  await ui.press({ key: 'export' })
  await ui.press({ key: 'export-tall' })
  expect(await ui.find({ type: 'Text', text: /Saved \/exports\/tiny-tall\.mp4/ })).toBeDefined()
  expect(commands).toContain('render --format tall -- tiny')

  expect((await $.command.run(typed('export still'))).text).toBe('Saved /exports/tiny-wide-step1.png')
  expect(commands).toContain('still --step 1 -- tiny')

  await ui.press({ key: 'app' })
  expect(commands).toContain('app -- tiny')

  // Delete asks first, and Cancel leaves the reel alone.
  await ui.press({ key: 'delete' })
  expect(await ui.find({ type: 'Text', text: /Move "Tiny" to the trash\?/ })).toBeDefined()
  await ui.press({ key: 'cancel' })
  expect(commands).not.toContain('delete -- tiny')

  await ui.press({ key: 'delete' })
  await ui.press({ key: 'delete-yes' })
  expect(commands).toContain('delete -- tiny')
  expect(await ui.find({ key: 'reel-0' })).toBeDefined()
  await ui.unmount()
})

test('a reel shown without being saved plays, but has no file to export', async ($, on) => {
  world(on)
  expect((await $.command.run(typed(JSON.stringify(REEL)))).text).toMatch(/Playing "Tiny"/)
  expect((await $.command.run(typed('export tall'))).text).toMatch(/without being saved/)
})

test('the model can ask what is showing, and show an edit where it was made', async ($, on) => {
  const { opened } = world(on)
  expect((await $.tool.call({ tool: 'mcp__sworeel__play', input: { control: 'status' } })).result).toMatch(/on the reel library/)

  // Opened at a step, the reel waits there, paused, without taking the keyboard.
  expect((await $.tool.call({ tool: 'mcp__sworeel__play', input: { reel: 'tiny', step: 2 } })).result).toBe('Showing "Tiny" in the SwoReel pane, paused at step 2 of 2.')
  expect(opened).toEqual([{ id: 'sworeel', title: 'SwoReel · Tiny' }])
  const ui = await $.ui.mount(PANE)
  expect(await ui.find({ type: 'Text', text: /The gateway answers\./ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Step 2 of 2/ })).toBeDefined()

  expect((await $.tool.call({ tool: 'mcp__sworeel__play', input: { control: 'status' } })).result).toBe(
    'The SwoReel pane last showed the reel "tiny", titled "Tiny", paused at step 2 of 2: "The gateway answers."',
  )
  expect((await $.tool.call({ tool: 'mcp__sworeel__play', input: { control: 'reload' } })).result).toBe('Reloaded "Tiny", paused at step 2 of 2.')
  expect(await ui.find({ type: 'Text', text: /The gateway answers\./ })).toBeDefined()
  await ui.unmount()
})

test('the other kinds of reel play in the pane too', async ($, on) => {
  const clock = mock.clock(on)
  world(on)
  const chart = {
    kind: 'chart',
    title: 'Latency',
    unit: 'ms',
    bars: [
      { id: 'db', label: 'Database', value: 140 },
      { id: 'app', label: 'Rails', value: 18 },
    ],
    steps: [{ caption: 'The query is the slow part.', highlight: ['db'], set: { db: 4 } }],
  }
  expect((await $.command.run(typed(JSON.stringify(chart)))).text).toMatch(/Playing "Latency"/)

  const ui = await $.ui.mount(PANE)
  await clock.advance(4000)
  expect(await ui.find({ type: 'Text', text: /Database/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Database → 4 ms/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /The query is the slow part\./ })).toBeDefined()
  await ui.unmount()
})

test('closing works from the button and from the chat', async ($, on) => {
  const { closed } = world(on)
  await $.command.run(typed('tiny'))
  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'close' })
  expect(closed).toEqual(['sworeel'])
  await ui.unmount()

  expect((await $.command.run(typed('close'))).text).toMatch(/Closed/)
})

test('a reel that does not exist, or is not valid, says what is wrong', async ($, on) => {
  world(on)
  expect((await $.command.run(typed('nope'))).text).toMatch(/no reel called "nope"/)
  expect((await $.command.run(typed('{ "title": "Half-written" }'))).text).toMatch(/"nodes" must be a non-empty array/)
  expect((await $.command.run(typed('pause'))).text).toMatch(/Nothing is playing/)
})

/** The `sworeel` command answering `config` with offers allowed or not, or not answering at all. */
function settings(on: On, suggest: boolean | 'broken') {
  const now = { suggest }
  on('prompt.compose', async () => ({ sections: [{ id: 'intro', text: 'You are Claude.', scope: 'shared' as const }] }))
  on('process.run', async () => ({
    value: { exitCode: now.suggest === 'broken' ? 1 : 0, stdout: JSON.stringify(now), stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  return now
}

const offer = async ($: Parameters<TestBody>[0], traits: PromptComposeTrait[] = []) =>
  (await $.prompt.compose({ model: 'claude', promptModel: 'claude', surfaces: ['terminal'], tools: [], outputStyle: null, traits })).sections.some(section => section.id === 'sworeel:offer')

test('Claude is told it may offer a reel, unless the person turned that off', async ($, on) => {
  settings(on, true)
  expect(await offer($)).toBe(true)
  // Nobody is there to take up an offer in a scripted session.
  expect(await offer($, ['print'])).toBe(false)
})

test('with offers turned off, Claude is told nothing', async ($, on) => {
  settings(on, false)
  expect(await offer($)).toBe(false)
})

test('settings that cannot be read are asked for again', async ($, on) => {
  const now = settings(on, 'broken')
  expect(await offer($)).toBe(false)
  now.suggest = true
  expect(await offer($)).toBe(true)
})
