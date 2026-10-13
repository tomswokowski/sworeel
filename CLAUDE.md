# Working on SwoReel

SwoReel is a Claude Code plugin (`plugin/`: the skill, the in-session pane's hooks, and the `sworeel` command) with an optional desktop viewer (`src/` in Vue, `src-tauri/` in Rust). The README's "Developing" section is the full guide; these are the rules that matter while changing code.

## Keep development apart from the installed SwoReel

The person working here usually also has SwoReel installed and in daily use on the same computer. Never touch that copy, its reels or its settings.

- Run the command as `npm run sworeel -- <args>`, never as plain `sworeel`, which is the installed release.
- Try the plugin with `npm run dev:claude`, and the app with `npm run dev:app`. All three use the sandbox `.dev-home/`.
- For anything else that writes (a test, a script, a subagent), set `SWOREEL_HOME` to a scratch folder. Never run `sworeel config <name> <value>` without it.
- Do not install, link or enable anything in `~/.claude` to develop, and do not edit files under `~/.claude/plugins`.

## Checks before a pull request

```bash
npm run type-check
npm test
claude plugin test ./plugin
claude plugin validate ./plugin
(cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test)   # only if the app changed
```

## Changes and releases

- Every change goes through a branch and a pull request; `main` is protected. Pull requests are squashed, so the title needs a prefix: `fix:`, `feat:`, `docs:`, `ci:`, `chore:`, `test:` or `refactor:`. It decides the next version and the changelog.
- Merging to `main` releases nothing. A release is made by merging the open "chore(main): release …" pull request, and only when the person asks.

## Conventions

- Every action in the desktop app also exists as a `sworeel` command and is covered by the skill; add them together.
- A reel kind is one file in `plugin/core/kinds/` with a reference in `plugin/skills/reel/kinds/`. `plugin/core/` loads in the pane too, where npm packages cannot, so anything needing a package goes in `plugin/host/`.
- It must work on Linux, macOS and Windows: no shell-only scripts, and no assumed paths (`sworeel paths` knows them).
