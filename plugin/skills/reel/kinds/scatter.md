# scatter

Points placed by two measurements, to show how one thing varies with another, or how groups
separate. Use `line` when the points are a sequence in time, and `chart` to compare a few
single values.

```json
{
  "kind": "scatter",
  "title": "Rows scanned decide query time",
  "xLabel": "Rows scanned (thousands)",
  "yLabel": "Query time (ms)",
  "points": [
    { "id": "a", "x": 2, "y": 3, "group": "With an index", "label": "by id" },
    { "id": "d", "x": 120, "y": 95, "group": "Without", "label": "by brand", "hidden": true }
  ],
  "steps": [
    { "caption": "Queries that use an index touch few rows." },
    { "caption": "Queries without one read far more.", "show": ["Without"], "highlight": ["Without"] }
  ]
}
```

- **points**: each has an `id` and an `x` and `y` of 0 or more. `label` is written beside the
  point when it is highlighted. Points with the same `group` share a colour and get a key.
- **xLabel**, **yLabel**: what each axis measures, with the unit in brackets. Both scales start
  at 0.
- **steps**: `show` and `highlight` take point ids *or group names*, so a whole group can
  appear or be picked out at once.

## Making it read well

- **Up to about 30 points and 4 groups.** Label only the points a caption talks about.
- **Highlight a single point** to name it; highlight a group to compare it with the rest.
- **Use real measurements.** A scatter plot is evidence; never make up points to show a
  pattern you expect.
