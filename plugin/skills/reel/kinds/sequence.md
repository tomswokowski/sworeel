# sequence

Actors side by side, each with a line running down, and the messages between them drawn as
arrows from top to bottom. Earlier messages stay on the page, so the whole exchange builds up.
Use it when the *history* of a conversation matters: protocols, handshakes, a request passing
through several hops and back. Use `flow` instead when the layout of the system matters more
than the order.

```json
{
  "kind": "sequence",
  "title": "One product request, start to finish",
  "actors": [
    { "id": "browser", "label": "Browser" },
    { "id": "gateway", "label": "Gateway" },
    { "id": "catalog", "label": "Catalog" }
  ],
  "steps": [
    { "caption": "The browser asks the only address it knows.",
      "from": "browser", "to": "gateway", "label": "GET /products" },
    { "caption": "The catalog turns rows into JSON.", "from": "catalog", "to": "catalog", "label": "to JSON" },
    { "caption": "The answer retraces the path.", "from": "gateway", "to": "browser", "label": "200", "style": "reply" }
  ]
}
```

- **actors**: left to right, each with an `id` and a `label`, and optionally an `icon` from the
  bundled set (`"icon": "user"`); `sworeel icons` lists them.
- **steps**: `from`, `to` and an optional `label` draw one arrow on the next row down. The same
  actor as both is a note to self. `style` is `request` (the default), `reply` or `error`. A
  step with only a caption adds no arrow.

## Making it read well

- **Up to 4 actors**, 3 if labels on the arrows are long, and up to about 9 messages.
- **Arrow labels up to about 18 characters** with 3 actors, 12 with 4; longer ones shrink.
- **Order actors by who speaks first**, so the first arrows run left to right.
- **Use `reply` for answers** so requests and responses are told apart at a glance.
