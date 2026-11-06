# Working on SwoReel

SwoReel is a Claude Code plugin (`plugin/`: the skill and the `sworeel` command) with an optional desktop viewer (`src/` in Vue, `src-tauri/` in Rust). The README's "Developing" section is the full guide; these are the rules that matter while changing code.

## Keep development apart from the installed SwoReel

The person working here usually also has SwoReel installed and in daily use on the same computer. Never touch that copy, its reels or its settings.

- Run the command as `npm run sworeel -- <args>`, never as plain `sworeel`, which is the installed release.
- Try the plugin with `npm run dev:claude`, and the app with `npm run dev:app`. All three use the sandbox `.dev-home/`.
- To see a change in the desktop app, run `npm run dev:app` in the background (it stays running, with live reload) and hand it a reel with `npm run sworeel -- app <reel>`. Never start the installed `sworeel-app` to test.
- For anything else that writes (a test, a script, a subagent), set `SWOREEL_HOME` to a scratch folder. Never run `sworeel config <name> <value>` without it.
- Do not install, link or enable anything in `~/.claude` to develop, and do not edit files under `~/.claude/plugins`.

## Checks before a pull request

```bash
npm run type-check
npm test
claude plugin validate --strict ./plugin
(cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test)   # only if the app changed
```

The pull request's checks run all of these.

## Changes and releases

- Every change goes through a branch and a pull request; `main` is protected. Pull requests are squashed, so the title needs a prefix: `fix:`, `feat:`, `docs:`, `ci:`, `chore:`, `test:` or `refactor:`. It decides the next version and the changelog.
- Merging to `main` releases nothing. A release is made by merging the open "chore(main): release …" pull request, and only when the person asks. The workflow does the rest: pre-release, installers, publish, then the `stable` tag. Never move `stable` by hand unless a release workflow failed partway and the person asks.
- The Windows app is signed as Desoto Labs LLC with Azure Artifact Signing. A release whose Windows build is not signed is a failed release: do not ship one unsigned to work around a signing problem.

## Keeping the plugin easy to trust

People install the plugin and let Claude run its command, so it should be plain what it does. When changing anything under `plugin/`:

- **Describe behaviour in `plugin/README.md`.** Anything new the plugin runs, reads, writes, fetches or sends goes in its README in the same change.
- **No hooks without asking.** The plugin has none: the in-session pane (a hooks module) was removed in 1.0.0. Adding hooks back is the person's decision, not a side effect of another change.
- **Read environment variables by name** (`process.env.PATH`), never the whole environment, and never hand the whole environment to a child process.
- **No inline code in launchers or commands** (`node -e`, `python -c`): put it in a file and run the file.
- **Avoid names that look like credentials** next to web addresses (`key`, `token`, `secret`, `password`).
- **Only source belongs in `plugin/`.** Tests go in `tests/`. Generated data must stay readable, with short lines, as `scripts/build-land.mjs` writes it.
- **Dependencies come from the public npm registry**, pinned by `plugin/package-lock.json`. Add one only when it is needed, and name it in the plugin README.

## Conventions

- Every action in the desktop app also exists as a `sworeel` command and is covered by the skill; add them together.
- A reel kind is one file in `plugin/core/kinds/` with a reference in `plugin/skills/reel/kinds/`. `plugin/core/` stays free of npm packages, so anything needing one goes in `plugin/host/`.
- It must work on Linux, macOS and Windows: no shell-only scripts, and no assumed paths (`sworeel paths` knows them).

## Decisions, and why

Settled choices, so that nobody undoes one by accident. Change one only when the person asks, and then update it here.

- **Claude makes the reels; people never draw.** SwoReel is for people who talk to Claude, not for editing diagrams by hand. Everything is reachable by asking; the desktop app is a window onto the library, never the only way to do something.
- **"Reel" is the word.** The things SwoReel makes are reels, and the parts of one are steps. The name is SwoReel (from Swokowski); the command, folders and package are lowercase `sworeel`.
- **Where files live.** Reels are working files, so they sit in the system's app-data folder; only exports go in `Documents/SwoReel`. Pictures (`assets`) and chat previews (`previews`) sit beside the reels folder, never inside it.
- **Reels only when asked.** Every reel lands in the library, so Claude makes one only when someone asks for a reel, and asks first when "visualize this" could mean a chart in their code. Nothing in the plugin prompts Claude to offer reels.
- **No hooks, no in-session pane (1.0.0).** The pane was a hooks module. It was removed when Anthropic's plugin directory refused mods, and kept out afterwards: a plugin that runs nothing until Claude calls its command is simpler to trust. A preview link (`sworeel preview`) shows the real look from the chat instead. If in-chat playback is wanted again, it belongs in a separate, optional plugin, so this one stays hook-free.
- **Not in Anthropic's plugin directory.** From organizations that are not Verified it takes only Markdown, text, JSON, YAML and image plugins. SwoReel is installed from this repository's own marketplace, through sworeel.com's setup line or `/plugin marketplace add tomswokowski/sworeel`.
- **Build what a kind can't draw, rather than decline.** Sixteen kinds came from adding what explanations needed; `sketch` is the last resort, not a substitute for a missing kind.
- **Free and open source, with nothing to sign up for.** MIT licence, no account, no server, no data collected. Releases are signed: the Windows app as Desoto Labs LLC, and every build with the updater key.
- **Releases are staged.** Each release is a pre-release until all its installers are attached, then published, then `stable` moves. Installer file names carry no version, so links and in-place updates keep working.
- **The same development setup on every machine.** Development uses only the repository's own commands and its `.dev-home/` sandbox. Do not add machine-local wrappers or anything installed into `~/.claude`.
