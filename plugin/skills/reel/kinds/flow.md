# flow

```json
{
  "title": "One front door",
  "nodes": [
    { "id": "browser", "label": "Browser", "col": 1, "row": 0 },
    { "id": "gateway", "label": "Gateway", "sub": "Caddy · :8080", "col": 1, "row": 1 },
    { "id": "catalog", "label": "Catalog", "sub": "Rails API", "col": 0, "row": 2, "hidden": true }
  ],
  "groups": [
    { "id": "network", "label": "private network", "nodes": ["gateway", "catalog"] }
  ],
  "steps": [
    { "caption": "The browser knows one address: the gateway.",
      "from": "browser", "to": "gateway", "label": "GET /" },
    { "caption": "The catalog starts.", "show": ["catalog"] },
    { "caption": "It answers.", "from": "gateway", "to": "browser", "label": "200 OK", "style": "reply" }
  ]
}
```

- **nodes**: boxes on a grid. `col` and `row` start at 0; the renderer scales the grid to each
  format, so one reel works in all three. `sub` is an optional smaller second line.
  `hidden: true` keeps a node invisible until a step lists it in `show`. `icon` puts one of
  the bundled icons beside the label (`"icon": "database"`); `sworeel icons` lists them.
- **groups**: a dashed, labelled box drawn around the listed nodes. Can also start `hidden`.
- **steps**: optionally reveal things (`show`: node or group ids) and/or send a message (`from`,
  `to`, and an optional `label`). `style` is `request` (cyan, the default), `reply` (violet) or
  `error` (red).
- A line is drawn between every pair of nodes that exchange a message in any step. There is no
  other way to draw a line.
- A message with the same node as `from` and `to` is a loop back to itself: a retry, or a state
  that stays put. With that, a flow is also a **state machine**: nodes are states, messages are
  transitions, `label` is the event.

## Making it read well

- **Use at most 3 columns**, and up to 5 rows. Wider grids make boxes too small in `tall`.
- **Short text in boxes.** Labels up to about 12 characters, `sub` up to about 18, edge labels
  up to about 26.
- **Lay out for the labels.** An edge label is drawn beside the middle of its line, to the
  right of a vertical line. Leave the neighbouring grid cell free where a long label will sit.
- **Lines are straight** from box centre to box centre, drawn under the boxes. Arrange the grid
  so no line passes behind an unrelated box; put nodes that talk to each other in adjacent
  rows or columns.
- **Flow top to bottom**: the caller above, what it calls below.
- **Reveal to build up.** For "how it's assembled" stories, start nodes `hidden` and `show`
  them one step at a time.
