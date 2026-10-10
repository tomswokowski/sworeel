<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { fullName, within, type Library, type ReelFile } from '@/backend.ts'
import { useDismiss } from '@/overlays.ts'
import type { Kind } from '../../plugin/core/reel.ts'

/** Something being dragged: a reel (by its path) or a folder (by its path within the library). */
export type Dragged = { type: 'reel' | 'folder'; id: string }

type Row = { key: string; type: 'folder' | 'reel'; depth: number; label: string; folder: string; file?: ReelFile }

const props = defineProps<{
  library: Library
  /** The open reel's path, and the folder whose reels the main area is listing. */
  openPath: string | null
  folder: string | null
  dragging: Dragged | null
  /** A reel's kind, or null when its file can't be read as a reel. */
  kindOf: (path: string) => Kind | null
  titleOf: (file: ReelFile) => string
}>()

const emit = defineEmits<{
  openReel: [file: ReelFile]
  selectFolder: [folder: string | null]
  drag: [dragged: Dragged | null]
  moveReel: [file: ReelFile, into: string]
  moveFolder: [folder: string, into: string]
  renameReel: [file: ReelFile]
  duplicateReel: [file: ReelFile]
  copyRequest: [file: ReelFile]
  deleteReel: [file: ReelFile]
  newFolder: [parent: string]
  renameFolder: [folder: string]
  deleteFolder: [folder: string]
  /** Save a reel, a folder (`name/`) or everything (`.`) as one file for another computer. */
  exportFile: [name: string]
  importFile: []
}>()

const KIND_ICONS: Record<Kind, string> = {
  flow: 'workflow', sequence: 'list', tree: 'git-branch', timeline: 'clock', gantt: 'calendar', chart: 'chart-bar', line: 'activity',
  scatter: 'gauge', pie: 'gauge', code: 'code', array: 'layers', math: 'brain', map: 'globe', picture: 'image', screen: 'monitor', sketch: 'pencil',
}

// Which folders are closed. Everything starts open, and the choice is remembered.
function remembered(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem('collapsed') ?? '[]')
    return Array.isArray(stored) ? stored.filter((each) => typeof each === 'string') : []
  } catch {
    return []
  }
}

const collapsed = ref(new Set<string>(remembered()))
watch(collapsed, (closed) => localStorage.setItem('collapsed', JSON.stringify([...closed])), { deep: true })

const parentOf = (folder: string) => folder.split('/').slice(0, -1).join('/')

/** The rows on show, top to bottom: each folder's subfolders first, then its reels, as a file explorer lists them. */
const rows = computed(() => {
  const out: Row[] = []
  const list = (parent: string, depth: number) => {
    for (const folder of props.library.folders.filter((each) => parentOf(each) === parent).sort()) {
      out.push({ key: `folder:${folder}`, type: 'folder', depth, label: folder.split('/').pop()!, folder })
      if (!collapsed.value.has(folder)) list(folder, depth + 1)
    }
    for (const file of props.library.reels.filter((each) => each.folder === parent).sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ key: `reel:${file.path}`, type: 'reel', depth, label: file.name, folder: parent, file })
    }
  }
  list('', 0)
  return out
})

// The open reel is always findable: its folders open up.
watch(
  () => props.openPath,
  (path) => {
    // By the time the open reel changes, the library already lists it where it now lives.
    const file = props.library.reels.find((each) => each.path === path)
    for (const folder of [...collapsed.value]) if (file && within(file.folder, folder)) collapsed.value.delete(folder)
  },
)

function toggle(folder: string) {
  if (collapsed.value.has(folder)) collapsed.value.delete(folder)
  else collapsed.value.add(folder)
}

// --- dragging -----------------------------------------------------------------------------

/** The folder the pointer is over while dragging ('' is the top level), or null. */
const over = ref<string | null>(null)
let opening = 0

/** Whether what is being dragged can be dropped into a folder: not where it already is, and never a folder into itself. */
function accepts(target: string) {
  const dragged = props.dragging
  if (!dragged) return false
  if (dragged.type === 'reel') return props.library.reels.find((file) => file.path === dragged.id)?.folder !== target
  return !within(target, dragged.id) && parentOf(dragged.id) !== target
}

