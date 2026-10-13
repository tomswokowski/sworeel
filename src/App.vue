<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import AppDialog from '@/components/AppDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import ExplorerTree, { type Dragged } from '@/components/ExplorerTree.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
import ReelCard from '@/components/ReelCard.vue'
import ReelPlayer from '@/components/ReelPlayer.vue'
import { baseName, fullName, loadBackend, within, type Backend, type Library, type Paths, type ReelFile, type SettingKey, type Settings } from '@/backend.ts'
import { BASE, prepare } from '@/assets.ts'
import type { Assets } from '../plugin/core/canvas.ts'
import { kindOf, parseReel, type Reel } from '../plugin/core/reel.ts'

interface Loaded {
  modified: number
  reel: Reel | null
  problem: string | null
  /** What the reel is drawn with: formulas typeset, a picture loaded. */
  assets: Assets
  /** The reel itself is fine but something it needs was missing (a picture, say), so try again. */
  retry: boolean
}

/** A question to put to the user, and what to do with the answer. */
interface Ask {
  title: string
  message?: string
  input?: string
  options?: { value: string; label: string }[]
  confirmLabel: string
  danger?: boolean
  run: (value: string) => Promise<unknown>
}

const backend = ref<Backend | null>(null)
const paths = ref<Paths | null>(null)
const settings = ref<Settings>({ watermark: '', progress: false, theme: {}, formats: ['wide'], fps: 30 })
const settingsOpen = ref(false)
const settingsError = ref<string | null>(null)

/** The reel or folder being dragged, from the explorer or the grid. */
const dragging = ref<Dragged | null>(null)
const library = ref<Library>({ reels: [], folders: [] })
const loaded = reactive(new Map<string, Loaded>())

/** The folder being browsed; null shows every reel. */
const folder = ref<string | null>(null)
const query = ref('')
const sort = ref<'recent' | 'name'>('recent')
const openPath = ref<string | null>(null)
/** Changes when a different reel is opened, but not when the open one is renamed or moved. */
const playerKey = ref(0)
/** The step the player is on, from 1; 0 before the first. */
const shownStep = ref(0)

const ask = ref<Ask | null>(null)
const askError = ref<string | null>(null)
const askBusy = ref(false)
const failure = ref<string | null>(null)
const notice = ref<string | null>(null)

/** Follow mode: show whichever reel changed last, so the app tracks what Claude is editing. */
const follow = ref(localStorage.getItem('follow') === 'on')
/** The newest change seen so far; null until the library has been read once. */
let newestSeen: number | null = null
let noticeTimer = 0

function toggleFollow() {
  follow.value = !follow.value
  localStorage.setItem('follow', follow.value ? 'on' : 'off')
}

function say(text: string) {
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => (notice.value = null), 4000)
}

const titleOf = (file: ReelFile) => loaded.get(file.path)?.reel?.title ?? file.name

const shown = computed(() => {
  const words = query.value.trim().toLowerCase()
  return library.value.reels
    .filter((file) => folder.value === null || within(file.folder, folder.value))
    .filter((file) => !words || `${titleOf(file)} ${file.name}`.toLowerCase().includes(words))
    .sort((a, b) => (sort.value === 'recent' ? b.modified - a.modified : titleOf(a).localeCompare(titleOf(b))))
})

const openFile = computed(() => library.value.reels.find((file) => file.path === openPath.value) ?? null)

function countIn(parent: string) {
  return library.value.reels.filter((file) => within(file.folder, parent)).length
}

/** Shows a reel in the player. */
function open(path: string) {
  if (openPath.value !== path) playerKey.value++
  openPath.value = path
}

// Keep a note of what is on screen, so Claude can tell which reel and step "this" is.
watch([openPath, shownStep, backend], ([path, step, ready]) => ready?.setShowing(path, path ? step : 0).catch(() => {}))

/**
 * Where the open reel and the chosen folder will be once a rename or move made here shows up
 * in the library, so the view stays on them instead of falling back to the library.
 */
let carry: { openPath?: string; openName?: string; folder?: string } | null = null

/** Remembers where things under `from` end up when that folder becomes `to`. */
function carryFolder(from: string, to: string) {
  const swap = (name: string) => `${to}${name.slice(from.length)}`
  carry = {
    openName: openFile.value && within(openFile.value.folder, from) ? swap(fullName(openFile.value)) : undefined,
    folder: folder.value !== null && within(folder.value, from) ? swap(folder.value) : undefined,
  }
}

