# pie

Shares of a whole, drawn as a ring with a key. Use it only when the parts add up to
something meaningful and there are few of them; otherwise `chart` compares values better.

```json
{
  "kind": "pie",
  "title": "957 packages on a fresh system",
  "slices": [
    { "id": "chosen", "label": "Chosen on purpose", "value": 167, "hidden": true },
    { "id": "deps", "label": "Pulled in as dependencies", "value": 790, "hidden": true }
  ],
  "steps": [
    { "caption": "Only 167 were installed deliberately.", "show": ["chosen"], "highlight": ["chosen"] },
    { "caption": "The other 790 came along as dependencies.", "show": ["deps"], "highlight": ["deps"] }
  ]
}
```

- **slices**: two to six read best (more than six colours repeat), clockwise from the top, each with an `id`, a `label` and a `value`.
  Shares are worked out from the values, so give the raw numbers, not percentages. `hidden`
  slices sweep in when a step lists them in `show`.
- **steps**: `show` reveals slices; `highlight` pulls one out, quietens the rest, and writes
  its percentage in the middle of the ring.

## Making it read well

- **Two to five slices.** Fold small ones into "Other".
- **Labels up to about 26 characters.**
- **Highlight one slice per step**; its percentage in the middle is the point of the frame.
- **Use real numbers** that add up to the whole you name in the title.
