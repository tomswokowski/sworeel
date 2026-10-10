/** One reel in the library, as the pane lists it. */
export type Entry = {
  /** The name the `sworeel` command knows it by, such as `web/cors`. */
  name: string
  title: string
  /** Its length, or what is wrong with it. */
  detail: string
  isBroken: boolean
}

/** What the pane is showing. */
export type Player = {
  view: 'library' | 'player'
  /** The playing reel's name in the library; empty for one passed inline, which has no file. */
  name: string
  /** The reel as JSON text, already checked to be a valid reel; null when nothing is loaded. */
  source: string | null
  /** Why the reel could not be loaded, when it could not. */
  problem: string | null
  /** Milliseconds into the reel. */
  time: number
  isPlaying: boolean
  library: Entry[]
  /** A question the pane is asking in place of its second row of buttons. */
  asking: 'nothing' | 'export' | 'delete'
  /** The last thing worth telling the person: an export's path, a failure. */
  notice: string | null
  isBusy: boolean
}

declare module 'claude-code' {
  interface PluginState {
    sworeel: { player: Player }
  }
}