/** How many changes made here in the app are under way; Follow Claude ignores what they write. */
let acting = 0
/** Re-reads waiting behind the one that is running: null for none, else whether one was the app's own. */
let waiting: boolean | null = null
let reading: Promise<void> = Promise.resolve()

/**
 * Re-reads the library, one read at a time: a call made while one is running waits its turn,
 * and several waiting calls become one. `ownChange` marks a re-read after something done here
 * in the app, which Follow Claude ignores.
 */
function refresh(ownChange = false): Promise<void> {
  if (waiting !== null) {
    waiting ||= ownChange
    return reading
  }
  waiting = ownChange
  reading = reading.then(async () => {
    const own = waiting ?? false
    waiting = null
    try {
      await readLibrary(own || acting > 0)
    } catch (error) {
      failure.value = String(error)
    }
  })
  return reading
}

/** Lets go of a reel's pictures, a little later so a frame being drawn right now can finish. */
function release(entry: Loaded | undefined) {
  const images = [...(entry?.assets.images?.values() ?? [])]
  if (images.length) setTimeout(() => images.forEach((each) => (each.image as ImageBitmap).close?.()), 1000)
}

// The library is a folder that Claude writes to, so it is re-read every second.
async function readLibrary(ownChange: boolean) {
  if (!backend.value) return
  const next = await backend.value.list()

  for (const file of next.reels) {
    const had = loaded.get(file.path)
    if (had?.modified === file.modified && !had.retry) continue
    let entry: Loaded
    try {
      const reel = parseReel(await backend.value.read(file.path))
      try {
        entry = { modified: file.modified, reel, problem: null, assets: markRaw(await prepare(reel, file.path, backend.value)), retry: false }
      } catch (error) {
        entry = { modified: file.modified, reel: null, problem: error instanceof Error ? error.message : String(error), assets: BASE, retry: true }
      }
    } catch (error) {
      entry = { modified: file.modified, reel: null, problem: error instanceof Error ? error.message : String(error), assets: BASE, retry: false }
    }
    // A retry that fails the same way changes nothing, so nothing is redrawn.
    if (had?.retry && entry.retry && had.problem === entry.problem) continue
    release(had)
    loaded.set(file.path, entry)
  }
  for (const [path, entry] of loaded) {
    if (next.reels.some((file) => file.path === path)) continue
    release(entry)
    loaded.delete(path)
  }

  library.value = next
  if (carry) {
    const { openPath: path, openName: name, folder: chosen } = carry
    carry = null
    const moved = next.reels.find((file) => file.path === path || (name !== undefined && fullName(file) === name))
    if (moved) openPath.value = moved.path
    if (chosen !== undefined && next.folders.includes(chosen)) folder.value = chosen
  }
  if (folder.value !== null && !next.folders.includes(folder.value)) folder.value = null
  if (openPath.value && !next.reels.some((file) => file.path === openPath.value)) openPath.value = null

  // Follow mode: a reel written or edited since the last look comes to the front.
  const newest = next.reels.reduce<ReelFile | null>((latest, file) => (!latest || file.modified > latest.modified ? file : latest), null)
  if (follow.value && !ownChange && newest && newestSeen !== null && newest.modified > newestSeen) open(newest.path)
  newestSeen = Math.max(newestSeen ?? 0, newest?.modified ?? 0)

  // A reel asked for from the terminal with `sworeel app <reel>`.
  const request = await backend.value.takeRequest()
  if (request?.reel) {
    const wanted = next.reels.find((file) => fullName(file) === request.reel)
    if (wanted) open(wanted.path)
  }

  // Settings and folders can be changed by Claude too. They are only replaced when they differ,
  // because everything drawn depends on them and would otherwise be redrawn every second. While
  // a change made here is being saved, the file still holds the old value, so it is left alone.
  const [readSettings, readPaths] = await Promise.all([backend.value.settings(), backend.value.paths()])
  if (saving === 0 && JSON.stringify(readSettings) !== JSON.stringify(settings.value)) settings.value = readSettings
  if (JSON.stringify(readPaths) !== JSON.stringify(paths.value)) paths.value = readPaths
}

/** Runs something that changes the library from here in the app, then shows the result. */
async function act(action: () => Promise<unknown>) {
  acting++
  try {
    await action()
    failure.value = null
    await refresh(true)
  } finally {
    acting--
  }
}

