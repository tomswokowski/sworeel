<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Paths, SettingKey, Settings } from '@/backend.ts'
import { FORMAT_LABELS } from '@/formats.ts'
import { useModal } from '@/overlays.ts'
import type { Format } from '../../plugin/core/render.ts'

const props = defineProps<{
  settings: Settings
  paths: Paths
  follow: boolean
  /** What went wrong saving the last change, if anything. */
  error: string | null
}>()

const emit = defineEmits<{
  set: [key: SettingKey, value: string]
  toggleFollow: []
  open: [path: string]
  /** Save every reel as one file, or add the reels from such a file. */
  exportAll: []
  importFile: []
  close: []
}>()

const FORMATS: { name: Format; label: string; use: string }[] = [
  { name: 'wide', label: FORMAT_LABELS.wide, use: 'Slides, landscape video' },
  { name: 'tall', label: FORMAT_LABELS.tall, use: 'Phones, vertical video' },
  { name: 'square', label: FORMAT_LABELS.square, use: 'Feeds' },
]

/** The frame rates on offer, plus whatever is set if Claude chose another. */
const rates = computed(() => [...new Set([24, 30, 60, props.settings.fps])].sort((a, b) => a - b))

const dialog = ref<HTMLElement | null>(null)
useModal(dialog, () => emit('close'))

const watermark = ref(props.settings.watermark)
const exportsFolder = ref(props.paths.exports)
const changingFolder = ref(false)

// Settings can change underneath the dialog, since Claude can set them too.
watch(() => props.settings.watermark, (value) => (watermark.value = value))
watch(() => props.paths.exports, (value) => (exportsFolder.value = value))

function toggleFormat(name: Format) {
  const chosen = props.settings.formats.includes(name) ? props.settings.formats.filter((each) => each !== name) : [...props.settings.formats, name]
  // At least one format has to stay chosen, or there would be nothing to render.
  if (chosen.length) emit('set', 'formats', FORMATS.map((format) => format.name).filter((each) => chosen.includes(each)).join(','))
}

function saveFolder() {
  if (exportsFolder.value.trim() && exportsFolder.value !== props.paths.exports) emit('set', 'exports', exportsFolder.value.trim())
  changingFolder.value = false
}
</script>

<template>
  <div class="backdrop" @click.self="emit('close')">
    <section ref="dialog" class="dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabindex="-1">
      <header>
        <h2 id="settings-title">Settings</h2>
        <button @click="emit('close')">Done</button>
      </header>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="group">
        <h3>Working with Claude</h3>
        <label class="row">
          <span>
            <strong>Follow Claude</strong>
            <small>Show whichever reel changed last, so the app tracks what Claude is working on.</small>
          </span>
          <button class="switch" role="switch" aria-label="Follow Claude" :aria-checked="follow" :class="{ on: follow }" @click="emit('toggleFollow')" />
        </label>
      </div>

      <div class="group">
        <h3>Exports</h3>
        <div class="row">
          <span>
            <strong>Default Video Formats</strong>
            <small>Claude's exports render each of these. With two or more, the Export menu offers them together.</small>
          </span>
          <span class="choices">
            <button
              v-for="format in FORMATS"
              :key="format.name"
              :class="{ on: settings.formats.includes(format.name) }"
              :aria-pressed="settings.formats.includes(format.name)"
              :title="format.use"
              @click="toggleFormat(format.name)"
            >
              {{ format.label }}
            </button>
          </span>
        </div>

        <label class="row">
          <span>
            <strong>Frame Rate</strong>
            <small>30 suits every platform. 60 is smoother and makes larger files.</small>
          </span>
          <select :value="settings.fps" aria-label="Frame rate" @change="emit('set', 'fps', ($event.target as HTMLSelectElement).value)">
            <option v-for="rate in rates" :key="rate" :value="rate">{{ rate }} fps</option>
          </select>
        </label>

        <label class="row">
          <span>
            <strong>Watermark</strong>
            <small>A short credit, such as your handle, in the corner of every video and image.</small>
          </span>
          <input
            v-model="watermark"
            type="text"
            placeholder="None"
            spellcheck="false"
            aria-label="Watermark"
            @change="emit('set', 'watermark', watermark.trim())"
          />
        </label>

        <label class="row">
          <span>
            <strong>Step Dots</strong>
            <small>The row of dots at the bottom of every video and image that shows how far along it is.</small>
          </span>
          <button
            class="switch"
            role="switch"
            :aria-checked="settings.progress"
            :class="{ on: settings.progress }"
            aria-label="Step Dots"
            @click="emit('set', 'progress', settings.progress ? 'off' : 'on')"
          />
        </label>

        <div class="row folder">
          <span>
            <strong>Exports Folder</strong>
            <input v-if="changingFolder" v-model="exportsFolder" type="text" spellcheck="false" aria-label="Exports folder" @keydown.enter="saveFolder" />
            <small v-else class="path">{{ paths.exports }}</small>
          </span>
          <span class="choices">
            <button v-if="changingFolder" class="on" @click="saveFolder">Save</button>
            <button v-else @click="changingFolder = true">Change</button>
            <button @click="emit('open', paths.exports)">Open</button>
          </span>
        </div>
      </div>

      <div class="group">
        <h3>Library</h3>
        <div class="row folder">
          <span>
            <strong>Reels Folder</strong>
            <small class="path">{{ paths.reels }}</small>
          </span>
          <button @click="emit('open', paths.reels)">Open</button>
        </div>

        <div class="row">
          <span>
            <strong>Move to Another Computer</strong>
            <small>Export every reel and its pictures as one file, then import that file in SwoReel on the other computer.</small>
          </span>
          <span class="choices">
            <button @click="emit('exportAll')">Export All Reels</button>
            <button @click="emit('importFile')">Import…</button>
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 60%);
}

.dialog {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: min(36rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  padding: 1.25rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--bg);
  overflow-y: auto;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
}

h3 {
  margin: 0 0 0.5rem;
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.group {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0.7rem 0;
  border-top: 1px solid var(--border);
}

.row > span:first-child {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

small {
  color: var(--muted);
  font-size: 0.85em;
}

.path {
  overflow-wrap: anywhere;
}

.choices {
  display: flex;
  gap: 0.25rem;
}

input[type='text'] {
  width: 12rem;
  height: 2rem;
  padding: 0 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

.folder input[type='text'] {
  width: 100%;
}

button.on {
  border-color: var(--accent);
  color: var(--accent);
}

/* A sliding toggle: the knob sits left when off, right and lit when on. */
.switch {
  position: relative;
  flex: none;
  width: 2.75rem;
  min-width: 0;
  height: 1.5rem;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg);
  transition: background 0.15s, border-color 0.15s;
}

.switch::after {
  position: absolute;
  top: 50%;
  left: 0.2rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: var(--muted);
  content: '';
  transform: translateY(-50%);
  transition: left 0.15s, background 0.15s;
}

.switch.on {
  border-color: var(--accent);
  background: var(--accent);
}

.switch.on::after {
  left: calc(100% - 1.2rem);
  background: var(--bg);
}

.error {
  margin: 0;
  color: var(--error);
}
</style>
