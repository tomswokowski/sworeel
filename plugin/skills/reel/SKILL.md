---
name: reel
description: >
  SwoReel: short animated explanations ("reels") that Claude writes and the user shares, exported
  as MP4 video or PNG stills in wide, tall and square shapes, to put anywhere: a post, a doc, a
  slide, a message. Sixteen kinds: system and
  request-flow diagrams, sequences, trees and file structures, timelines, Gantt plans, bar, line,
  scatter and pie charts, code walkthroughs, array and algorithm steps, maths, maps, annotated
  screenshots, UI mock-ups and free sketches. Use for three kinds of request. (1) Making or
  changing a reel: the user asks to diagram, chart, visualize, illustrate, animate or walk
  through how something works, to turn an explanation, some code or some screenshots into
  something they can share, or to change a reel they are looking at ("make this step shorter").
  (2) Making reels look their way: brand colours, a light or dark look for all reels or one,
  the watermark, or a lasting preference for how their reels are made. (3) Managing SwoReel:
  anything about the user's library, reels, folders or exports, such as listing, finding,
  renaming, moving, organising, duplicating, deleting or re-exporting reels, moving reels to
  another computer, or changing a setting. Never ask the user where SwoReel's files are; this
  skill's `sworeel` command knows.
  Triggers: SwoReel, sworeel, reel, make a reel, my reels, my exports, diagram this, chart
  this, visualize, animate, code walkthrough, annotate this screenshot, show the flow of calls,
  something to share or post, a video or image of this, match my brand.
---

# SwoReel

SwoReel turns a small JSON file (a *reel*) into an animated explanation: a picture that changes
step by step, with one sentence of caption per step. You write the reel and render it; the
user publishes the video or image. The user does not draw or edit anything by hand, so the
reel you write is the finished product.

A reel has a **kind**, which decides what the picture is:

| Kind | Draws | Use it for |
|---|---|---|
| `flow` | Boxes on a grid, with messages travelling between them | How a system is laid out and who talks to whom: request flows, startup, failure paths, state machines |
| `sequence` | Actors side by side, with arrows between them building downwards | The order of a conversation: protocols, handshakes, a request through several hops |
| `tree` | A hierarchy from the root down | A project's file structure, components, org charts, call trees |
| `timeline` | Events in order along a line | Histories, the stages of an incident |
| `gantt` | Tasks as bars on a shared scale | Plans and schedules, what overlaps, where time goes |
| `chart` | Horizontal bars | Comparing a few quantities, before and after a change |
| `line` | One to three lines over the same points | Trends and growth |
| `scatter` | Points placed by two measurements | How one thing varies with another, how groups separate |
| `pie` | A ring of shares with a key | Parts of a whole |
| `code` | One or more listings with lines lit up | Walking through code or config, in one file or following a path across several |
| `array` | A row of cells with pointers | Algorithms over a list: searching, sorting, two pointers |
| `math` | Typeset formulas, one under another | Derivations and definitions |
| `map` | Places on a world map, with arcs between them | Where things are, and how far a request travels |
| `picture` | One or more images with parts picked out in turn | Walking through screenshots: a real page, or a user flow across several |
| `screen` | A wireframe in a browser or phone frame | Explaining an interface design and how it responds |
| `sketch` | Shapes, icons and arrows placed freely | Whatever the others can't draw; the last resort |

Pick the kind that matches what the explanation is *about*, then read `kinds/<kind>.md` beside
this file before writing. If no kind fits, say so and offer a table or a paragraph instead of
forcing one (see "What SwoReel cannot draw").

- The `sworeel` command comes with this plugin and is on PATH. Its first run installs its
  dependencies, which takes a few seconds. It needs Node.js 22.18 or newer, and `ffmpeg` for
  video.
- Reels are JSON files in SwoReel's library folder, and renders go to its exports folder.
  Both differ by operating system and can be changed, so run `sworeel paths` to find them;
  never assume a location. `sworeel list` shows the reels already there.