async function answer(value: string) {
  const asked = ask.value
  if (!asked) return
  askBusy.value = true
  askError.value = null
  try {
    await act(() => asked.run(value))
    // The person may have cancelled and opened another question while this one was running.
    if (ask.value === asked) ask.value = null
  } catch (error) {
    if (ask.value === asked) askError.value = String(error)
    else failure.value = String(error)
  } finally {
    askBusy.value = false
  }
}

function question(next: Ask) {
  askError.value = null
  ask.value = next
}

const picker = ref<HTMLInputElement | null>(null)

/** For actions that need no question first. */
async function attempt(action: () => Promise<unknown>) {
  try {
    await act(action)
  } catch (error) {
    failure.value = String(error)
  }
}

/** Saves a reel, a folder (`name/`) or everything (`.`) as one file to carry to another computer. */
async function exportFile(name: string) {
  if (!backend.value) return
  try {
    const path = await backend.value.bundle(name)
    say(`Saved ${baseName(path)} to your exports folder. Import it in SwoReel on the other computer.`)
  } catch (error) {
    failure.value = String(error)
  }
}

/** Adds the reels in a chosen bundle file to the library. */
function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Cleared so that choosing the same file again still counts as a change.
  input.value = ''
  if (file) attempt(async () => say((await backend.value!.importBundle(await file.text())) || 'That file has no reels in it.'))
}

/** Shows a file or folder with the desktop's own application. */
function reveal(path: string) {
  backend.value?.open(path).catch((error) => (failure.value = String(error)))
}

function renameReel(file: ReelFile) {
  question({
    title: 'Rename Reel',
    message: 'This is the file name Claude refers to the reel by. The title shown in the video is part of the reel itself.',
    input: file.name,
    confirmLabel: 'Rename',
    run: async (name) => {
      const path = await backend.value!.renameReel(file.path, name)
      if (openPath.value === file.path) carry = { openPath: path }
    },
  })
}

function moveReel(file: ReelFile) {
  const destinations = ['', ...library.value.folders].filter((candidate) => candidate !== file.folder)
  question({
    title: `Move “${titleOf(file)}”`,
    message: destinations.length ? undefined : 'There are no other folders yet. Create one from the sidebar first.',
    options: destinations.map((value) => ({ value, label: value || 'Top Level' })),
    confirmLabel: 'Move',
    run: async (destination) => {
      if (!destinations.length) return
      const path = await backend.value!.moveReel(file.path, destination)
      if (openPath.value === file.path) carry = { openPath: path }
    },
  })
}

function duplicateReel(file: ReelFile) {
  attempt(() => backend.value!.duplicateReel(file.path))
}

function deleteReel(file: ReelFile) {
  question({
    title: `Delete “${titleOf(file)}”?`,
    message: 'The reel moves to your system trash, so you can restore it from there. Exported videos and images are not affected.',
    confirmLabel: 'Move to trash',
    danger: true,
    run: () => backend.value!.deleteReel(file.path),
  })
}

/** Puts the start of a message about a reel on the clipboard, ready to paste into Claude. */
async function copyRequest(file: ReelFile) {
  const text = `In my SwoReel reel "${fullName(file)}" (titled "${titleOf(file)}"), `
  try {
    await navigator.clipboard.writeText(text)
    say('Copied. Paste it into Claude and finish the sentence.')
  } catch {
    question({ title: 'Copy This Into Claude', message: 'Copying was not allowed here, so select and copy it yourself.', input: text, confirmLabel: 'Done', run: async () => {} })
  }
}

/** How many setting changes are on their way to being saved. */
let saving = 0

async function setSetting(key: SettingKey, value: string) {
  settingsError.value = null
  // Show the change at once; saving goes through the sworeel command, which takes a moment.
  const before = settings.value
  if (key === 'progress') settings.value = { ...before, progress: value === 'on' }
  else if (key === 'watermark') settings.value = { ...before, watermark: value }
  else if (key === 'fps') settings.value = { ...before, fps: Number(value) }
  else if (key === 'formats') settings.value = { ...before, formats: value.split(',') as Settings['formats'] }
  saving++
  try {
    await backend.value!.setSetting(key, value)
  } catch (error) {
    settings.value = before
    settingsError.value = String(error)
  } finally {
    saving--
  }
}

