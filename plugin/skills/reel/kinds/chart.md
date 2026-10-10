# chart

```json
{
  "kind": "chart",
  "title": "Where a product page spends its time",
  "unit": "ms",
  "bars": [
    { "id": "rails", "label": "Rails", "value": 18 },
    { "id": "query", "label": "Database query", "value": 140, "hidden": true }
  ],
  "steps": [
    { "caption": "The database query is where the time goes.", "show": ["query"], "highlight": ["query"] },
    { "caption": "One index later, it is no longer the problem.", "set": { "query": 4 }, "highlight": ["query"] }
  ]
}
```

- **bars**: one row each, top to bottom, with a `label` and a `value` of 0 or more. `hidden`
  bars grow in from zero when a step lists them in `show`.
- **unit** is written after every value. **max** is the value a full-width bar stands for; left
  out, it is the largest value anywhere in the reel.
- **steps**: `show` reveals bars; `highlight` emphasises some and quietens the rest for that
  step; `set` gives bars new values, which they animate to and keep.
- The strongest chart reels change something: reveal the surprising bar last, or `set` a value
  to show the effect of a fix.

## Making it read well

- **Up to about 8 bars**, labels up to about 20 characters.
- **Use real numbers** you measured or the user gave you. Never invent figures to make a
  point; if you have none, this is not a chart.
- **Bars that differ by more than about 100 times** leave the small ones invisible. Split the
  reel or choose a different comparison.
