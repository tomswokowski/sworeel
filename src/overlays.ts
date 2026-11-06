// What dialogs and pop-up menus share: owning the keyboard while open, and closing when the
// person presses Escape or goes elsewhere.
import { nextTick, onMounted, onUnmounted, type Ref } from 'vue'

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Whether a dialog is open, which is when the page behind it should ignore the keyboard. */
export const dialogOpen = () => document.querySelector('[aria-modal="true"]') !== null

/**
 * Makes an element a real modal dialog: focus moves into it and stays there, Escape closes it
 * wherever the focus is, and the focus goes back where it was afterwards.
 */
export function useModal(root: Ref<HTMLElement | null>, close: () => void) {
  let before: Element | null = null

  function onKey(event: KeyboardEvent) {
    if (!root.value) return
    if (event.key === 'Escape') {
      // Nothing behind the dialog should hear this.
      event.stopImmediatePropagation()
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') {
      const stops = [...root.value.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = stops[0]
      const last = stops[stops.length - 1]
      if (!first || !last) return event.preventDefault()
      const outside = !root.value.contains(document.activeElement)
      if (event.shiftKey && (outside || document.activeElement === first)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (outside || document.activeElement === last)) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  onMounted(async () => {
    before = document.activeElement
    window.addEventListener('keydown', onKey, true)
    await nextTick()
    if (root.value && !root.value.contains(document.activeElement)) (root.value.querySelector<HTMLElement>(FOCUSABLE) ?? root.value).focus()
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKey, true)
    if (before instanceof HTMLElement && before.isConnected) before.focus()
  })
}

/**
 * Closes a pop-up menu when the person presses outside it or presses Escape. Pressing another
 * menu's button counts as outside, so only one menu is ever open. While it is open, the up and
 * down arrows (and Home and End) move through its items.
 */
export function useDismiss(root: Ref<HTMLElement | null>, isOpen: () => boolean, close: () => void) {
  function onPointer(event: PointerEvent) {
    if (isOpen() && !(event.target instanceof Node && root.value?.contains(event.target))) close()
  }

  function onKey(event: KeyboardEvent) {
    if (!isOpen() || !['Escape', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    // The menu takes these keys, so the page behind does not also act on them.
    event.stopImmediatePropagation()
    event.preventDefault()
    if (event.key === 'Escape') return close()
    const items = [...(root.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLElement)
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
      : at < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1)
      : (at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  onMounted(() => {
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('keydown', onKey, true)
  })

  onUnmounted(() => {
    window.removeEventListener('pointerdown', onPointer, true)
    window.removeEventListener('keydown', onKey, true)
  })
}
