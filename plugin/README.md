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

## What it needs

- Node.js 22.18 or newer. Nothing else: the ffmpeg that makes video comes with the plugin's dependencies, and yours is used if you have one.

## What it runs, reads, writes and fetches

Everything happens on your computer. SwoReel has no account and no server, and collects no data. It has no hooks, so nothing runs unless Claude runs the `sworeel` command, and it adds nothing to Claude's instructions beyond the skill.

- **Runs:** the `sworeel` command, which is TypeScript in this folder run by Node.js (through `mise exec` when Node.js is only available that way). The first time it runs, it runs `npm install` in this folder to fetch its dependencies. `ffmpeg` runs when a video is rendered: yours if it is on your PATH, otherwise the one from the plugin's dependencies. Deleting a reel or folder moves it to the system trash with the system's own tool: `trash`, or Finder through `osascript`, on macOS; PowerShell on Windows; `gio trash` or `trash-put` on Linux, or a move into the desktop's trash folder where neither is there. `sworeel open` runs `open`, `explorer` or `xdg-open` to show a file or folder, and `sworeel app` starts the optional SwoReel desktop app if you installed it.
- **Reads and writes:** your reels and the pictures they use (in your system's application-data folder), your settings (in its configuration folder), your exports (in `Documents/SwoReel`), and preview stills for the chat (in a `previews` folder beside your reels, one per reel, replaced each time). `sworeel paths` prints the exact locations, and each can be moved. Deleting a reel moves it to the system trash. It also reads and writes files that you or Claude name in a command: a reel file given by its path, an image added with `sworeel asset add`, a `.sworeel` file to import, or an `--out` file. On Linux it reads `user-dirs.dirs` in your configuration folder to find your Documents folder.
- **Fetches:** its five npm dependencies, once, the first time the command runs: `@napi-rs/canvas` (drawing, with a prebuilt binary for your system), `@ffmpeg-installer/ffmpeg` (a prebuilt ffmpeg for your system, about 70 MB), `mathjax-full` (typesetting formulas) and two `@fontsource` font packages. Versions are fixed by `package-lock.json`. After that the plugin makes no network requests.

When you ask for a reel of a web page, or ask Claude to install the optional desktop app, it is Claude Code that opens the page or downloads the installer, with its own tools and permissions, asking you as it would for anything else; the plugin does not.

## Environment

SwoReel reads no credentials and needs no keys or accounts. The only environment variables it reads are where to keep its files and where to find programs: `HOME`, `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `APPDATA`, `LOCALAPPDATA` and `ProgramFiles` (the system's folders for app data, settings and programs), `PATH` (to find Node.js, ffmpeg and the desktop app), and `SWOREEL_HOME`, `SWOREEL_FFMPEG` and `SWOREEL_DEV`, which only its own tests and development setup set.

## Where the bundled data comes from

Two files in `core/data/` are generated, not written by hand, and say so at the top:

- `icons.ts` holds a subset of the [Lucide](https://lucide.dev) icons (ISC licence), made by [`scripts/build-icons.mjs`](https://github.com/tomswokowski/sworeel/blob/main/scripts/build-icons.mjs).
- `land.ts` holds the land outlines from [Natural Earth](https://www.naturalearthdata.com) (public domain), made by [`scripts/build-land.mjs`](https://github.com/tomswokowski/sworeel/blob/main/scripts/build-land.mjs).

Everything else in the plugin is the source itself: TypeScript that Node.js runs directly, with no build step. Dependencies come from the public npm registry, at the versions in `package-lock.json`, installed once, the first time the command runs. The `package.json` and lockfile at the top of the repository, above this folder, belong to the optional desktop app; the plugin's install does not use them. The tests for the command live outside this folder, in the repository's `tests` folder, so they are not part of the plugin.

## More

- Website and setup: https://sworeel.com
- Source, issues and the optional desktop app: https://github.com/tomswokowski/sworeel
- Licence: MIT
