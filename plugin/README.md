# SwoReel

SwoReel is a Claude Code plugin that turns an explanation into a short animated "reel": a picture that builds up step by step, with a one-sentence caption for each step. Claude writes the reel; you watch it, change it by asking, and export it as an MP4 video or PNG images in wide, tall or square shapes.

Ask for one in plain words:

- "Make a reel of how a request reaches the database."
- "Walk through this function as a reel."
- "Make a reel of this post" with a link, a document, a ticket or a repository.

There are sixteen kinds of reels: system and request flows, sequences, trees and file structures, timelines, Gantt plans, bar, line, scatter and pie charts, code walkthroughs, array and algorithm steps, maths, maps, annotated screenshots, UI mock-ups and free sketches.

## What is in the plugin

- **A skill**, `sworeel:reel`, that teaches Claude to write, check, show and manage reels.
- **A command**, `sworeel`, in `bin/`, that validates reels and renders them. Claude runs it; you do not have to.
- **A pane**, opened with `/sworeel` or by Claude, that plays a reel beside the chat.

## What it needs

- Node.js 22.18 or newer. Nothing else: the ffmpeg that makes video comes with the plugin's dependencies, and yours is used if you have one.

## What it runs, reads, writes and fetches

Everything happens on your computer. SwoReel has no account and no server, and collects no data.

- **Runs:** the `sworeel` command, which is TypeScript in this folder run by Node.js, and `ffmpeg` when a video is rendered: yours if it is on your PATH, otherwise the one from the plugin's dependencies. `sworeel open` and `sworeel app` start your system's default application for a file, or the optional SwoReel desktop app if you installed it.
- **Reads and writes:** your reels and the pictures they use (in your system's application-data folder), your settings (in its configuration folder) and your exports (in `Documents/SwoReel`). `sworeel paths` prints the exact locations, and each can be moved. Deleting a reel moves it to the system trash.
- **Fetches:** its five npm dependencies, once, when the plugin is installed or the command first runs: `@napi-rs/canvas` (drawing, with a prebuilt binary for your system), `@ffmpeg-installer/ffmpeg` (a prebuilt ffmpeg for your system, about 70 MB), `mathjax-full` (typesetting formulas) and two `@fontsource` font packages. Versions are fixed by `package-lock.json`. After that the plugin makes no network requests.
- **Tells Claude:** a short note, added to Claude's instructions in each session, that it may end an explanation with a one-line offer to show it as a reel. `sworeel config suggest off` turns that off.

When you ask for a reel of a web page, it is Claude Code that opens the page, with its own tools and permissions; the plugin does not.

## What the pane's hooks do

The pane beside the chat is a hooks module (`hooks/register.tsx`). It runs inside Claude Code and sends nothing over the network: it has no network calls of its own, and the one program it runs, the plugin's `sworeel` command, makes none either. Here is everything it does:

- **When a session starts,** it registers the `/sworeel` command and one tool for Claude, `play` (known to Claude Code as `mcp__sworeel__play`), which shows a reel in the pane. It answers that tool itself, every time it is called, because the tool is its own and has nothing else behind it; it stands in for no other tool and changes no other tool's calls. Its `tool.call` hook is attached to that one tool only, so the only part of the conversation it sees is what Claude passes to `play`: a reel's name or a reel to show, a step number, or a control such as pause. Of that, only a reel's name ever reaches the `sworeel` command, when the user exports, opens or deletes that reel.
- **It adds one short section to Claude's instructions** (the `prompt.compose` hook): a note that Claude may end an explanation with a one-line offer to show it as a reel. It changes nothing else in the instructions, and leaves the note out when the user has turned offers off with `sworeel config suggest off`, or when the session is scripted.
- **It draws the pane** (`ui.render`) and closes it when asked (`ui.close`), and runs a timer while a reel plays.
- **It keeps the player's state** in Claude Code's session state (`state.get` and `state.set`): which reel is open, its contents, the step and time it is at, whether it is playing, and the list of reels to pick from. That state stays in the session. None of it is passed to the `sworeel` command except the name of the reel being exported, opened in the app or deleted.
- **It reads no files itself.** To show a reel it asks the `sworeel` command for it (`sworeel show --json`), which reads and checks the file.
- **It runs one program: the plugin's own `sworeel` command**, in `bin/`, to do what the user or Claude asked. The calls it makes are `sworeel list` (the reels to pick from), `sworeel show --json` (one reel, to play), `sworeel config` (to read the offer setting), `sworeel render` and `sworeel still` (to export), `sworeel app` (to open the desktop app) and `sworeel delete` (to move a reel to the trash, only when the user confirms in the pane).

## Environment

SwoReel reads no credentials and needs no keys or accounts. The only environment variables it reads are where to keep its files and where to find programs: `HOME`, `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `APPDATA` and `LOCALAPPDATA` (the system's folders for app data and settings), `PATH` (to find Node.js, ffmpeg and the desktop app), and `SWOREEL_HOME`, `SWOREEL_FFMPEG` and `SWOREEL_DEV`, which only its own tests and development setup set.

## Where the bundled data comes from

Two files in `core/data/` are generated, not written by hand, and say so at the top:

- `icons.ts` holds a subset of the [Lucide](https://lucide.dev) icons (ISC licence), made by [`scripts/build-icons.mjs`](https://github.com/tomswokowski/sworeel/blob/main/scripts/build-icons.mjs).
- `land.ts` holds the land outlines from [Natural Earth](https://www.naturalearthdata.com) (public domain), made by [`scripts/build-land.mjs`](https://github.com/tomswokowski/sworeel/blob/main/scripts/build-land.mjs).

Everything else in the plugin is the source itself: TypeScript that Node.js runs directly, with no build step. Dependencies come from the public npm registry, at the versions in `package-lock.json`, installed once when the plugin is installed. The `package.json` and lockfile at the top of the repository, above this folder, belong to the optional desktop app; the plugin's install does not use them. The tests for the command live outside this folder, in the repository's `tests` folder, so they are not part of the plugin.

## More

- Website and setup: https://sworeel.com
- Source, issues and the optional desktop app: https://github.com/tomswokowski/sworeel
- Licence: MIT