- The library can have folders. A reel's name includes its folder: `web/cors` is the file
  `web/cors.json` inside the library. Put related reels in a folder together.
- Some users also run the SwoReel desktop app (see "Working with the desktop app"). Do not
  assume it is installed, and do not delete or move the user's reels unless asked.

## Workflow

1. Run `sworeel style` and follow what it prints: these are the user's standing preferences
   for how their reels are made. Then decide the one idea the reel should leave the viewer
   with, and which kind suits it.
2. Write `<reels folder>/<kebab-case-name>.json`, in a subfolder if the user keeps related
   reels together.
3. `sworeel validate <name>` and fix anything it reports.
4. Look at your own work before showing it: render stills of two or three steps and Read the
   PNGs. Always check the `tall` format, since it is the tightest.
   `sworeel still <name> --format tall --step 3 --out <scratch>/check.png`
5. Fix overlaps, clipped text and awkward wording.
6. Give the user something to look at. Play it in the pane, or paste the text version (see
   "Showing a reel in the chat"), so they see it at once. Render the video only if they
   asked for one, and tell them the path the command printed.
7. Render video when the user asks for it, or asks for something to post:
   `sworeel render <name> --format tall`.

`<name>` is the reel's name in the library (`front-door`, `web/cors`), or a path to any
`.json` file.

## Commands

`<reel>` is a reel's name in the library, including its folder (`front-door`, `web/cors`).
`validate`, `info`, `still`, `stills`, `render`, `show` and `play` also accept a path to any
`.json` file. Put `--` before text that starts with a dash (`sworeel config watermark -- -tom`).

```
# Make
sworeel validate <reel>
sworeel info <reel>                                    # steps, timings, total length
sworeel still <reel> [--format F] [--step N] [--out file.png]
sworeel stills <reel> [--format F]                     # every step as an image, in a folder
sworeel render <reel> [--format F] [--fps N] [--out file.mp4]
sworeel asset add <image> [name]                       # store an image for a picture reel; prints its name
sworeel asset list                                     # the pictures in the store

# Watch
sworeel show <reel> [--step N]                         # the reel and its steps as plain text
sworeel play [reel]                                    # animated; needs a real terminal; no reel = picker
sworeel app [reel]                                     # show a reel in the desktop app
sworeel showing [--json]                               # which reel and step the app is on

# Organise
sworeel list [--json]                                  # reels in the library, with titles
sworeel rename <reel> <new-name>
sworeel move <reel> <folder>                           # "." is the top level; creates the folder
sworeel duplicate <reel> [new-name]
sworeel delete <reel>...                               # to the system trash
sworeel folder create|rename|delete <folder> [new-name]
sworeel folder move <folder> <into>                    # "." is the top level

# Move between computers
sworeel bundle <reel|folder>... [--out F.sworeel]      # one file holding reels and their pictures
sworeel import <file.sworeel> [--into folder]          # add a bundle's reels to the library

# Look around
sworeel icons                                          # the icons a reel can use
sworeel exports [--json]                               # exported files, newest first
sworeel open <reels|exports|file>                      # show a folder or file to the user
sworeel paths [--json]                                 # where reels, pictures, exports and settings live

# Settings
sworeel config                                         # print the settings
sworeel config watermark [text]                        # credit on every export; no text removes it
sworeel config progress <on|off>                       # step dots on every export; off by default
sworeel config formats <list>                          # default video formats, e.g. wide,tall
sworeel config fps <N>                                 # frames per second for video
sworeel config theme [colour #hex|reset]               # the colours every reel is drawn in
sworeel config exports <folder>                        # keep exports somewhere else
sworeel config reels <folder>                          # keep reels somewhere else (see below)
sworeel config app <path>                              # where the desktop app is, if `sworeel app` can't find it
sworeel style [add "…" | remove N]                     # the user's standing preferences for reels
```

