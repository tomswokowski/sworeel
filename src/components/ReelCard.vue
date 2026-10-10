<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { fullName, type ReelFile } from '@/backend.ts'
import { useDismiss } from '@/overlays.ts'
import { fontsReady } from '@/fonts.ts'
import { drawReel, FORMATS, type Assets, type Context2D } from '../../plugin/core/render.ts'
import type { Reel } from '../../plugin/core/reel.ts'
import type { Theme } from '../../plugin/core/theme.ts'
import { playheadAt, stepRestTime, timeline } from '../../plugin/core/timing.ts'

const props = defineProps<{
  file: ReelFile
  reel: Reel | null
  /** Why the file could not be read as a reel. */
  problem: string | null
  watermark: string
  /** Whether the step dots are drawn. */
  progress: boolean
  /** The user's colours, from the settings. */
  theme: Partial<Theme>
  /** What the reel is drawn with: formulas typeset, a picture loaded. */
  assets: Assets
}>()

const emit = defineEmits<{ open: []; rename: []; move: []; duplicate: []; copyRequest: []; exportFile: []; delete: []; drag: [isDragging: boolean] }>()

const THUMBNAIL_SCALE = 0.3
const size = { w: FORMATS.wide.w * THUMBNAIL_SCALE, h: FORMATS.wide.h * THUMBNAIL_SCALE }

// Shown as an image rather than a live canvas: the web view empties a canvas when its card is
// moved, as happens when the sort order changes.
const thumbnail = ref<string | null>(null)
const title = ref<HTMLElement | null>(null)
const menu = ref(false)

const detail = computed(() => {
  if (!props.reel) return 'Needs fixing'
  const seconds = Math.round(timeline(props.reel).duration / 1000)
  return `${props.reel.steps.length} ${props.reel.steps.length === 1 ? 'Step' : 'Steps'} · ${seconds}s`
})

// The thumbnail is the reel's final frame, when everything has been revealed.
watchEffect(() => {
  if (!props.reel || !fontsReady.value) return
  const canvas = document.createElement('canvas')
  canvas.width = size.w
  canvas.height = size.h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(THUMBNAIL_SCALE, 0, 0, THUMBNAIL_SCALE, 0, 0)
  const lastStep = props.reel.steps.length - 1
  drawReel(ctx as Context2D, props.reel, 'wide', playheadAt(props.reel, stepRestTime(props.reel, lastStep)), { ...props.assets, watermark: props.watermark, progress: props.progress, theme: props.theme })
  thumbnail.value = canvas.toDataURL()
})

function choose(action: 'rename' | 'move' | 'duplicate' | 'copyRequest' | 'exportFile' | 'delete') {
  menu.value = false
  if (action === 'rename') emit('rename')
  else if (action === 'move') emit('move')
  else if (action === 'duplicate') emit('duplicate')
  else if (action === 'copyRequest') emit('copyRequest')
  else if (action === 'exportFile') emit('exportFile')
  else emit('delete')
}

/**
 * Starts a drag of this reel, to be dropped on a folder in the sidebar. The whole card can be
 * grabbed, but only its title follows the pointer. The title is used because the web view
 * ignores a drag picture that is not already on screen.
 */
function startDrag(event: DragEvent) {
  event.dataTransfer?.setData('text/plain', props.file.path)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  if (title.value) event.dataTransfer?.setDragImage(title.value, 12, 12)
  emit('drag', true)
}

const more = ref<HTMLElement | null>(null)
useDismiss(more, () => menu.value, () => (menu.value = false))
</script>

<template>
  <article class="card" draggable="true" title="Drag onto a folder to move it" @dragstart="startDrag" @dragend="emit('drag', false)">
    <button class="preview" :title="reel ? 'Open' : 'Open to see the problem'" @click="emit('open')">
      <img v-if="reel" :src="thumbnail ?? undefined" :width="size.w" :height="size.h" alt="" draggable="false" />
      <span v-else class="broken">
        <strong>This reel can't be shown</strong>
        <small>{{ problem?.split('\n')[0] }}</small>
      </span>
    </button>

    <div class="meta">
      <div class="text">
        <strong ref="title">{{ reel?.title ?? file.name }}</strong>
        <span :class="{ bad: problem }">{{ fullName(file) }} · {{ detail }}</span>
      </div>

      <div ref="more" class="more">
        <button aria-label="Reel actions" :aria-expanded="menu" @click="menu = !menu">⋯</button>
        <div v-if="menu" class="menu" role="menu">
          <button role="menuitem" @click="choose('rename')">Rename</button>
          <button role="menuitem" @click="choose('move')">Move To…</button>
          <button role="menuitem" @click="choose('duplicate')">Duplicate</button>
          <button role="menuitem" title="Copies the start of a message about this reel, to paste into Claude" @click="choose('copyRequest')">
            Ask Claude…
          </button>
          <button role="menuitem" title="Saves this reel and its pictures as one file, to import on another computer" @click="choose('exportFile')">
            Export as File
          </button>
          <button role="menuitem" class="danger" @click="choose('delete')">Delete</button>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  background: var(--bg);
}

.card:hover {
  border-color: var(--muted);
}

.preview {
  display: block;
  height: auto;
  padding: 0;
  border: 0;
  border-radius: 0.6rem 0.6rem 0 0;
  background: var(--bg);
  overflow: hidden;
  aspect-ratio: 16 / 9;
}

img {
  display: block;
  width: 100%;
  height: auto;
}

.broken {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0 1rem;
  color: var(--error);
  overflow-wrap: anywhere;
}

.broken small {
  color: var(--muted);
}

.meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.5rem 0.6rem 0.75rem;
  border-top: 1px solid var(--border);
}

.text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.text strong,
.text span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text strong {
  align-self: flex-start;
  max-width: 100%;
}

.text span {
  color: var(--muted);
  font-size: 0.85em;
}

.text span.bad {
  color: var(--error);
}

.more {
  position: relative;
}

.more > button {
  padding: 0 0.5rem;
  border-color: transparent;
  background: none;
  font-size: 1.1rem;
}

.menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.25rem);
  z-index: 5;
  display: flex;
  flex-direction: column;
  min-width: 9rem;
  padding: 0.25rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface);
  box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 50%);
}

.menu button {
  border: 0;
  background: none;
  text-align: left;
}

.menu button:hover {
  background: var(--bg);
}

.menu .danger {
  color: var(--error);
}
</style>
