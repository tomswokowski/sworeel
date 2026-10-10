<script setup lang="ts">
import { ICONS } from '../../plugin/core/data/icons.ts'

// One of the bundled icons, drawn in the colour of the text around it.
defineProps<{ name: string; size?: number }>()
</script>

<template>
  <svg viewBox="0 0 24 24" :width="size ?? 16" :height="size ?? 16" aria-hidden="true">
    <path v-for="d in ICONS[name] ?? []" :key="d" :d="d" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>

<style scoped>
svg {
  flex: none;
}
</style>
