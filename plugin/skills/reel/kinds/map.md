# map

Places on a map of the world, with messages travelling between them: where servers and users
are, how far a request goes, which regions something covers.

```json
{
  "kind": "map",
  "title": "Why a CDN makes a far-away site feel close",
  "places": [
    { "id": "user", "label": "Shopper in Sydney", "lat": -33.87, "lon": 151.21 },
    { "id": "origin", "label": "Server in Virginia", "lat": 38.9, "lon": -77.5 },
    { "id": "edge", "label": "CDN edge", "lat": -33.6, "lon": 150.6, "hidden": true }
  ],
  "steps": [
    { "caption": "Every image crosses the Pacific.", "from": "user", "to": "origin", "label": "GET image" },
    { "caption": "A CDN keeps copies near the shoppers.", "show": ["edge"], "highlight": ["edge"] },
    { "caption": "Now the request travels a few kilometres.", "from": "user", "to": "edge", "label": "GET image" }
  ]
}
```

- **places**: each has an `id`, a `label`, and `lat` and `lon` in degrees: north and east are
  positive, south and west negative. `hidden` places appear when a step lists them in `show`.
- **view** chooses the part of the world: `world`, `europe`, `north-america`, `south-america`,
  `asia`, `africa`, `oceania`, or `[west, south, east, north]` in degrees. Left out, the map
  fits the places.
- **steps**: `show` and `highlight` as usual; `from`, `to` and an optional `label` send a message
  along an arc between two places, in `style` `request`, `reply` or `error`.

## Making it read well

- **Up to about 8 places.** Two places in the same city overlap; nudge one a degree away.
- **Labels up to about 20 characters.**
- **Look coordinates up or work them out; do not guess.** A city placed in the sea is the
  first thing a viewer notices. Check a still.
- **The map shows land and nothing else**: no borders, country names or cities of its own.