Formats: `wide` (1600×900, for slides, docs and landscape video), `tall` (1080×1920, for
phones and vertical video), `square` (1080×1080, for feeds). Steps are counted from 1. For `still`, `--step 0` is the reel before any step and
the default is the last step; `show --step` takes 1 upwards and, left out, shows the whole reel.

Exports are named after the reel, with its folders: `web/cors` exports as
`web-cors-wide.mp4`, `web-cors-wide-step3.png` and a `web-cors-wide-stills` folder.

`sworeel render <reel>` with no `--format` renders each of the user's default formats, which
is usually what "export it" means; name a format only when they ask for one. `sworeel stills`
suits a carousel post or slides: one image per step.

`sworeel config reels <folder>` copies the library and its pictures to the new folder and
switches to it. The originals stay where they were; tell the user so, and that they can delete
them once they are happy. The picture store always sits beside the reels folder.

## Showing a reel in the chat

When the user wants to see a reel without leaving the conversation ("show me", "play it",
"what does it look like", "walk me through it"), there are two ways, best first:

1. **The SwoReel pane.** This plugin gives you a `play` tool (listed as `mcp__sworeel__play`).
   Call it with `reel` set to a reel's name and the reel plays, animated, in a pane beside
   the chat. Pass a whole reel object instead to show one you have not saved. Pass `control`
   (`pause`, `play`, `next`, `back`, `restart`, `status`, `reload`, `library`, `app`, `keys`,
   `close`) to drive what
   is showing, so "pause that" or "go back a step" are things you do, not things you explain.
   `step` with `reel` opens it paused at that step; `control: "status"` reports what is showing
   and `control: "reload"` re-reads its file (see "Changing a reel together").
   The user has the same controls as `/sworeel <reel>`, `/sworeel pause` and so on, and
   `/sworeel` alone opens a reel picker.
2. **Plain text.** Where the `play` tool is not available, run `sworeel show <reel>` and paste
   its output into your reply inside a fenced code block. The user does not see command output
   unless you include it, and it only lines up in a monospace block. Paste it exactly; do not
   redraw or tidy it. `sworeel show <reel> --step N` shows one moment of the flow, with that
   step's message drawn in heavy lines.

After writing a new reel, showing it one of these ways is a good default: the user sees the
result immediately and can ask for changes before any video is rendered.

Both show structure and order, not the finished look. Check stills as well before calling a
reel done. `sworeel play` is the same animation for a terminal of the user's own; you cannot
watch it yourself.

## Changing a reel together

Making a reel is rarely one request. The user watches it and says what they want different:
"make that caption shorter", "add a step where the cache answers", "the database should be
on the left", "can this one be a sequence instead?". Treat each as a small edit to the reel
that exists, made at once, shown at once.

1. **Know which reel and step they mean.** If they don't name it, find out what they are
   looking at before changing anything: call the `play` tool with `control: "status"` for the
   pane, or run `sworeel showing` for the desktop app. "This", "that step" and "the last one"
   refer to what those report. If neither is showing a reel, ask which one.
2. **Change only what was asked.** Edit the reel file in place. Leave the other steps, the
   layout and the wording alone, even where you would have written them differently. The user
   has already seen and accepted them.
3. **Validate**, as always: `sworeel validate <name>`.
4. **Show the change where it happened.** Call `play` with the reel and `step` set to the step
   you changed, which opens it paused there; or `control: "reload"` if that reel is already
   showing, which keeps its place. The desktop app needs nothing: it reloads the file itself.
   Without the pane, paste `sworeel show <name> --step N`.