/** `onRow` is true over a row: a row that refuses the drop must not pass it on to the empty space behind it. */
function dragOver(event: DragEvent, target: string, onRow = false) {
  if (onRow) event.stopPropagation()
  if (!accepts(target)) {
    if (onRow) over.value = null
    return
  }
  event.preventDefault()
  if (over.value === target) return
  over.value = target
  // Resting on a closed folder opens it, so something can be dropped deeper inside.
  clearTimeout(opening)
  if (collapsed.value.has(target)) opening = window.setTimeout(() => collapsed.value.delete(target), 600)
}

function drop(event: DragEvent, target: string, onRow = false) {
  const dragged = props.dragging
  clearTimeout(opening)
  over.value = null
  if (onRow) event.stopPropagation()
  if (!dragged || !accepts(target)) return
  event.preventDefault()
  if (dragged.type === 'folder') return emit('moveFolder', dragged.id, target)
  const file = props.library.reels.find((each) => each.path === dragged.id)
  if (file) emit('moveReel', file, target)
}

function startDrag(event: DragEvent, row: Row) {
  const dragged: Dragged = row.type === 'reel' ? { type: 'reel', id: row.file!.path } : { type: 'folder', id: row.folder }
  event.dataTransfer?.setData('text/plain', dragged.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  emit('drag', dragged)
}

watch(
  () => props.dragging,
  (dragged) => {
    if (!dragged) over.value = null
  },
)

// --- the right-click menu -----------------------------------------------------------------

const menu = ref<{ x: number; y: number; row: Row | null } | null>(null)

function openMenu(event: MouseEvent, row: Row | null) {
  // Keep the menu on screen when opened near the bottom or right edge.
  menu.value = { x: Math.min(event.clientX, window.innerWidth - 200), y: Math.min(event.clientY, window.innerHeight - 220), row }
}

function choose(action: () => void) {
  // The action reads which row the menu was opened on, so it runs before the menu goes.
  action()
  menu.value = null
}

const menuRoot = ref<HTMLElement | null>(null)
useDismiss(menuRoot, () => menu.value !== null, () => (menu.value = null))
</script>

<template>
  <div class="explorer" :class="{ target: over === '' }" @dragover="dragOver($event, '')" @drop="drop($event, '')" @contextmenu.prevent="openMenu($event, null)">
    <header>
      <span>Reels</span>
      <button title="Import Reels From a File" aria-label="Import reels from a file" @click="emit('importFile')"><AppIcon name="download" :size="14" /></button>
      <button title="New Folder" aria-label="New folder" @click="emit('newFolder', folder ?? '')"><AppIcon name="folder" :size="14" /><b>+</b></button>
      <button title="Collapse All Folders" aria-label="Collapse all folders" @click="collapsed = new Set(library.folders)"><AppIcon name="layers" :size="14" /></button>
    </header>

    <button class="row all" :class="{ on: folder === null && openPath === null }" @click="emit('selectFolder', null)">
      <AppIcon name="house" :size="15" />
      <span>All Reels</span>
      <small>{{ library.reels.length }}</small>
    </button>

    <div
      v-for="row in rows"
      :key="row.key"
      class="row"
      :class="{
        on: row.type === 'reel' ? row.file!.path === openPath : row.folder === folder && openPath === null,
        target: over !== null && over !== '' && row.type === 'folder' && row.folder === over,
        inside: over !== null && over !== '' && row.folder !== '' && (row.folder === over || row.folder.startsWith(`${over}/`)),
        lifted: dragging?.id === (row.type === 'reel' ? row.file!.path : row.folder),
        broken: row.type === 'reel' && kindOf(row.file!.path) === null,
      }"
      :style="{ paddingLeft: `${0.4 + row.depth * 0.9}rem` }"
      :title="row.type === 'reel' ? titleOf(row.file!) : row.folder"
      role="treeitem"
      :aria-expanded="row.type === 'folder' ? !collapsed.has(row.folder) : undefined"
      draggable="true"
      tabindex="0"
      @click="row.type === 'reel' ? emit('openReel', row.file!) : (toggle(row.folder), emit('selectFolder', row.folder))"
      @keydown.enter="row.type === 'reel' ? emit('openReel', row.file!) : toggle(row.folder)"
      @contextmenu.prevent.stop="openMenu($event, row)"
      @dragstart="startDrag($event, row)"
      @dragend="emit('drag', null)"
      @dragover="dragOver($event, row.folder, true)"
      @drop="drop($event, row.folder, true)"
    >
      <svg v-if="row.type === 'folder'" class="chevron" :class="{ open: !collapsed.has(row.folder) }" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span v-else class="chevron" />
      <AppIcon :name="row.type === 'folder' ? 'folder' : kindOf(row.file!.path) ? KIND_ICONS[kindOf(row.file!.path)!] : 'triangle-alert'" :size="15" />
      <span>{{ row.label }}</span>
    </div>

    <p v-if="rows.length === 0" class="empty">No reels yet. Ask Claude to explain something as a reel.</p>
    <p v-if="dragging" class="hint">Drop on a folder to move it there, or on empty space for the top level.</p>

    <div v-if="menu" ref="menuRoot" class="menu" role="menu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" @click.stop>
      <template v-if="menu.row?.type === 'reel'">
        <button role="menuitem" @click="choose(() => emit('openReel', menu!.row!.file!))">Open</button>
        <button role="menuitem" @click="choose(() => emit('renameReel', menu!.row!.file!))">Rename…</button>
        <button role="menuitem" @click="choose(() => emit('duplicateReel', menu!.row!.file!))">Duplicate</button>
        <button role="menuitem" @click="choose(() => emit('copyRequest', menu!.row!.file!))">Ask Claude…</button>
        <button role="menuitem" @click="choose(() => emit('exportFile', fullName(menu!.row!.file!)))">Export as File</button>
        <hr />
        <button role="menuitem" class="danger" @click="choose(() => emit('deleteReel', menu!.row!.file!))">Delete</button>
      </template>
      <template v-else-if="menu.row">
        <button role="menuitem" @click="choose(() => emit('newFolder', menu!.row!.folder))">New Folder Inside…</button>
        <button role="menuitem" @click="choose(() => emit('renameFolder', menu!.row!.folder))">Rename…</button>
        <button role="menuitem" @click="choose(() => emit('exportFile', `${menu!.row!.folder}/`))">Export as File</button>
        <hr />
        <button role="menuitem" class="danger" @click="choose(() => emit('deleteFolder', menu!.row!.folder))">Delete</button>
      </template>
      <template v-else>
        <button role="menuitem" @click="choose(() => emit('newFolder', ''))">New Folder…</button>
        <hr />
        <button role="menuitem" @click="choose(() => emit('importFile'))">Import From a File…</button>
        <button role="menuitem" @click="choose(() => emit('exportFile', '.'))">Export All as File</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.explorer {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 8rem;
  border-radius: 0.4rem;
  overflow-y: auto;
}