/** Moves a reel dropped on a folder ('' is the top level). */
function dropReel(file: ReelFile, target: string) {
  dragging.value = null
  attempt(async () => {
    const path = await backend.value!.moveReel(file.path, target)
    if (openPath.value === file.path) carry = { openPath: path }
    say(`Moved “${file.name}” to ${target || 'the top level'}.`)
  })
}

/** Moves a folder dropped on another folder, with everything in it. */
function dropFolder(moved: string, target: string) {
  dragging.value = null
  attempt(async () => {
    await backend.value!.moveFolder(moved, target)
    carryFolder(moved, [target, baseName(moved)].filter(Boolean).join('/'))
    say(`Moved the folder “${moved.split('/').pop()}” to ${target || 'the top level'}.`)
  })
}

function newFolder(parent: string) {
  question({
    title: parent ? `New Folder in “${parent}”` : 'New Folder',
    input: '',
    confirmLabel: 'Create',
    run: (name) => backend.value!.createFolder(parent, name),
  })
}

function renameFolder(target: string) {
  question({
    title: 'Rename Folder',
    input: target.split('/').pop()!,
    confirmLabel: 'Rename',
    run: async (name) => {
      await backend.value!.renameFolder(target, name)
      carryFolder(target, [...target.split('/').slice(0, -1), name.trim()].join('/'))
    },
  })
}

function deleteFolder(target: string) {
  const count = countIn(target)
  question({
    title: `Delete Folder “${target}”?`,
    message:
      count === 0
        ? 'The folder is empty.'
        : `The folder and the ${count} reel${count === 1 ? '' : 's'} in it move to your system trash, so you can restore them from there.`,
    confirmLabel: count === 0 ? 'Delete' : 'Move to trash',
    danger: true,
    run: () => backend.value!.deleteFolder(target),
  })
}

// A newer version of the app, once it has been fetched in the background.
const update = ref<string | null>(null)

async function lookForUpdate() {
  update.value = (await backend.value?.updateReady().catch(() => null)) ?? null
  if (update.value) clearInterval(updates)
}

let poll = 0
let updates = 0

onMounted(async () => {
  try {
    backend.value = await loadBackend()
    paths.value = await backend.value.paths()
    await refresh()
    poll = window.setInterval(() => refresh(), 1000)
    updates = window.setInterval(lookForUpdate, 15_000)
  } catch (error) {
    failure.value = String(error)
  }
  // Once the window is gone it is showing nothing.
  window.addEventListener('pagehide', forget)
})

const forget = () => void backend.value?.setShowing(null, 0).catch(() => {})

