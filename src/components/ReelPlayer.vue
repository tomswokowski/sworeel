<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { baseName, fullName, type Backend, type ExportKind, type ReelFile, type Settings } from '@/backend.ts'
import { FORMAT_LABELS } from '@/formats.ts'
import { dialogOpen, useDismiss } from '@/overlays.ts'
import { drawReel, FORMATS, type Assets, type Context2D, type Format } from '../../plugin/core/render.ts'
import type { Reel } from '../../plugin/core/reel.ts'
import { playheadAt, stepRestTime, timeline } from '../../plugin/core/timing.ts'

const props = defineProps<{
  backend: Backend
  file: ReelFile
  reel: Reel | null
  /** Why the file could not be read as a reel. */
  problem: string | null
  exportsFolder: string
  settings: Settings
  /** What the reel is drawn with: formulas typeset, a picture loaded. */
  assets: Assets
}>()

const emit = defineEmits<{
  back: []
  copyRequest: []
  /** The step on screen, from 1; 0 before the first. */
  step: [number: number]
  /** Show a file or folder with the desktop's own application. */
  open: [path: string]
}>()

const format = ref<Format>(props.settings.formats[0] ?? 'wide')
const time = ref(0)
const playing = ref(false)
const speed = ref(1)
const exportMenu = ref(false)
const exporting = ref<string | null>(null)
const exported = ref<{ made: string; paths: string[] } | { error: string } | null>(null)

const canvas = ref<HTMLCanvasElement | null>(null)
const size = computed(() => FORMATS[format.value])
const moments = computed(() => (props.reel ? timeline(props.reel) : { starts: [], duration: 0 }))
const duration = computed(() => moments.value.duration)
const step = computed(() => (props.reel ? playheadAt(props.reel, time.value).index : -1))
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

watch(step, (index) => emit('step', index + 1), { immediate: true })

// The file can change underneath us while Claude edits it; keep the position if it still exists.
watch(duration, (length) => (time.value = Math.min(time.value, length)))

function showStep(index: number) {
  if (!props.reel) return
  const clamped = Math.min(Math.max(index, -1), props.reel.steps.length - 1)
  time.value = clamped === -1 ? 0 : stepRestTime(props.reel, clamped)
  playing.value = false
}

function togglePlay() {
  if (!props.reel) return
  if (time.value >= duration.value) time.value = 0
  playing.value = !playing.value
}

function restart() {
  time.value = 0
  playing.value = true
}

/** Dragging the scrubber moves through the reel, and holds it where it is let go. */
function scrub(event: Event) {
  time.value = Number((event.target as HTMLInputElement).value)
  playing.value = false
}

/** The most steps the scrubber marks one by one. */
const MOST_MARKS = 40

// The first three follow the format picked in the bar. "Videos in …" is offered only when the
// default formats in Settings are more than one, since otherwise it repeats "Video".
const EXPORTS = computed(() => {
  const count = props.reel?.steps.length ?? 0
  const current = Math.max(step.value + 1, 1)
  const defaults = props.settings.formats.map((each) => FORMAT_LABELS[each])
  const choices: { what: ExportKind | 'file'; label: string; hint: string; doing: string }[] = [
    { what: 'video' as ExportKind, label: 'Video', hint: 'The whole reel, animated', doing: 'Rendering the video…' },
    { what: 'still' as ExportKind, label: `Still of Step ${current}`, hint: 'One image of the step showing now', doing: 'Saving the still…' },
    { what: 'stills' as ExportKind, label: `Stills of All ${count} Steps`, hint: 'One image per step, in a folder', doing: `Saving ${count} stills…` },
  ]
  if (defaults.length > 1) {
    choices.push({ what: 'videos', label: `Videos in ${defaults.join(', ')}`, hint: 'Your default formats, from Settings', doing: `Rendering ${defaults.length} videos…` })
  }
  // Not a video or image: the reel itself, to open in SwoReel somewhere else.
  choices.push({ what: 'file', label: 'Reel File', hint: 'This reel and its pictures, to import on another computer', doing: 'Saving the reel file…' })
  return choices
})

