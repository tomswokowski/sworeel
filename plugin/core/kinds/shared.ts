// What several kinds do the same way.
import type { Kind, ReelStep } from '../reel.ts'
import { movement, stepTiming, type Playhead } from '../timing.ts'

type Revealing = { show?: string[]; highlight?: string[] }

/**
 * For kinds whose steps reveal and emphasise things by id: how far each thing has appeared
 * (0 to 1) and how it should be emphasised, at this moment.
 * Without a playhead, everything is shown as it stands at the end.
 */
export function stage<Step extends { caption: string } & Revealing>(items: { id: string; hidden?: boolean }[], steps: Step[], kind: Kind, playhead: Playhead | null) {
  const index = playhead?.index ?? steps.length - 1
  const step = steps[index]
  const change = playhead && step ? movement(step as ReelStep, kind, playhead.elapsed) : 1
  // Where a step has a reveal phase of its own (before a message sets off), things appear
  // during it; elsewhere they appear as the picture changes.
  const reveal = step ? stepTiming(step as ReelStep, kind).reveal : 0
  const appearing = playhead && reveal ? Math.min(playhead.elapsed / reveal, 1) : change
  const highlighted = step?.highlight?.length ? new Set(step.highlight) : null

  const shown = new Map(
    items.map((item) => {
      if (!item.hidden) return [item.id, 1]
      const revealedAt = steps.findIndex((s) => s.show?.includes(item.id))
      return [item.id, revealedAt === -1 || revealedAt > index ? 0 : revealedAt < index ? 1 : appearing]
    }),
  )

  return {
    step,
    change,
    shown: (id: string) => shown.get(id) ?? 0,
    emphasis: (id: string): 'normal' | 'high' | 'low' => (!highlighted ? 'normal' : highlighted.has(id) ? 'high' : 'low'),
  }
}

/** "+ A, B" for what a step reveals and "◆ C" for what it only emphasises. */
export function describeStage(step: Revealing, labelOf: (id: string) => string) {
  const emphasised = (step.highlight ?? []).filter((id) => !step.show?.includes(id))
  return [step.show?.length ? `+ ${step.show.map(labelOf).join(', ')}` : '', emphasised.length ? `◆ ${emphasised.map(labelOf).join(', ')}` : '']
    .filter(Boolean)
    .join('   ')
}

/** Breaks text into lines no wider than `width` characters. */
export function wrapChars(text: string, width: number) {
  const lines: string[] = []
  for (const word of text.split(/\s+/)) {
    const last = lines.at(-1)
    if (last !== undefined && last.length + 1 + word.length <= width) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}
