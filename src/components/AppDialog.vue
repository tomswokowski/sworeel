<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useModal } from '@/overlays.ts'

const props = defineProps<{
  title: string
  message?: string
  /** Shows a text field, starting with this value. */
  input?: string
  /** Shows a list to pick one value from. */
  options?: { value: string; label: string }[]
  confirmLabel: string
  danger?: boolean
  /** What went wrong on the last attempt, if anything. */
  error?: string | null
  busy?: boolean
}>()

const emit = defineEmits<{ submit: [value: string]; cancel: [] }>()

const text = ref(props.input ?? '')
const picked = ref(props.options?.[0]?.value ?? '')
const field = ref<HTMLInputElement | null>(null)
const dialog = ref<HTMLElement | null>(null)
useModal(dialog, () => emit('cancel'))

onMounted(async () => {
  await nextTick()
  field.value?.focus()
  field.value?.select()
})

function submit() {
  emit('submit', props.input !== undefined ? text.value : picked.value)
}
</script>

<template>
  <div class="backdrop" @click.self="emit('cancel')">
    <form ref="dialog" class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1" @submit.prevent="submit">
      <h2 id="dialog-title">{{ title }}</h2>
      <p v-if="message">{{ message }}</p>

      <input v-if="input !== undefined" ref="field" v-model="text" type="text" spellcheck="false" :aria-label="title" />

      <div v-if="options" class="options">
        <label v-for="option in options" :key="option.value" :class="{ on: picked === option.value }">
          <input v-model="picked" type="radio" :value="option.value" />
          {{ option.label }}
        </label>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button type="button" @click="emit('cancel')">Cancel</button>
        <button type="submit" class="primary" :class="{ danger }" :disabled="busy">{{ confirmLabel }}</button>
      </div>
    </form>
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
  gap: 0.75rem;
  width: min(26rem, calc(100vw - 2rem));
  padding: 1.25rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--bg);
}

h2 {
  margin: 0;
  font-size: 1.05rem;
}

p {
  margin: 0;
  color: var(--muted);
}

input[type='text'] {
  height: 2.25rem;
  padding: 0 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--surface);
  color: var(--text);
  font: inherit;
}

.options {
  display: flex;
  flex-direction: column;
  max-height: 16rem;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
}

.options label {
  display: flex;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  cursor: pointer;
}

.options label.on {
  background: var(--surface);
  color: var(--accent);
}

.error {
  color: var(--error);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.primary {
  border-color: var(--accent);
  color: var(--accent);
}

.primary.danger {
  border-color: var(--error);
  color: var(--error);
}
</style>
