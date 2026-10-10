# sketch

Shapes placed freely: boxes, ellipses, words, icons, lines and arrows, each where you put it.
It is the escape hatch for explanations none of the other kinds can draw: a queue filling up,
things nested inside things, a layout that is not a grid, two pictures side by side.

**Try the other kinds first.** They lay themselves out, stay tidy in every format and need
no coordinates. Reach for a sketch only when the idea really has no home among them.

```json
{
  "kind": "sketch",
  "title": "A queue lets two services disagree about speed",
  "size": [100, 56],
  "shapes": [
    { "id": "shop", "type": "box", "x": 14, "y": 28, "w": 20, "h": 14, "label": "Checkout" },
    { "id": "queue", "type": "box", "x": 50, "y": 28, "w": 30, "h": 12, "color": "muted" },
    { "id": "worker", "type": "box", "x": 86, "y": 28, "w": 20, "h": 14, "label": "Email worker" },
    { "id": "in", "type": "arrow", "from": "shop", "to": "queue" },
    { "id": "out", "type": "arrow", "from": "queue", "to": "worker" },
    { "id": "job", "type": "icon", "name": "mail", "x": 14, "y": 28, "w": 6, "color": "cyan", "hidden": true }
  ],
  "steps": [
    { "caption": "Checkout drops a job on the queue and carries on.", "show": ["job"], "move": { "job": [50, 28] } },
    { "caption": "The worker takes it at its own pace.", "move": { "job": [86, 40] }, "highlight": ["worker", "job"] }
  ]
}
```

- **size** is the width and height of the drawing space that positions are measured in;
  `[100, 60]` if left out. The space keeps its proportions and is fitted into each format, so
  a wide space is small in `tall` video. Something near `[100, 100]` suits `tall` and `square`.
- **shapes** are drawn in the order listed, lines first. Every shape has an `id` and a `type`:

  | Type | Uses |
  |---|---|
  | `box`, `ellipse` | `x`, `y` (the centre), `w`, `h`, and a `label` inside |
  | `text` | `x`, `y` (the centre), `label` (the words), `size`: `small` or `large` |
  | `icon` | `x`, `y` (the centre), `name` (a bundled icon), `w` (its size, 8 if left out), a `label` under it |
  | `line`, `arrow` | `from` and `to`: each a shape's id or a position `[x, y]`; a `label` beside it; `dashed` |

  Any shape can take a `color`: `cyan`, `violet`, `amber`, `green`, `red` or `muted`. A line to
  a shape stops at its edge, and follows the shape when it moves.
- **steps**: `show` and `highlight` as usual; `move` gives shapes new centres, by id, which they
  slide to and keep.
- `sworeel icons` lists the icon names.

## Making it read well

- **Plan on a grid.** Pick a few x positions and a few y positions and put everything on
  them; a sketch placed by eye looks placed by eye.
- **Leave room.** Shapes should not touch; keep at least 6 units between neighbours and 4 from
  the edges.
- **Box labels up to about 14 characters**; a box needs to be about 1.6 units wide per letter.
- **Movement is the reason to sketch.** If nothing moves or appears, a `flow` would do.
- **Render a still of every step** and look for overlaps; nothing here is checked for you.
