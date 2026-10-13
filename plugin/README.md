# SwoReel

SwoReel is a Claude Code plugin that turns an explanation into a short animated "reel": a picture that builds up step by step, with a one-sentence caption for each step. Claude writes the reel; you watch it, change it by asking, and export it as an MP4 video or PNG images in wide, tall or square shapes.

Ask for one in plain words:

- "Make a reel of how a request reaches the database."
- "Walk through this function as a reel."
- "Make a reel of this post" with a link, a document, a ticket or a repository.

There are sixteen kinds of reel: system and request flows, sequences, trees and file structures, timelines, Gantt plans, bar, line, scatter and pie charts, code walkthroughs, array and algorithm steps, maths, maps, annotated screenshots, UI mock-ups and free sketches.

## What is in the plugin

- **A skill**, `sworeel:reel`, that teaches Claude to write, check, show and manage reels.
- **A command**, `sworeel`, in `bin/`, that validates reels and renders them. Claude runs it; you do not have to.
- **A pane**, opened with `/sworeel` or by Claude, that plays a reel beside the chat.

## What it needs

- Node.js 22.18 or newer.
- `ffmpeg`, for video. Images work without it.

## What it runs, reads, writes and fetches

Everything happens on your computer. SwoReel has no account and no server, and collects no data.

- **Runs:** the `sworeel` command, which is TypeScript in this folder run by Node.js, and `ffmpeg` when a video is rendered. `sworeel open` and `sworeel app` start your system's default application for a file, or the optional SwoReel desktop app if you installed it.
- **Reads and writes:** your reels and the pictures they use (in your system's application-data folder), your settings (in its configuration folder) and your exports (in `Documents/SwoReel`). `sworeel paths` prints the exact locations, and each can be moved. Deleting a reel moves it to the system trash.
- **Fetches:** its four npm dependencies, once, when the plugin is installed or the command first runs: `@napi-rs/canvas` (drawing, with a prebuilt binary for your system), `mathjax-full` (typesetting formulas) and two `@fontsource` font packages. Versions are fixed by `package-lock.json`. After that the plugin makes no network requests.
- **Tells Claude:** a short note, added to Claude's instructions in each session, that it may end an explanation with a one-line offer to show it as a reel. `sworeel config suggest off` turns that off.

When you ask for a reel of a web page, it is Claude Code that opens the page, with its own tools and permissions; the plugin does not.

## More

- Website and setup: https://sworeel.com
- Source, issues and the optional desktop app: https://github.com/tomswokowski/sworeel
- Licence: MIT