async function runExport(choice: (typeof EXPORTS.value)[number]) {
  exportMenu.value = false
  exporting.value = choice.doing
  exported.value = null
  try {
    const paths = choice.what === 'file' ? [await props.backend.bundle(fullName(props.file))] : await props.backend.exportReel(props.file.path, choice.what, format.value, Math.max(step.value + 1, 1))
    const made = choice.what === 'stills' ? `Saved ${props.reel?.steps.length} stills to` : paths.length > 1 ? `Saved ${paths.length} videos:` : 'Saved'
    exported.value = { made, paths }
  } catch (error) {
    exported.value = { error: String(error) }
  } finally {
    exporting.value = null
  }
}

let frame = 0
let last = 0
/** What the last frame drawn was drawn from, so a paused reel is not redrawn sixty times a second. */
let drawn: unknown[] = []

function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx || !props.reel) return
  const from = [canvas.value, props.reel, format.value, time.value, props.assets, props.settings]
  if (from.every((each, i) => each === drawn[i])) return
  drawn = from
  const { watermark, progress, theme } = props.settings
  drawReel(ctx as Context2D, props.reel, format.value, playheadAt(props.reel, time.value), { ...props.assets, watermark, progress, theme })
}

function tick(now: number) {
  const delta = now - last
  last = now
  if (playing.value) {
    time.value = Math.min(time.value + delta * speed.value, duration.value)
    if (time.value >= duration.value) playing.value = false
  }
  draw()
  frame = requestAnimationFrame(tick)
}

function onKey(event: KeyboardEvent) {
  // A dialog over the player has the keyboard to itself.
  if (dialogOpen()) return
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
  if (event.key === ' ') togglePlay()
  else if (event.key === 'ArrowRight') showStep(step.value + 1)
  else if (event.key === 'ArrowLeft') showStep(step.value - 1)
  else if (event.key === 'r') restart()
  else if (event.key === 'Escape') emit('back')
  else return
  event.preventDefault()
}

const exportRoot = ref<HTMLElement | null>(null)
useDismiss(exportRoot, () => exportMenu.value, () => (exportMenu.value = false))

