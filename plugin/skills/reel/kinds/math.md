# math

Formulas, properly typeset, one under another: a derivation built up line by line, or a few
definitions side by side.

```json
{
  "kind": "math",
  "title": "Why binary search takes log n looks",
  "lines": [
    { "id": "halve", "tex": "n \\to \\frac{n}{2} \\to \\frac{n}{4} \\to \\cdots \\to 1", "note": "each look halves what is left" },
    { "id": "k", "tex": "\\frac{n}{2^k} = 1", "hidden": true },
    { "id": "solve", "tex": "k = \\log_2 n", "hidden": true }
  ],
  "steps": [
    { "caption": "Every comparison throws away half the list.", "highlight": ["halve"] },
    { "caption": "After k comparisons, one item is left.", "show": ["k"], "highlight": ["k"] },
    { "caption": "Solve for k.", "show": ["solve"], "highlight": ["solve"] }
  ]
}
```

- **lines**: each has an `id` and `tex`, the formula in TeX without dollar signs. In JSON every
  backslash is doubled: `"\\frac{a}{b}"`. `note` is a few plain words shown under the formula.
  `hidden` lines appear when a step lists them in `show`.
- **steps**: `show` reveals lines; `highlight` picks some out and quietens the rest.
- `sworeel validate` typesets every formula and reports a TeX mistake by name.
- In the in-session pane and other text views, formulas are written out in plain characters
  (`k = log_2 n`); the typeset version is in stills, video and the desktop app.

## Making it read well

- **Up to about 5 lines**, each short enough to read at a glance. One long formula is better
  split into steps. Lines share the height of the frame, so in `wide` every line past the
  fourth makes all of them smaller: split a longer derivation into two reels, or make it for
  `tall`.
- **Reveal one line per step**, and let the caption say in words what the line does.
- **Use `\\text{...}` for words inside a formula**, and `note` for a label under it.
- **Check the maths.** Work the derivation through before writing it; a typeset mistake
  looks authoritative.