5. **Say what changed in one line**, naming the reel and step ("Shortened step 3's caption in
   web/cors"), so a wrong guess about what they meant is obvious and cheap to correct. Do not
   re-describe the whole reel.

Keep going like this for as long as they have changes. Along the way:

- **Steps are numbered from 1** in the pane, the app and `sworeel info`, so "step 4" means the
  same thing to everyone.
- **Do not re-render video after each change.** Stills and the pane are for the back-and-forth;
  render once they say it is right, or ask for the video.
- **For "undo that", put back what was there.** Keep track of what you changed in this
  conversation. You cannot undo changes from an earlier session; say so if asked.
- **A request that changes what the reel is about**, or to turn it into a different kind, is a
  rewrite. Say you are rewriting it, and offer to keep the original under another name with
  `sworeel duplicate` first.
- **If a request can't be done in this kind** (an arrow on a chart, a third column of text),
  say what the kind can do instead; don't quietly do something else.

## Working with the desktop app

Some users also have the SwoReel desktop app, for a full-quality preview, organising and
exporting. It shares the library, so nothing needs syncing.

- `sworeel app <reel>` shows a reel in the app, starting the app if it is closed. Use it when
  the user wants to see the real render, not the text version. It fails with a clear message
  where the app is not installed; then render a still and `sworeel open` it instead.
- The app has a "Follow Claude" switch. With it on, the app shows whichever reel changed most
  recently, so the user watches your edits arrive. You do nothing different.
- A message that starts `In my SwoReel reel "web/cors" (titled "…"),` was copied from the
  app's "Ask Claude…" button. The quoted name is the reel to work on.

## Settings

`sworeel config` prints the settings, which the command, the pane and the desktop app all
share. Change one when the user asks for it:

- `sworeel config watermark "@handle"` adds a small credit to the corner of every video and
  still; with no text it removes it.
- `sworeel config progress on` adds a row of step dots to the bottom of every video and image,
  showing how far along it is (a bar past 30 steps). They are off unless the user asks; `off`
  removes them again.
- `sworeel config formats wide,tall` sets which formats a plain `sworeel render` makes.
- `sworeel config fps 60` sets the frame rate for video (30 unless changed).

## Making reels look the way the user wants

Everything about how a reel looks or reads can be changed by asking you. There is nothing for
the user to configure by hand, and the defaults are meant to be good enough to post as they
are. Three things carry a user's taste, from widest to narrowest:

- **Their colours, for every reel.** `sworeel config theme` lists the ten colours reels are
  drawn in: `background`, `surface` (boxes and panels), `border`, `text`, `muted` (secondary
  text), `primary` (the main accent), `secondary`, `warning`, `success` and `error`. Change one
  with `sworeel config theme primary "#ff6600"`; put one back with `reset` in place of the
  colour, or all of them with `sworeel config theme reset`. Use this for "make them match my
  brand" or "I want a light background". Colours are hex only, so turn "navy" or a brand name
  into a hex value yourself, and say which you chose.
- **One reel's colours.** A reel can carry its own `"theme": { "primary": "#ff6600" }` beside
  its `title`, with any of the same ten names. It goes on top of the user's theme. Use it when
  they want one reel to look different, not to restate their usual colours.
- **Their standing preferences.** `sworeel style add "Keep captions under ten words"` notes
  down a preference that should hold for every future reel; `sworeel style` lists them and
  `sworeel style remove <N>` drops one. Add one whenever the user states a lasting preference
  ("always", "never", "from now on", or a correction they would not want to repeat), and tell
  them you noted it. A one-off request for the reel in hand is not a preference.

After changing colours, render a still and look at it. Text must stay readable on the
background, and `primary`, `secondary`, `warning`, `success` and `error` should stay distinct
from each other, because charts tell their series apart by them. If the user's choice makes
something unreadable, say so and suggest the nearest colour that works.

The theme changes reels only. The desktop app's own window keeps its look.

## Managing the library for the user

Most users never open the desktop app's menus; they ask you. Treat requests like "tidy up my
reels", "put the auth ones in a folder", "delete the old draft", "what have I exported?" or
"re-export everything as tall videos" as jobs to do with the commands above, not as questions.

- Start with `sworeel list` (and `sworeel exports` when exports are involved) so you act on
  what is really there, and match what the user said to reel names and titles yourself.
- Use these commands rather than `mv` and `rm` on the files. They keep names valid, refuse to
  overwrite, and send deletions to the system trash where the user can restore them.
- When the request is specific, do it and report what changed in one or two lines. When it is
  open-ended ("organise these"), say the plan in a sentence, then carry it out.
- Before deleting more than the user named, or anything they did not clearly ask to remove,
  list what you would delete and ask. Deleting a reel never touches its exports.
- A renamed or moved reel keeps its old export files under the old name. Re-export if the
  user wants matching names.
- To show the user a result, `sworeel open` the exported file or the exports folder.
- To move reels to another computer, or hand them to someone, use `sworeel bundle`: it packs
  reels and the pictures they use into one `.sworeel` file in the exports folder (a folder
  name takes every reel in it, `.` the whole library). On the other computer,
  `sworeel import <file>` adds them. Importing never replaces anything: a reel already there
  unchanged is skipped, and a different one with the same name arrives with a number on it.
  Do not copy reel files by hand, which leaves their pictures behind.
- If the desktop app is open, it picks up every change within a second, so there is nothing to
  refresh.

## Reel format

Every reel has a `title`, a `kind` (left out, it is `flow`), and `steps`, played in order. It
may also have a `theme` (see "Making reels look the way the user wants").
Every step needs a `caption`: the sentence shown under the picture while it plays. What else a
reel and its steps hold depends on the kind.

**Before writing a reel, read the file for its kind**, next to this one: `kinds/<kind>.md`
(for example `kinds/flow.md`). It has the exact fields, a complete example, and what makes
that kind read well. `sworeel validate` then names any mistake precisely.

## Making it read well

For every kind:

- **Captions carry the lesson.** One plain sentence per step, under about 90 characters. Say
  why the step matters, not only what changed. The last caption should state the takeaway.
- **Keep it short.** 4 to 10 steps is a 20 to 40 second video. Split a longer story in two.
  There is no limit, and `sworeel validate` adds a note above 20 steps: offer to split it,
  but make the long reel if that is what the user wants. 
- **One reel, one idea.** A flow and its timings are two reels, not one.
- **Titles under about 35 characters** stay full size in the `tall` format.
- **Never invent facts to fill a picture.** Numbers, dates, coordinates, formulas and code must
  be real: measured, computed, looked up, given by the user, or copied from the file.
- **Icons help when they name a thing** (a database, a user, a queue). A few per reel; `flow`
  and `tree` nodes, `sequence` actors and `sketch` shapes can have one. `sworeel icons` lists them.

## What SwoReel cannot draw

Sixteen kinds cover most explanations, and `sketch` covers a good deal of the rest. What is
still out of reach: photographs and illustrations made from nothing (a `picture` needs an
image file that exists), three dimensions, sound, and maps with borders, roads or labels of
their own. Lines are straight. Captions and labels are set in a Latin font, so stay with plain
punctuation and avoid emoji and arrows in them; formulas belong in a `math` reel.

When what the user wants is none of these, say so plainly and give them the explanation
another way (a table, a list, a paragraph). And do not use `sketch` to imitate a kind that
exists: a hand-placed bar chart is worse than `chart` in every way.

## Never change SwoReel itself

SwoReel's own files are not yours to edit: the `sworeel` command and its code, the drawing
code, this skill and its kind files, the in-chat pane, and the desktop app. Do not modify,
patch, replace or work around them, even when the user asks, and even when a change looks
small or would fix a real limit. Everything you do goes through three things only: reel files
in the library, the `sworeel` commands, and the settings those commands change.

When the user wants something SwoReel cannot do, say so plainly and offer the closest thing it
can. If it looks like a bug, describe what happened so they can report it.