/* Dropping on the empty part of the explorer moves to the top level. */
.explorer.target {
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
}

header {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  margin: 0 0.25rem 0.35rem 0.5rem;
  color: var(--muted);
}

header span {
  flex: 1;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

header button {
  display: flex;
  align-items: center;
  height: 1.6rem;
  padding: 0 0.35rem;
  border: 0;
  background: none;
  color: var(--muted);
}

header button:hover {
  color: var(--text);
}

header b {
  margin-left: 1px;
  font-size: 0.8rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  height: 1.75rem;
  padding-right: 0.5rem;
  border: 0;
  border-radius: 0.3rem;
  background: none;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  user-select: none;
}

.row.all {
  padding-left: 0.5rem;
  margin-bottom: 0.15rem;
}

.row:hover {
  background: var(--surface);
}

.row > span:not(.chevron) {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row small {
  color: var(--muted);
}

.row svg {
  color: var(--muted);
}

.row.on {
  background: var(--surface);
  color: var(--accent);
}

.row.on svg {
  color: var(--accent);
}

.row.broken,
.row.broken svg {
  color: var(--error);
}

/* The folder something would be dropped into, and what is already in it. */
.row.target {
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
}

.row.inside {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.row.lifted {
  opacity: 0.4;
}

.chevron {
  width: 14px;
  flex: none;
  transition: transform 0.12s;
}

.chevron.open {
  transform: rotate(90deg);
}

.empty,
.hint {
  margin: 0.5rem;
  color: var(--muted);
  font-size: 0.85rem;
}

.menu {
  position: fixed;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 11rem;
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

.menu hr {
  width: 100%;
  margin: 0.25rem 0;
  border: 0;
  border-top: 1px solid var(--border);
}

.menu .danger {
  color: var(--error);
}
</style>
