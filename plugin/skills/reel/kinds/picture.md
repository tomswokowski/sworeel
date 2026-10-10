# picture

An image, usually a screenshot, with parts of it picked out one at a time while the rest dims.
Use it to walk through a real interface, a dashboard, an error page or a diagram the user
already has. A reel can move through several images, so a handful of screenshots becomes
one walkthrough of a user flow.

```json
{
  "kind": "picture",
  "title": "Reading a checkout screenshot",
  "src": "checkout.png",
  "steps": [
    { "caption": "This is the page as the customer sees it." },
    { "caption": "The address bar says where we are.", "focus": [0.22, 0.13, 0.55, 0.04], "label": "the address" },
    { "caption": "The error sits right above the button it blocks.", "focus": [0.29, 0.61, 0.42, 0.09], "label": "the error" }
  ]
}
```

- **src** is the name of a PNG or JPEG in SwoReel's picture store. Put an image there first:

  ```bash
  sworeel asset add ~/Pictures/checkout.png            # prints the name to use: checkout.png
  sworeel asset add /tmp/shot.png shop-1-all           # a second word chooses the name
  sworeel asset list
  ```

  Use exactly the name the command prints (it adds a number when another picture already has
  that name). The store is kept apart from the reels, so a reel can be renamed or moved
  without losing its pictures, and the user never sees or manages the files. Never put images
  in the reels folder, and do not point `src` at a path on the user's machine: the original
  may be moved or deleted.
- **steps**: `focus` is `[x, y, width, height]` in fractions of the picture, measured from its
  top left, so `[0.5, 0, 0.5, 1]` is the right half. The frame slides from one step's focus to
  the next. A step with no `focus` shows the whole picture. `label` writes a few words beside
  the part picked out.
- **Several images in one reel:** a step can carry its own `src`. The picture fades to that
  image, which then stays for the steps after it, until another step names a different one.
  With a `src` on the first step, the reel's own `src` can be left out:

  ```json
  "steps": [
    { "caption": "The storefront lists every product.", "src": "shop-1-all.png" },
    { "caption": "Choosing a category filters the list.", "focus": [0.40, 0.10, 0.08, 0.07], "label": "Putters" },
    { "caption": "Only the two putters remain.", "src": "shop-2-putters.png" }
  ]
  ```

  A `focus` on the step that changes image is measured on the new image.
- **Marks** point at things without dimming anything. A step's `marks` is a list, drawn for
  that step only, with positions as fractions of the picture like `focus`:

  | Type | Uses |
  |---|---|
  | `arrow` | `at` (where it points) and optionally `from` (where it starts); left out, it comes in from the side with more room. `label` sits at its tail |
  | `circle` | `at` (its centre), `size` (its width, as a fraction of the picture's; 0.08 if left out), `label` above it |
  | `box` | `area`: `[x, y, width, height]`; `label` above it |
  | `note` | `at` and `label`: a few words placed on the picture |

  ```json
  { "caption": "The filter is a single control.",
    "marks": [{ "type": "arrow", "at": [0.445, 0.15], "label": "filter by category" }] }
  ```

  Marks are amber unless given a `color`: `cyan`, `violet`, `amber`, `green`, `red` or `muted`.
  Use `focus` to say "look only here", and marks to say "notice this" while the rest stays
  readable. They can be used together.
- `sworeel validate` checks every file can be read.

## Making it read well

- **Read the image first** and work out each `focus` from what is really in it, then render a
  still of every step and check the box lands where you meant. This kind needs that check
  more than any other.
- **Start and end on the whole picture**, so the viewer knows where the details sit.
- **For a flow, alternate**: show a screen whole, pick out what the user presses, then switch
  to the next screen. Use screenshots of the same size so the frame doesn't jump.
- **You do not take screenshots.** Use images the user has or points you to; if they have
  none, say what you would need.
- **Three to five parts**, each large enough to read once it is picked out.
- **One or two marks per step.** Labels are drawn over the picture, so keep them to a few
  words and check a still that they do not cover what they describe; give an arrow a `from`
  to move its label somewhere clear.
- **Mind what a screenshot shows.** Names, email addresses, tokens and private data in the
  picture end up in the video; point it out to the user before exporting.
- In text views the picture is only a frame with the focus box; the image itself needs a
  still, video or the desktop app.
