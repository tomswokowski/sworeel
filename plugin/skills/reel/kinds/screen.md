# screen

A wireframe of a page or app screen, inside a browser or phone frame, built from a handful of
standard parts. Use it to explain a design: what goes where, what changes when something is
pressed, how an error should appear. It is a sketch of an interface, not a screenshot; to
walk through a real one, use `picture`.

```json
{
  "kind": "screen",
  "title": "What a declined card should look like",
  "device": "browser",
  "address": "shop.test/checkout",
  "elements": [
    { "type": "nav", "text": "shop", "items": ["Shop", "Cart (2)"] },
    { "type": "heading", "text": "Checkout" },
    { "type": "row", "children": [
      { "id": "summary", "type": "list", "items": ["Driver   $549.00", "Total   $598.99"] },
      { "type": "image" }
    ] },
    { "id": "card", "type": "input", "label": "Card number", "value": "4242 4242 4242 4242" },
    { "id": "error", "type": "notice", "style": "error", "text": "Your card was declined.", "hidden": true },
    { "id": "pay", "type": "button", "style": "primary", "text": "Pay $598.99" }
  ],
  "steps": [
    { "caption": "Pressing pay changes the button at once.", "highlight": ["pay"], "set": { "pay": { "text": "Paying…" } } },
    { "caption": "The decline appears next to the field.", "show": ["error"], "highlight": ["error"] }
  ]
}
```

- **device** is `browser` (the default) or `phone`. **address** fills a browser's address bar.
- **elements** stack from top to bottom. Each has a `type`, and an `id` if a step refers to it:

  | Type | Uses |
  |---|---|
  | `nav` | `text` (the brand) and `items` |
  | `heading` | `text` |
  | `text` | `text` for real words, or `lines` for that many grey placeholder bars |
  | `image` | `size`: `short` (the default) or `tall` |
  | `input` | `label` above it and `value` inside it |
  | `button` | `text`, and `style`: `primary` or `plain` |
  | `list` | `items`, one row each |
  | `notice` | `text`, and `style`: `error` or `info` |
  | `gap` | nothing; a little space |
  | `row` | `children`, laid side by side in equal widths; rows do not nest |

- `hidden` elements keep their place in the layout and appear when a step lists them in `show`.
- **steps**: `highlight` outlines elements and quietens the rest; `set` gives elements new
  `text`, `value`, `items` or `style`, by id, which they keep for later steps.

## Making it read well

- **Up to about 8 elements** in a browser and 7 on a phone; more and everything shrinks.
- **Show a change.** The best screens press something: a button's words change, a notice
  appears, a value fills in.
- **Real words for what matters, placeholders for the rest.** Write the heading, the button
  and the error; let `lines` stand in for body copy.
- **One highlight per step**, with the caption saying why that part is the way it is.
