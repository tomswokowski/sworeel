# tree

A hierarchy drawn from the root down: folders and files, components, an org chart, a call
tree, a decision tree.

```json
{
  "kind": "tree",
  "title": "What lives where in swoshop",
  "nodes": [
    { "id": "root", "label": "swoshop" },
    { "id": "apps", "label": "apps", "parent": "root" },
    { "id": "storefront", "label": "storefront", "parent": "apps", "hidden": true },
    { "id": "services", "label": "services", "parent": "root" }
  ],
  "steps": [
    { "caption": "One repository holds every part of the system." },
    { "caption": "Apps are what people see.", "show": ["storefront"], "highlight": ["root", "apps", "storefront"] }
  ]
}
```

- **nodes**: each has an `id` and a `label`, and every node except the root names its
  `parent`. Children are drawn left to right in the order they are listed. `hidden` nodes
  appear when a step lists them in `show`.
- **steps**: `show` reveals nodes; `highlight` emphasises some and quietens the rest for that
  step. A line between two highlighted nodes is highlighted too, so listing the ids from the
  root down to a node marks the path to it.

### Two ways to draw it

`view` chooses how the tree looks: `boxes` (the default) joins boxes with lines from the root
down, and `list` draws an indented listing with folder and file icons, the way an editor's
file browser does. Set it on the reel, or on a step to switch from then on:

```json
{ "caption": "The same structure as a listing, the way an editor shows it.", "view": "list" }
```

- **Use `list` for file and folder structures**; it holds more rows (about 14) and long names
  comfortably, and reads as "this is the project". Use `boxes` when the shape of the
  hierarchy is the point.
- In a listing, a node with children is a folder, and a leaf is a file if its label has an
  extension (or is a name like `Dockerfile`), otherwise a folder. Give a node an `icon` to
  override that, which is also how a listing of something other than files gets fitting
  icons (`"icon": "user"`).
- Showing both works well: build the tree up as boxes, then switch to the listing as a
  summary, or the other way round.
- `show` and `highlight` work the same in both views.

## Making it read well

- **Up to about 6 leaves and 4 levels**; a wide, shallow tree needs short labels.
- **Labels up to about 14 characters**; longer ones shrink to fit their box.
- **Walk one branch per step** with `highlight`, root included, so the eye follows a path.
- **Hide the detail at first** and `show` each branch as you reach it.
