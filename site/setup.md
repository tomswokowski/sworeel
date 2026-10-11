# Setting up SwoReel

These are instructions for Claude Code. The person you are working with pasted a request to set
up SwoReel and pointed you here. SwoReel is a plugin for Claude Code that turns explanations
into short animated "reels", plus an optional desktop app for browsing them.

Work through the steps in order. Before you run anything, tell the person in two or three
plain sentences what you are about to do (the list under "What this changes" below), and wait
for them to agree. Run nothing they have not agreed to. If a step fails, say what failed and
what they can do about it; do not work around it with a different method.

## What this changes

Tell the person exactly this, in your own words, before starting:

- You will check for Node.js (22.18 or newer) and ffmpeg, and install whichever is missing
  using their system's own package manager.
- You will add the SwoReel plugin to Claude Code.
- You will ask whether they also want the desktop app, and install it only if they say yes.
- Nothing else on their computer is changed. SwoReel has no account and collects no data.

## 1. Check what is already there

Run `node --version` and `ffmpeg -version`. Node must be 22.18 or newer. Report what you found
in one line each.

## 2. Install what is missing

Only install what step 1 showed to be missing or too old. Use the package manager the system
already has, and tell the person the command before running it:

- macOS: `brew install node ffmpeg`. If Homebrew is not installed, stop and tell them to
  install Node.js from https://nodejs.org and ffmpeg from https://ffmpeg.org, then ask you
  again. Do not install Homebrew for them.
- Windows: `winget install OpenJS.NodeJS` and `winget install Gyan.FFmpeg`.
- Linux: the distribution's own manager, for example `sudo apt install nodejs ffmpeg`,
  `sudo dnf install nodejs ffmpeg` or `sudo pacman -S nodejs ffmpeg`. If the packaged Node.js
  is older than 22.18, say so and point them to https://nodejs.org instead of adding
  third-party repositories yourself.

If Node.js is managed by a version manager (nvm, fnm, mise, volta), use that to get a new
enough version instead of the system package manager. A sign of one is `node` living under
the person's home folder; `command -v node` shows where it is.

A command that needs `sudo` will ask for a password you cannot type. When that happens, give
the person the exact command and ask them to run it themselves by typing `!` followed by the
command in Claude Code, then tell you when it is done.

ffmpeg is only needed for video. If it cannot be installed, carry on and tell the person that
image export works and video export will not until ffmpeg is there.

Check both again afterwards. A terminal sometimes has to be reopened before a new program is
found; if so, say that.

If Node.js still is not 22.18 or newer, carry on with step 3 so the plugin is in place, but
say plainly that SwoReel will not run until Node.js is updated, and repeat that in your
summary at the end.

## 3. Add the plugin

Run these two commands:

```
claude plugin marketplace add tomswokowski/sworeel
claude plugin install sworeel@tomswokowski
```

If the plugin is already installed, run `claude plugin marketplace update tomswokowski` and
`claude plugin update sworeel@tomswokowski` instead, so they have the latest version.

## 4. Offer the desktop app

Ask: "Do you also want the SwoReel desktop app? It is an optional window for browsing, playing
and exporting your reels. Everything also works without it." Install it only if they say yes.

Find the newest files at https://api.github.com/repos/tomswokowski/sworeel/releases/latest and
download the one for their system from its `assets` list:

- macOS: the file ending `.dmg`. Open it, copy `SwoReel.app` into `/Applications`, and eject it.
- Windows: the file ending `-setup.exe`. Run it. Tell them first that Windows may show an
  "unknown publisher" warning because the installer is not signed yet, and that choosing
  "More info" then "Run anyway" continues.
- Linux: the file ending `.AppImage`. Save it as `~/.local/bin/sworeel-app` and make it
  executable with `chmod +x`. That is the name and place the `sworeel app` command looks for.
  It is built for 64-bit Intel and AMD computers (`uname -m` prints `x86_64`); on anything
  else, say the desktop app is not available for their computer yet and skip it.

## 5. Finish

Tell the person:

- What you installed, and anything you skipped and why.
- That they need to restart Claude Code once, so it loads the plugin.
- What to try after restarting: ask for a reel, such as "make a reel of how a request reaches
  the database", or type `/sworeel` to browse the ones they have.
