# Conway's Game of Life

A TypeScript implementation of Conway's Game of Life: dense and sparse engines,
arbitrary rulestring support, RLE pattern import, a terminal CLI, and a
live-streamed canvas viewer over Server-Sent Events.

## Demo

Terminal CLI (`npm run dev -- --pattern glider`):

```
························
························
························
························
························
··········█·█···········
···········██···········
···········█············
························
························
························
························
Glider  engine=dense  generation 1/300  (ctrl+c to quit)
```

For the live version, run `npm run serve` and open `http://localhost:3000` for
a canvas that streams and paints each generation in real time, with pattern,
engine, and speed controls.

## Features

- Correct simultaneous-update engine (no in-place-mutation bugs)
- Configurable rulestrings (`Bxx/Sxx`), not just hardcoded B3/S23
- RLE pattern import (the standard `.rle` format)
- Bundled named pattern library (block, blinker, glider, LWSS, pulsar, Gosper glider gun)
- Dense (`Uint8Array`) and sparse (live-cell `Set`) engines with proven parity
- Terminal CLI with pattern/rule/engine/speed flags
- Live canvas viewer streamed over Server-Sent Events, with play/pause/reset/speed
- GitHub Actions CI (typecheck, lint, test on Node 20.x and 22.x)

## Quick start

```bash
npm ci
npm test
npm run dev -- --pattern glider
npm run dev -- --pattern gosper-glider-gun --engine sparse --width 60 --height 30
npm run serve   # then open http://localhost:3000
npm run bench
```

## Architecture

```
src/
├── engine/
│   ├── grid.ts     # dense Grid: Uint8Array + width/height, accessors
│   ├── rules.ts     # rulestring parsing + B3/S23-style evaluation
│   ├── life.ts       # dense engine: step / run (double-buffered)
│   └── sparse.ts      # sparse engine: live-cell Set, same step/run interface
├── io/
│   ├── rle.ts       # RLE pattern format parser
│   └── patterns.ts    # bundled canonical patterns, loadable by name
├── server/
│   ├── server.ts     # http server + static hosting + routing
│   └── stream.ts      # SSE generation stream
├── cli.ts          # terminal renderer + run loop
└── index.ts         # public API barrel export
```

`engine/` has no knowledge of I/O or transport; `io/` turns text into `Grid`s
the engine understands; `server/` and `cli.ts` are two independent front ends
over the same engine and I/O layers. `index.ts` re-exports the pieces meant for
external consumers.

## Design decisions & tradeoffs

**Simultaneous update via double buffering.** Every cell's next state must be
computed from the *current* generation's neighbor counts, not a
partially-updated one. `life.ts` and `sparse.ts` both read exclusively from the
old state and write into a fresh buffer/Set — this is what the glider
translation test (`tests/engine.test.ts`) specifically catches: mutating a grid
in place while stepping it would make each glider generation deform instead of
translate cleanly.

**Dense vs sparse.** The dense engine iterates every cell in a fixed
`width x height` buffer every generation — O(width x height) regardless of
activity. The sparse engine represents only live cells and steps just those
cells plus their neighbors, so cost scales with *activity*, not grid size, and
the grid is effectively unbounded. Measured on this machine (`npm run bench`):

| Scenario | dense | sparse | winner |
|---|---|---|---|
| Glider on a 1000x1000 field, 400 gens | 30.3 gens/sec | 88,580.5 gens/sec | sparse, ~2,926x |
| 50% random soup on 150x150, 100 gens | 1,235.9 gens/sec | 358.4 gens/sec | dense, ~3.4x |

Sparse wins by orders of magnitude on sparse, spread-out patterns (most
interesting Life patterns) because dense pays for empty space it doesn't need
to. Dense wins on dense, chaotic patterns (most cells alive or adjacent to a
live cell) because sparse's per-cell hashing/`Map` bookkeeping stops paying off
once there's little sparsity left to exploit.

**Rulestring generalization.** `parseRulestring("B3/S23")` (or `"B36/S23"` for
HighLife, etc.) parses into birth/survival neighbor-count sets once, and
`applyRule`/`step`/`run` all take an optional `RuleSet` defaulting to standard
Conway rules. This was a few lines of extra abstraction over hardcoding
`neighbors === 2 || neighbors === 3`, and it turns "Conway's Game of Life" into
"any B/S outer-totalistic cellular automaton" for free — exercised by the
HighLife tests in `tests/rules.test.ts`.

**Why SSE over WebSocket.** The server only ever pushes generation frames to
the client; the client's only "input" (pattern/engine/speed/play/pause) is
naturally expressed as reconnecting with new query parameters, not a
bidirectional message protocol. SSE gives automatic reconnection, works over
plain HTTP, and needs no extra dependency (it's `res.write()` with a specific
content type) — a WebSocket server would add protocol complexity this one-way
stream doesn't need. The tradeoff: the server keeps no per-connection session
state, so "play" and "reset" both start the simulation fresh rather than
resuming a paused generation count; "pause" is simply closing the connection,
which the server observes via the response's `close` event to clear its
interval and free resources (verified in `tests/server.test.ts`).

## Testing

- **`engine.test.ts`** — block still life stays unchanged; blinker oscillates
  horizontal/vertical; a glider returns to its original shape shifted by
  `(+1, +1)` after 4 generations (the strongest correctness signal — it fails
  immediately under the classic in-place-mutation bug).
- **`rules.test.ts`** — rulestring parsing, including HighLife `B36/S23`, and
  that a dead cell with 6 neighbors is only born under HighLife, not standard
  rules.
- **`rle.test.ts`** — a glider and a 13x13 pulsar decoded from RLE fixtures
  land at the expected coordinates; the pulsar is also verified to be a
  genuine period-3 oscillator by running it through the engine.
- **`parity.test.ts`** — glider, pulsar, LWSS, and the Gosper glider gun all
  produce identical live-cell sets on the dense and sparse engines after
  running for several generations, on a dense grid padded so boundary clipping
  can't hide a divergence.
- **`server.test.ts`** — the SSE endpoint emits sequential, gap-free
  generation numbers, and the server keeps serving other requests cleanly
  after a client disconnects mid-stream.

## Performance

```
$ npm run bench

Sparse-favorable: glider on 1000x1000 field (400 generations)
  dense:  30.3 gens/sec (13210.9ms)
  sparse: 88580.5 gens/sec (4.5ms)
  -> sparse is 2925.6x faster here

Dense-favorable: 50% random soup on 150x150 (100 generations)
  dense:  1235.9 gens/sec (80.9ms)
  sparse: 358.4 gens/sec (279.0ms)
  -> dense is 3.4x faster here
```

## References

- [Conway's Game of Life — Wikipedia](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life)
- [Run Length Encoded — LifeWiki](https://conwaylife.com/wiki/Run_Length_Encoded)

## License

MIT — see [LICENSE](./LICENSE).
