import { kindOf, type Kind, type Reel, type ReelStep } from './reel.ts'

/** Pause on the bare diagram before the first step. */
const INTRO_MS = 1200
/** Pause on the final frame so a looping video doesn't cut off the last caption. */
const OUTRO_MS = 1500
const REVEAL_MS = 500
const TRAVEL_MS = 1100
/** How long the other kinds take to change to a step's state. */
const CHANGE_MS = 700

/** Where playback is: which step, and how far into it. `index` is -1 during the intro. */
export interface Playhead {
  index: number
  elapsed: number
}

/**
 * How long each phase of a step lasts: reveal, then the movement, then a pause to read.
 * In a flow the movement is a message travelling; in the other kinds it is the picture
 * changing to the step's state.
 */
export function stepTiming(step: ReelStep, kind: Kind = 'flow') {
  // In a flow, a sequence or a map the movement is a message, and only steps that send one have it.
  const flow = kind === 'flow' || kind === 'sequence' || kind === 'map' ? (step as { show?: unknown[]; from?: string; to?: string }) : null
  const reveal = flow?.show?.length ? REVEAL_MS : 0
  const travel = flow ? (flow.from && flow.to ? TRAVEL_MS : 0) : CHANGE_MS
  const hold = 1100 + step.caption.length * 30
  return { reveal, travel, total: reveal + travel + hold }
}

/** 0 to 1: how far the step's movement has got, eased at both ends. */
export function movement(step: ReelStep, kind: Kind, elapsed: number) {
  const { reveal, travel } = stepTiming(step, kind)
  if (!travel) return 1
  const linear = Math.min(Math.max((elapsed - reveal) / travel, 0), 1)
  return linear * linear * (3 - 2 * linear)
}

/** Start time of every step, and the length of the whole reel, in milliseconds. */
export function timeline(reel: Reel) {
  const starts: number[] = []
  let time = INTRO_MS
  for (const step of reel.steps) {
    starts.push(time)
    time += stepTiming(step, kindOf(reel)).total
  }
  return { starts, duration: time + OUTRO_MS }
}

export function playheadAt(reel: Reel, timeMs: number): Playhead {
  const { starts } = timeline(reel)
  let index = -1
  while (index + 1 < starts.length && timeMs >= starts[index + 1]!) index++
  return { index, elapsed: index === -1 ? timeMs : timeMs - starts[index]! }
}

/** The moment a step has finished animating and is resting on its caption. */
export function stepRestTime(reel: Reel, index: number) {
  const { starts } = timeline(reel)
  const step = reel.steps[index]
  if (!step) return 0
  const { reveal, travel } = stepTiming(step, kindOf(reel))
  return starts[index]! + reveal + travel + 400
}
