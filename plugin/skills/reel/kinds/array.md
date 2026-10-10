# array

```json
{
  "kind": "array",
  "title": "Binary search: find 499",
  "cells": [25, 50, 219, 349, 379, 499, 549, 599, 1299],
  "steps": [
    { "caption": "Look at the middle. 379 is too small.", "pointers": { "lo": 0, "mid": 4, "hi": 8 }, "highlight": [4] },
    { "caption": "Throw away the left half.", "pointers": { "lo": 5, "hi": 8 }, "dim": [0, 1, 2, 3, 4] }
  ]
}
```

- **cells**: the starting values, strings or numbers. Positions count from 0.
- **steps**: `highlight` and `dim` take positions; `pointers` names markers and the position
  each points at. These three apply to their own step only, so repeat them on every step where
  they should show.
- `swap: [i, j]` slides two cells past each other, and `set: [...]` replaces every cell. These
  two change the array for all later steps.

## Making it read well

- **Up to about 10 cells**, each value up to 4 characters.
- **Pointer names of 2 to 4 letters** (`lo`, `mid`, `hi`, `i`, `j`). Two pointers on the same
  cell stack, which is fine; three is cluttered.
- **`dim` what has been ruled out** and keep it dimmed on later steps, so the eye stays on the
  part still in play.
