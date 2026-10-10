# code

```json
{
  "kind": "code",
  "title": "A gateway in nine lines",
  "code": ":80 {\n  handle_path /api/catalog/* {\n    reverse_proxy catalog:3000\n  }\n}",
  "steps": [
    { "caption": "This is the whole gateway." },
    { "caption": "A path starting /api/catalog has that prefix stripped off.", "lines": [2] },
    { "caption": "What is left goes to the catalog service, found by name.", "lines": [3] }
  ]
}
```

- **code** is the listing as one string with `\n` between lines. There is no syntax colouring.
- **steps**: `lines` lists the line numbers to light up; the rest step back. A step with no
  `lines` shows the whole listing evenly, which suits a first and last step.
- Use real code, copied from the file, never a paraphrase. Trim it to what the reel is about.

### Walking through several files

To follow something across a codebase, give `files` instead of `code`. Each has a `name` (its
path, shown above the listing) and its `code`, and a step switches listing with `file`, which
then stays for the steps after it. The first file shows until a step names another.

```json
{
  "kind": "code",
  "title": "A product request, file by file",
  "files": [
    { "name": "apps/storefront/src/api/catalog.ts", "start": 25,
      "code": "export function listProducts(category?: string) {\n  return get(`/products`)\n}" },
    { "name": "services/catalog/config/routes.rb",
      "code": "Rails.application.routes.draw do\n  resources :products, only: %i[index show]\nend" }
  ],
  "steps": [
    { "caption": "Listing products is one small function.", "lines": [25, 26, 27] },
    { "caption": "Rails maps /products to a controller.", "file": "services/catalog/config/routes.rb", "lines": [2] }
  ]
}
```

- **start** is the line number of an excerpt's first line in the real file, so the numbers on
  screen match what the user sees in their editor. With it, `lines` uses those real numbers.
- Read each file and copy the excerpt exactly, including its indentation. Take whole
  functions or blocks where you can, so nothing reads as cut off.
- Long lines are carried over onto a second row, so there is no need to shorten code to fit.

## Making it read well

- **Up to about 14 lines per listing.** Choose the excerpt that carries the point; leave out
  comments and code the captions never mention, but never edit a line.
- **Follow the path the code takes**, not the order of the files on disk: the caller first,
  then what it calls. Up to about 5 files and 10 steps.
- **Say what changes hands** when moving to a new file ("the gateway passes it on to..."), so
  the viewer knows why the listing changed.
- **Light up one to three lines at a time**, in the order the explanation follows, which is
  often not top to bottom.
