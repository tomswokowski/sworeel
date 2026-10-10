# timeline

Events in order along a line: a history, a release plan, the stages of an incident, a day.
Events are evenly spaced, not placed to scale, so it shows order, not duration.

```json
{
  "kind": "timeline",
  "title": "How deploying an app changed",
  "events": [
    { "id": "docker", "when": "2013", "label": "Docker: package the app with everything it needs", "hidden": true },
    { "id": "k8s", "when": "2014", "label": "Kubernetes: run containers across many machines", "hidden": true }
  ],
  "steps": [
    { "caption": "Containers made the app portable.", "show": ["docker"], "highlight": ["docker"] },
    { "caption": "Orchestrators ran thousands of them.", "show": ["k8s"], "highlight": ["k8s"] }
  ]
}
```

- **events**: in the order they happened, each with an `id`, a `when` (any short text: `2013`,
  `Day 2`, `09:41`) and a `label`. `hidden` events appear when a step lists them in `show`.
- **steps**: `show` reveals events; `highlight` emphasises some and quietens the rest.

## Making it read well

- **Up to about 6 events.** A wide frame runs the line across; a tall one runs it down.
- **`when` up to about 8 characters**, labels up to about 50, which wrap.
- **Reveal and highlight one event per step**, so each caption is about the event just lit.
- **Check the dates.** A timeline states facts; do not guess a year.
