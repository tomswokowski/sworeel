# line

One to three series plotted over the same points: a trend, growth, a comparison over time.
Use `chart` instead to compare a handful of separate quantities.

```json
{
  "kind": "line",
  "title": "Binary search barely notices growth",
  "unit": "",
  "x": ["10", "100", "1k", "10k", "100k", "1M"],
  "series": [{ "id": "looks", "label": "Looks needed, at worst", "values": [4, 7, 10, 14, 17, 20] }],
  "steps": [
    { "caption": "Ten items: at most four looks.", "upTo": 1, "mark": 0 },
    { "caption": "Tenfold more costs only about three more.", "upTo": 5 },
    { "caption": "A million items: twenty looks.", "upTo": 6, "mark": 5 }
  ]
}
```

- **x**: the labels along the bottom, left to right; at least two.
- **series**: one to three, each with an `id`, a `label` and one value of 0 or more per entry
  in `x`. **unit** is written after values. The scale always starts at 0.
- **steps**: `upTo` is how many points, from the left, are drawn by the end of the step, and
  the line grows to get there; it stays for later steps. If no step uses `upTo`, the whole line
  is there from the start. `mark` is a position in `x`, from 0, to pick out with a guide line
  and its values. `highlight` lists series ids to emphasise.

## Making it read well

- **Up to about 12 points**, and x labels up to about 5 characters.
- **Grow the line with `upTo`** so the caption and the newest point arrive together.
- **`mark` the point the caption is about**, especially the last one.
- **Use real numbers** you measured, computed or were given. Never invent a trend.
- **Series on very different scales** flatten the smaller one. Give them separate reels.
