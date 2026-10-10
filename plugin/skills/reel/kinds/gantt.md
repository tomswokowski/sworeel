# gantt

Tasks as bars along a shared scale, showing when each starts and ends: a plan, a schedule,
what overlaps with what, or where the time in a request goes. Use `timeline` instead when
only the order matters, not how long things take.

```json
{
  "kind": "gantt",
  "title": "A plan for the first deploy",
  "unit": "day",
  "tasks": [
    { "id": "images", "label": "Production images", "start": 0, "end": 2, "hidden": true },
    { "id": "server", "label": "Rent a server", "start": 1, "end": 2, "hidden": true },
    { "id": "ship", "label": "First deploy", "start": 2, "end": 3, "hidden": true }
  ],
  "steps": [
    { "caption": "Start with images that run anywhere.", "show": ["images"], "highlight": ["images"] },
    { "caption": "The server can be set up in parallel.", "show": ["server"], "highlight": ["server"] },
    { "caption": "Both are needed before the deploy.", "show": ["ship"], "now": 2 }
  ]
}
```

- **tasks**: one row each, top to bottom, with a `label`, and a `start` and `end` on the same
  scale. `hidden` tasks grow in from their start when a step lists them in `show`.
- **unit** names what the scale counts (`day`, `week`, `ms`). The scale runs from the earliest
  start to the latest end.
- **steps**: `show` and `highlight` as usual; `now` draws a vertical marker at a position on the
  scale, for "today" or "this is where it blocked".

## Making it read well

- **Up to about 8 tasks**, labels up to about 22 characters.
- **List tasks in the order they start**, so the bars step down to the right.
- **Reveal one or two tasks per step** and say why each starts when it does.
- **A plan is the user's to make.** Use their dates and durations; do not invent a schedule.
