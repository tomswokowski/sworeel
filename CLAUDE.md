# Working on SwoReel

SwoReel is a Claude Code plugin (`plugin/`: the skill, the in-session pane's hooks, and the `sworeel` command) with an optional desktop viewer (`src/` in Vue, `src-tauri/` in Rust). The README's "Developing" section is the full guide; these are the rules that matter while changing code.

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
claude plugin test ./plugin
claude plugin validate --strict ./plugin
npx tsc -p plugin/tsconfig.json --allowImportingTsExtensions   # the pane's hooks; see below
(cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test)   # only if the app changed
```

The pull request's checks run all of these except the hooks' type check (the `tsc` line). It needs type files that Claude Code writes beside the plugin the first time `npm run dev:claude` runs here, so it can only be run on a computer that has done that; run it whenever `plugin/hooks/` changes.

## Changes and releases

- Every change goes through a branch and a pull request; `main` is protected. Pull requests are squashed, so the title needs a prefix: `fix:`, `feat:`, `docs:`, `ci:`, `chore:`, `test:` or `refactor:`. It decides the next version and the changelog.
- Merging to `main` releases nothing. A release is made by merging the open "chore(main): release …" pull request, and only when the person asks. The workflow does the rest: pre-release, installers, publish, then the `stable` tag. Never move `stable` by hand unless a release workflow failed partway and the person asks.
- The Windows app is signed as Desoto Labs LLC with Azure Artifact Signing. A release whose Windows build is not signed is a failed release: do not ship one unsigned to work around a signing problem.

## Keeping the plugin acceptable to Anthropic's plugin directory

The directory follows the `stable` tag and scans every release (see the README's section on it). A version that fails the scan does not go live. When changing anything under `plugin/`:

- **Describe behaviour in `plugin/README.md`.** Anything new the plugin runs, reads, writes, fetches or sends, and anything new a hook does or changes, goes in its README in the same change. The scan checks the plugin against that README.
- **Keep the pane free of file reads.** It gets reels through the `sworeel` command (`sworeel show --json`), not `$.fs`, and makes no network calls.
- **Read environment variables by name** (`process.env.PATH`), never the whole environment, and never hand the whole environment to a child process.
- **No inline code in launchers or commands** (`node -e`, `python -c`): put it in a file and run the file.
- **Avoid names that look like credentials** next to web addresses (`key`, `token`, `secret`, `password`).
- **Only source belongs in `plugin/`.** Tests go in `tests/`. Generated data must stay readable, with short lines, as `scripts/build-land.mjs` writes it.
- **Keep the `types` field in `plugin.json`.** The directory warns that it does not know it, but `claude plugin validate` fails without it.
- **Dependencies come from the public npm registry**, pinned by `plugin/package-lock.json`. Add one only when it is needed, and name it in the plugin README.

## Conventions

- Every action in the desktop app also exists as a `sworeel` command and is covered by the skill; add them together.
- A reel kind is one file in `plugin/core/kinds/` with a reference in `plugin/skills/reel/kinds/`. `plugin/core/` loads in the pane too, where npm packages cannot, so anything needing a package goes in `plugin/host/`.
- It must work on Linux, macOS and Windows: no shell-only scripts, and no assumed paths (`sworeel paths` knows them).