onUnmounted(() => {
  clearInterval(poll)
  clearInterval(updates)
  window.removeEventListener('pagehide', forget)
})
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <img src="@/assets/icon.svg" alt="" width="28" height="28" />
      <span>Swo<b>Reel</b></span>
    </div>

    <ExplorerTree
      :library="library"
      :open-path="openPath"
      :folder="folder"
      :dragging="dragging"
      :kind-of="(path) => (loaded.get(path)?.reel ? kindOf(loaded.get(path)!.reel!) : null)"
      :title-of="titleOf"
      @open-reel="open($event.path)"
      @select-folder="((folder = $event), (openPath = null))"
      @drag="dragging = $event"
      @move-reel="dropReel"
      @move-folder="dropFolder"
      @rename-reel="renameReel"
      @duplicate-reel="duplicateReel"
      @copy-request="copyRequest"
      @delete-reel="deleteReel"
      @new-folder="newFolder"
      @rename-folder="renameFolder"
      @delete-folder="deleteFolder"
      @export-file="exportFile"
      @import-file="picker?.click()"
    />
    <input ref="picker" type="file" accept=".sworeel" hidden @change="importFile" />

    <div class="foot">
      <button v-if="follow" class="following" title="The app is showing whichever reel changed last. Click to stop." @click="toggleFollow">
        ● Following Claude
      </button>
      <button
        v-if="update"
        class="update"
        :title="`SwoReel ${update} has been downloaded. Restart to use it now; otherwise it opens next time.`"
        @click="attempt(() => backend!.restartToUpdate())"
      >
        Version {{ update }} Is Ready · Restart
      </button>
      <button class="settings" @click="((settingsError = null), (settingsOpen = true))">
        <AppIcon name="settings" />
        Settings
      </button>
    </div>
  </aside>

  <ReelPlayer
    v-if="openFile && backend && paths"
    :key="playerKey"
    :backend="backend"
    :file="openFile"
    :reel="loaded.get(openFile.path)?.reel ?? null"
    :problem="loaded.get(openFile.path)?.problem ?? null"
    :exports-folder="paths.exports"
    :settings="settings"
    :assets="loaded.get(openFile.path)?.assets ?? BASE"
    @back="openPath = null"
    @step="shownStep = $event"
    @open="reveal"
    @copy-request="copyRequest(openFile)"
  />

  <main v-else class="browse">
    <header>
      <h1>{{ folder ?? 'All Reels' }}</h1>
      <input v-model="query" type="search" placeholder="Search Reels" aria-label="Search reels" />
      <select v-model="sort" aria-label="Sort by">
        <option value="recent">Newest First</option>
        <option value="name">By Title</option>
      </select>
    </header>

    <p v-if="library.reels.length === 0" class="empty">
      No reels yet. Ask Claude to explain something as a reel and it will appear here.
    </p>
    <p v-else-if="shown.length === 0" class="empty">
      {{ query ? 'No reels match that search.' : 'This folder is empty. Drag a reel here, or use Move to… in its ⋯ menu.' }}
    </p>

    <div v-else class="grid">
      <ReelCard
        v-for="file in shown"
        :key="file.path"
        :file="file"
        :reel="loaded.get(file.path)?.reel ?? null"
        :problem="loaded.get(file.path)?.problem ?? null"
        :watermark="settings.watermark"
        :progress="settings.progress"
        :theme="settings.theme"
        :assets="loaded.get(file.path)?.assets ?? BASE"
        @open="open(file.path)"
        @drag="dragging = $event ? { type: 'reel', id: file.path } : null"
        @rename="renameReel(file)"
        @move="moveReel(file)"
        @duplicate="duplicateReel(file)"
        @copy-request="copyRequest(file)"
        @export-file="exportFile(fullName(file))"
        @delete="deleteReel(file)"
      />
    </div>
  </main>

  <!-- Outside the views, so a problem is seen whichever of them is showing. -->
  <p v-if="failure" class="failure" role="alert">
    <span>{{ failure }}</span>
    <button @click="failure = null">Dismiss</button>
  </p>
  <p v-if="notice" class="notice" role="status">{{ notice }}</p>

  <SettingsDialog
    v-if="settingsOpen && paths"
    :settings="settings"
    :paths="paths"
    :follow="follow"
    :error="settingsError"
    @set="setSetting"
    @toggle-follow="toggleFollow"
    @open="reveal"
    @export-all="exportFile('.')"
    @import-file="picker?.click()"
    @close="settingsOpen = false"
  />

  <AppDialog
    v-if="ask"
    :key="ask.title"
    :title="ask.title"
    :message="ask.message"
    :input="ask.input"
    :options="ask.options"
    :confirm-label="ask.confirmLabel"
    :danger="ask.danger"
    :error="askError"
    :busy="askBusy"
    @submit="answer"
    @cancel="ask = null"
  />
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 15rem;
  padding: 1rem 0.75rem;
  border-right: 1px solid var(--border);
  background: var(--bg);
  overflow-y: auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1.25rem 0.5rem;
  font-size: 1.15rem;
  font-weight: 700;
}

.brand b {
  color: var(--accent);
}

.foot {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-top: auto;
  padding-top: 1rem;
}

.foot button {
  background: none;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.foot .following,
.foot .update {
  border-color: transparent;
  color: var(--accent);
  font-size: 0.85rem;
}

.notice {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  /* Above the Settings window, which can start an export or import. */
  z-index: 20;
  margin: 0;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--accent);
  border-radius: 0.5rem;
  background: var(--surface);
  transform: translateX(-50%);
}

.browse {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow-y: auto;
}

header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

h1 {
  flex: 1;
  margin: 0;
  font-size: 1.05rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

input[type='search'] {
  width: 14rem;
  height: 2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.empty {
  margin: 0;
  padding: 2rem 1rem;
  color: var(--muted);
  text-align: center;
}

/* A problem, shown over whichever view is up, above dialogs too. */
.failure {
  position: fixed;
  top: 1rem;
  left: 50%;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: min(44rem, calc(100vw - 2rem));
  margin: 0;
  padding: 0.5rem 0.6rem 0.5rem 0.9rem;
  border: 1px solid var(--error);
  border-radius: 0.5rem;
  background: var(--surface);
  color: var(--error);
  transform: translateX(-50%);
}

.failure span {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