onMounted(() => {
  last = performance.now()
  frame = requestAnimationFrame(tick)
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <section class="player">
    <header>
      <button title="Back to the Library (Esc)" @click="emit('back')">← Library</button>
      <strong>{{ reel?.title ?? file.name }}</strong>
      <span>{{ fullName(file) }}</span>
      <button title="Copies the start of a message about this reel, to paste into Claude" @click="emit('copyRequest')">Ask Claude…</button>
    </header>

    <div class="stage">
      <pre v-if="problem" class="problem">This reel file has a problem:

{{ problem }}</pre>
      <canvas v-else-if="reel" ref="canvas" :width="size.w" :height="size.h" />
    </div>

    <p v-if="exporting" class="result" role="status">{{ exporting }}</p>
    <p v-else-if="exported" class="result" :class="{ failed: 'error' in exported }" role="status">
      <template v-if="'paths' in exported">
        <span>{{ exported.made }} {{ exported.paths.map(baseName).join(', ') }}</span>
        <button v-if="exported.paths.length === 1 && !exported.paths[0]!.endsWith('.sworeel')" @click="emit('open', exported.paths[0]!)">Open</button>
        <button @click="emit('open', exportsFolder)">Show Folder</button>
        <button aria-label="Dismiss" @click="exported = null">✕</button>
      </template>
      <template v-else>
        <span>{{ exported.error }}</span>
        <button aria-label="Dismiss" @click="exported = null">✕</button>
      </template>
    </p>

    <footer>
      <!-- Where you are: a scrubber with a mark at the start of every step. -->
      <div class="scrub">
        <span class="time">{{ clock(time) }}</span>
        <div class="track">
          <input type="range" min="0" :max="duration" step="10" :value="time" :disabled="!reel" aria-label="Position in the reel" @input="scrub" />
          <!-- Left out when there are so many steps that the marks would be too close to press. -->
          <button
            v-for="(start, i) in moments.starts.length <= MOST_MARKS ? moments.starts : []"
            :key="i"
            class="mark"
            :class="{ passed: i <= step }"
            :style="{ left: `${(start / duration) * 100}%` }"
            :title="`Step ${i + 1}`"
            :aria-label="`Go to Step ${i + 1}`"
            @click="showStep(i)"
          />
        </div>
        <span class="time">{{ clock(duration) }}</span>
      </div>

      <div class="bar">
        <span class="group">
          <button title="Previous Step (←)" :disabled="!reel" @click="showStep(step - 1)">◀</button>
          <button class="play" title="Play or Pause (Space)" :disabled="!reel" @click="togglePlay">
            {{ playing ? 'Pause' : time >= duration && duration ? 'Replay' : 'Play' }}
          </button>
          <button title="Next Step (→)" :disabled="!reel" @click="showStep(step + 1)">▶</button>
          <button title="Restart (R)" :disabled="!reel" @click="restart">Restart</button>
          <span v-if="reel" class="where">{{ step < 0 ? `${reel.steps.length} ${reel.steps.length === 1 ? 'Step' : 'Steps'}` : `Step ${step + 1} of ${reel.steps.length}` }}</span>
        </span>

        <span class="group">
          <span class="segment" role="group" aria-label="Format">
            <button v-for="(label, name) in FORMAT_LABELS" :key="name" :class="{ on: format === name }" :aria-pressed="format === name" @click="format = name">
              {{ label }}
            </button>
          </span>
          <select v-model.number="speed" aria-label="Speed" title="Playback Speed">
            <option :value="0.5">0.5×</option>
            <option :value="1">1×</option>
            <option :value="1.5">1.5×</option>
            <option :value="2">2×</option>
          </select>
        </span>

        <span ref="exportRoot" class="export">
          <button class="primary" :disabled="!reel || exporting !== null" :aria-expanded="exportMenu" @click="exportMenu = !exportMenu">
            {{ exporting ? 'Exporting…' : 'Export ▾' }}
          </button>
          <div v-if="exportMenu" class="menu" role="menu">
            <template v-for="choice in EXPORTS" :key="choice.what">
              <p v-if="choice.what === 'video'" class="heading">Export in {{ FORMAT_LABELS[format] }}</p>
              <p v-else-if="choice.what === 'videos' || choice.what === 'file'" class="divider" />
              <button role="menuitem" @click="runExport(choice)">
                <strong>{{ choice.label }}</strong>
                <small>{{ choice.hint }}</small>
              </button>
            </template>
          </div>
        </span>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.player {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

header span {
  flex: 1;
  color: var(--muted);
}

.stage {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 1rem;
}

canvas {
  max-width: 100%;
  max-height: 100%;
}

.problem {
  max-width: 100%;
  color: var(--error);
  white-space: pre-wrap;
}

.result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  overflow-wrap: anywhere;
}

.result.failed {
  color: var(--error);
}

footer {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border);
  background: var(--bg);
}

.scrub {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.time {
  min-width: 2.2rem;
  color: var(--muted);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.track {
  position: relative;
  flex: 1;
  height: 1.25rem;
}

.track input {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  accent-color: var(--accent);
  cursor: pointer;
}

/* A dot on the track at the start of each step; pressing one jumps there. */
.mark {
  position: absolute;
  top: 50%;
  width: 0.5rem;
  height: 0.5rem;
  padding: 0;
  border: 2px solid var(--bg);
  border-radius: 50%;
  background: var(--muted);
  transform: translate(-50%, -50%);
}

.mark.passed {
  background: var(--accent);
}

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.group,
.segment {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.group {
  gap: 0.5rem;
}

.segment button {
  border-radius: 0;
}

.segment button:first-child {
  border-radius: 0.4rem 0 0 0.4rem;
}

.segment button:last-child {
  border-radius: 0 0.4rem 0.4rem 0;
}

.segment {
  gap: 0;
}

.segment button + button {
  margin-left: -1px;
}

button.on {
  position: relative;
  border-color: var(--accent);
  color: var(--accent);
}

.play {
  min-width: 4.5rem;
}

.where {
  margin-left: 0.5rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.export {
  position: relative;
}

.primary {
  min-width: 6.5rem;
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg);
  font-weight: 600;
}

.menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.4rem);
  z-index: 5;
  display: flex;
  flex-direction: column;
  width: 17rem;
  padding: 0.25rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface);
  box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 50%);
}

.menu button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  height: auto;
  padding: 0.5rem 0.6rem;
  border: 0;
  background: none;
  text-align: left;
}

.menu button:hover {
  background: var(--bg);
}

.menu .heading {
  margin: 0;
  padding: 0.4rem 0.6rem 0.2rem;
  color: var(--muted);
  font-size: 0.8em;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.menu .divider {
  height: 1px;
  margin: 0.25rem 0;
  background: var(--border);
}

.menu small {
  color: var(--muted);
}
</style>
