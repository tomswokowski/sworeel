# SwoReel

**[sworeel.com](https://sworeel.com)**

Short animated explanations, made by talking to Claude. Ask for a system diagram, a chart, a code walkthrough, some maths, a map or an annotated screenshot; Claude writes it as a *reel*, plays it for you in the chat, and exports it as a video or images that are easy to share anywhere: in a post, a doc, a slide or a message.

A *reel* is a JSON file: a picture that changes step by step, with a caption for each step. You describe what you want explained; Claude writes the reel, checks its own render, and hands you an MP4 or PNG. Nothing is drawn by hand.

| Kind | Draws | For |
|---|---|---|
| `flow` | Boxes with messages travelling between them | System layouts, request flows, state machines |
| `sequence` | Actors with arrows between them, building downwards | Protocols and handshakes |
| `tree` | A hierarchy from the root down | Folders, components, org charts |
| `timeline` | Events in order along a line | Histories |
| `gantt` | Tasks as bars on a shared scale | Plans and schedules |
| `chart` | Horizontal bars | Comparing quantities, before and after |
| `line` | One to three lines over the same points | Trends and growth |
| `scatter` | Points placed by two measurements | Relationships and groups |
| `pie` | A ring of shares with a key | Parts of a whole |
| `code` | One or more listings with lines lit up | Code walkthroughs, across files |
| `array` | A row of cells with pointers | Algorithms over a list |
| `math` | Typeset formulas | Derivations and definitions |
| `map` | Places on a world map, with arcs between them | Where things are, how far requests travel |
| `picture` | One or more images with parts picked out in turn | Walking through screenshots and user flows |
| `screen` | A wireframe in a browser or phone frame | Explaining an interface design |
| `sketch` | Shapes, icons and arrows placed freely | Anything else |

## Install the Claude Code plugin

```
/plugin marketplace add tomswokowski/sworeel
/plugin install sworeel@tomswokowski
```

Then ask Claude for one: "make a reel of how a request reaches the database", "chart these numbers", or "walk through this file".

### In the session

`/sworeel` opens a pane beside the chat with your reels; pick one and it plays, animated, without leaving Claude Code. `/sworeel <reel>` plays one directly.

| Type | Does |
|---|---|
| `/sworeel` | Reel picker |
| `/sworeel pause`, `play`, `next`, `back`, `restart` | Drive the player from the chat |
| `/sworeel export wide`, `tall`, `square`, `still` | Export what's playing |
| `/sworeel app` | Open what's playing in the desktop app |
| `/sworeel keys` | Give the pane the keyboard, for its hotkeys; `Esc` gives it back |
| `/sworeel close` | Close the pane |

Or just ask: "show me the cors one", "pause that", "export it as a tall video". A banner in the pane always says whether your keys are going to the pane or to the chat.

Requirements: Node.js 22.18 or newer. The first run of the `sworeel` command installs its npm dependencies, which include an ffmpeg for making video; your own is used if you have one. Developed and tested on Linux only so far.

## Install the desktop app (optional)

The app is a window onto your reels: browse, play, organise and export them. Download the installer for your system from the [Releases page](https://github.com/tomswokowski/sworeel/releases).

It needs the plugin above, because it runs the plugin's `sworeel` command for every change and export. Without the plugin the app opens but tells you it can't find the command.

There is one installer for each system that has an app, and each keeps itself up to date:

- **Linux:** an `.AppImage`, for 64-bit Intel and AMD computers. This is the only system the app has been used on by hand so far.
- **macOS:** a `.dmg`, for Apple silicon and Intel Macs.
- **Windows:** a setup `.exe`, signed by Desoto Labs LLC.

The automated tests install and start the app on all three.

## Where files live

Reels are SwoReel's working files, so they live with the app's data. Exports are what you publish, so they go in Documents.

| | Linux | macOS | Windows |
|---|---|---|---|
| Reels | `~/.local/share/sworeel/reels` | `~/Library/Application Support/SwoReel/reels` | `%APPDATA%\SwoReel\reels` |
| Settings | `~/.config/sworeel/config.json` | `~/Library/Application Support/SwoReel/config.json` | `%APPDATA%\SwoReel\config.json` |
| Exports | `Documents/SwoReel` | `Documents/SwoReel` | `Documents\SwoReel` |

Two more things sit beside these:

- **Pictures.** Images that picture reels use are kept in an `assets` folder next to the reels folder, never inside it, so renaming or moving a reel can't break its pictures.
- **Preferences.** `style.md`, next to `config.json`, holds your standing preferences for how reels are made. Claude reads it before making one.

`sworeel paths` prints the locations in use. To change one, run `sworeel config exports <folder>` or `sworeel config reels <folder>`; changing the reels folder copies the library and its pictures there and leaves the originals in place.

Setting `SWOREEL_HOME` to a folder puts everything in it: `reels/`, `assets/`, `exports/`, and its own `config.json` and `style.md`. Nothing outside that folder is read or written, which is what tests and try-outs want.

### Moving reels to another computer

`sworeel bundle <reel|folder>` (or "Export as File" in the app) packs reels and the pictures they use into one `.sworeel` file. `sworeel import <file>` (or the app's Import) adds them on the other computer. Importing never replaces anything already there. Settings and exported videos are not part of a bundle.

## Command line

The plugin puts `sworeel` on Claude's PATH. It also works on its own:

```bash
sworeel list                                   # what's in the library
sworeel still front-door --format tall --step 5
sworeel render web/cors --format tall

sworeel show front-door                        # the reel as text, right in the terminal
sworeel play                                   # pick a reel and watch it, animated
sworeel app front-door                         # show it in the desktop app

sworeel stills front-door                      # every step as an image
sworeel config watermark "@you"                # credit every export
sworeel config formats wide,tall               # what a plain "render" makes

sworeel move front-door web                    # organise: move, rename, duplicate, delete, folders
sworeel delete old-draft                       # goes to the system trash
sworeel exports                                # what has been exported
sworeel --help                                 # everything else
```

Everything the desktop app can do to the library, the command can do too, so Claude can manage it for you: "put the auth reels in a folder", "delete the old draft", "re-export everything as tall videos".

Formats are `wide` (1600×900), `tall` (1080×1920) and `square` (1080×1080).

## Repository layout

| Path | What it is |
|---|---|
| `.claude-plugin/marketplace.json` | The marketplace listing: tells Claude Code this repository offers the SwoReel plugin, and where in it the plugin is |
| `plugin/.claude-plugin/plugin.json` | The plugin's own manifest: its name, version and description |
| `plugin/` | The plugin, and everything it needs to run |
| `plugin/hooks/` | The in-session pane and `/sworeel` command: a Claude Code hooks module |
| `plugin/skills/reel/` | The skill: how to choose a kind, write a reel that reads well, and manage the library. `kinds/` has the reference for each kind |
| `plugin/bin/sworeel` | The command (`sworeel.cmd` on Windows). Installs dependencies on first run, then runs the CLI |
| `plugin/cli/` | Validates reels and renders PNG stills and MP4 video, with no browser involved |
| `plugin/core/` | The reel format and timing, shared by everything. `kinds/` has one file per kind of reel, each with a picture renderer (Canvas 2D), a text renderer, and its step descriptions |
| `plugin/core/data/` | Generated data: the bundled icons (from Lucide, ISC) and the world's land outline (Natural Earth, public domain). `scripts/` regenerates both |
| `plugin/host/` | What needs real packages: the maths typesetter (MathJax). Used by the command and the app, never by the core, which also runs inside Claude Code where packages can't load |
| `src/`, `src-tauri/` | The optional desktop app (Vue inside a Tauri window): a reel library with folders, search, rename, move and delete, plus playback and export. It shares `plugin/core/` |
| `site/` | The landing page, one static HTML file and its images, published to [sworeel.com](https://sworeel.com) through GitHub Pages by `.github/workflows/pages.yml`. Its download buttons look up the latest release, so it needs no edit when a version ships |
| `brand/` | The icon and logo as SVG, with PNG renders. `icon-macos` is the same mark with the margin macOS expects |

## The desktop app and Claude Code together

They share one library and one renderer, and neither needs the other, but they hand off to each other:

- **From the chat to the app:** `sworeel app <reel>`, `/sworeel app`, or the pane's "Open in app" button shows that reel in the app, starting it if needed.
- **Follow Claude:** a switch in the app's sidebar. When on, the app shows whichever reel changed last, so you watch the real render update as Claude edits.
- **From the app to the chat:** "Ask Claude…" on a reel copies the start of a message naming it, ready to paste into Claude Code.
- **Shared settings:** the watermark, step dots, default formats and frame rate set in the app's Settings are used by Claude's exports too, and the other way round. Colours are set by asking Claude (`sworeel config theme`), and the app's previews follow.

The app's sidebar is a file explorer: folders open and close, reels sit under them, and reels and whole folders are moved by dragging them onto a folder. Right-click for rename, duplicate and delete. The player has a scrubber with a mark at each step, and an Export menu for a video, a still, all stills, or the reel itself as a file for another computer.

## App icons

`src-tauri/icons/` holds the icons for each platform, generated from `brand/`:

```bash
npx tauri icon brand/icon.png                          # Windows .ico and the Linux PNGs
npx tauri icon brand/icon-macos.png -o /tmp/mac-icons  # then copy its icon.icns into src-tauri/icons/
```

## Developing

Working on SwoReel is kept apart from using it. A computer can have SwoReel installed and in daily use while its code is being changed in this folder, and neither touches the other:

| | The SwoReel you use | The SwoReel you are changing |
|---|---|---|
| Start Claude Code with | `claude` | `npm run dev:claude` |
| Plugin | The installed release | This folder's `plugin/`, for that session only |
| Reels, settings, exports | Your own | A sandbox, `.dev-home/` in this folder |
| Desktop app | SwoReel | "SwoReel Dev", from `npm run dev:app` |

Nothing is installed, linked or changed in your Claude Code settings to develop. Closing the development session is all it takes to be back on the release. This is the same on Linux, macOS and Windows.

### Setting up

You need Node.js 22.18 or newer and Claude Code. The desktop app also needs [Rust and Tauri's system packages](https://tauri.app/start/prerequisites/); skip them if you are only working on the plugin.

```bash
git clone https://github.com/tomswokowski/sworeel && cd sworeel
npm install                          # the desktop app's and the tests' dependencies
(cd plugin && npm install)           # the command's own
npm run dev:claude                   # Claude Code with this folder's plugin, in the sandbox
```

### The plugin

`npm run dev:claude` starts Claude Code with this folder's skill, in-session pane and `sworeel` command in place of an installed SwoReel's, reading and writing only the sandbox. From another folder, run `node <this folder>/scripts/dev.mjs claude`. Anything after the command is passed to `claude`.

There is nothing to build. An edit to the command or a reel kind is used the next time the command runs, an edit to the pane's hooks reloads when the file is saved, and an edit to the skill is read the next time Claude loads it (a new session is the sure way).

```bash
npm run sworeel -- list              # the command from this folder, in the sandbox
npm test                             # test the reel kinds, the library, bundles and themes
claude plugin test ./plugin          # test the in-session pane
claude plugin validate ./plugin      # check the plugin manifest
```

The sandbox starts with a few sample reels. Delete `.dev-home/` to start it afresh; it is never committed.

### The desktop app

```bash
npm run dev                          # the interface in a browser, against a mock library
npm run dev:app                      # the app from this folder with live reload, in the sandbox
(cd src-tauri && cargo test)         # test the app's reading of the library
npx tauri build --no-bundle          # build it to src-tauri/target/release/sworeel-app
```

`npm run dev:app` runs as "SwoReel Dev", with its own window, remembered state and name, and it runs this folder's command, so it can sit beside an installed SwoReel.

When you build the app yourself, put the built `sworeel-app` on your PATH (or tell the command where it is with `sworeel config app <path>`) so that `sworeel app` can start it. An installed package does this for you.

### Everything at once

To work with the plugin and the app together, run each in its own terminal, in this folder:

```bash
npm run dev:claude                   # terminal 1: Claude Code with this folder's plugin
npm run dev:app                      # terminal 2: the app, as "SwoReel Dev"
```

Both use the sandbox, so they see the same reels and settings: a reel Claude writes appears in the app, "show it in the app" in the session opens it in SwoReel Dev, and the app's Follow Claude switch follows that session. Start them in either order and stop either one without affecting the other. If the session asks for the app while it is not running, the command says so; it never starts an installed SwoReel.

### From a change to a release

1. Make the change on a branch, and try it with `npm run dev:claude`.
2. Run the tests above, and open a pull request whose title starts with the kind of change (see the table below). The same tests run there on Linux, macOS and Windows.
3. Merge it. `main` is what the next release will be; nobody's installed SwoReel has changed yet.
4. When it should reach people, merge the open "chore(main): release …" pull request (see Releasing).
5. Installed copies then move to it: the desktop app updates itself, and the plugin with `claude plugin marketplace update tomswokowski` followed by `claude plugin update sworeel@tomswokowski`, or by itself where the marketplace is set to update automatically.

### Releasing

Releases are made by merging one pull request. Every push to `main` updates an open pull request titled "chore(main): release …", kept by [release-please](https://github.com/googleapis/release-please), with the next version number and a changelog of what has been merged since the last release. Merging it bumps the version everywhere it is written, tags it, publishes the release notes, and builds the installers for Linux, macOS and Windows onto the release (about ten minutes).

The version and the changelog come from commit messages on `main`, so each starts with the kind of change:

| Prefix | For | Version |
|---|---|---|
| `fix:` | A bug fix | 0.1.0 → 0.1.1 |
| `feat:` | Something new | 0.1.0 → 0.2.0 |
| `docs:`, `ci:`, `chore:`, `test:`, `refactor:` | What users don't see | No release on its own |

Pull requests are squashed, so it is the pull request's title that needs the prefix.

Each release also moves a tag named `stable` to itself. Anything that should follow releases and not `main`, such as a listing in Anthropic's plugin directory, follows that tag.

Installed apps update themselves: soon after starting, the app fetches the newest release in the background and it opens next time (on Windows it is installed as the app closes). Each build is signed for this with a key kept in the repository's secrets, and apps accept only what that key signed; see the top of `.github/workflows/release.yml`.

The macOS build is signed and notarized once the Apple secrets named at the top of `.github/workflows/release.yml` are set in the repository; without them it is unsigned. Running that workflow by hand from the Actions tab builds the installers without releasing, for trying a build.

The app reads the library itself, and runs the `sworeel` command (found on PATH, or at the path in `SWOREEL_CLI`) for every change and export, so the app and Claude follow the same rules. Deleting a reel or folder moves it to the system trash.

When testing, set `SWOREEL_HOME` to a scratch folder so nothing touches your real library or settings.

## Licence

SwoReel is free and open source under the [MIT licence](LICENSE).

It includes or depends on work by others, under their own terms:

- Icons from [Lucide](https://lucide.dev) (ISC), bundled in `plugin/core/data/icons.ts`.
- The world outline from [Natural Earth](https://www.naturalearthdata.com) (public domain), bundled in `plugin/core/data/land.ts`.
- The [Noto Sans](https://fonts.google.com/noto) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) fonts (SIL Open Font License), installed as dependencies.
- [MathJax](https://www.mathjax.org) (Apache 2.0) for typesetting formulas, installed as a dependency.
