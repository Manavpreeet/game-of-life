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
- Automated pattern discovery: seeded random "soup" search that detects,
  classifies, and tallies emergent still lifes/oscillators/spaceships into a
  ranked census, on both the CLI (`census` subcommand) and the web (`/census.html`)

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
external consumers. `census/` (the automated pattern discovery feature; see
below) is built entirely on top of `engine/` and `io/` and adds nothing to
their public surface.

`tests/` mirrors this layout (`engine/`, `io/`, `server/`, `cli/`, `census/`),
plus a `web/` folder for the plain-script `public/` frontend's own tests and a
top-level `index.test.ts` for the public API barrel. `public/` keeps each
page's HTML/CSS/JS together at its own root (`index.html` + `viewer.js`,
`census.html` + `census.css` + `census.js`) and factors the genuinely
reusable UI pieces -- used across more than one view -- into
`public/components/` (`pattern-view.js`, `pattern-grid.js`).

## Design decisions & tradeoffs

**Simultaneous update via double buffering.** Every cell's next state must be
computed from the _current_ generation's neighbor counts, not a
partially-updated one. `life.ts` and `sparse.ts` both read exclusively from the
old state and write into a fresh buffer/Set — this is what the glider
translation test (`tests/engine/engine.test.ts`) specifically catches: mutating a grid
in place while stepping it would make each glider generation deform instead of
translate cleanly.

**Dense vs sparse.** The dense engine iterates every cell in a fixed
`width x height` buffer every generation — O(width x height) regardless of
activity. The sparse engine represents only live cells and steps just those
cells plus their neighbors, so cost scales with _activity_, not grid size, and
the grid is effectively unbounded. Measured on this machine (`npm run bench`):

| Scenario                              | dense            | sparse            | winner          |
| ------------------------------------- | ---------------- | ----------------- | --------------- |
| Glider on a 1000x1000 field, 400 gens | 30.3 gens/sec    | 88,580.5 gens/sec | sparse, ~2,926x |
| 50% random soup on 150x150, 100 gens  | 1,235.9 gens/sec | 358.4 gens/sec    | dense, ~3.4x    |

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
HighLife tests in `tests/engine/rules.test.ts`.

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
interval and free resources (verified in `tests/server/server.test.ts`).

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

## Automated Pattern Discovery ("soup search")

A **soup search** runs many random starting grids ("soups"), lets each one
settle, and automatically detects and classifies the stable objects that
emerge -- still lifes, oscillators, spaceships, or extinction -- into a
**census**: a ranked tally of every distinct pattern found and how often it
appeared. The real Life community runs exactly this at scale: a distributed
census called [Catagolue](https://catagolue.hatsoft.com/), using canonical
pattern identifiers called _apgcodes_. This feature is a scoped,
self-contained version of that idea, built on top of the engine above.

**Pipeline:** `soup -> stabilize -> separate -> canonicalize -> classify -> census`

1. **Soup** (`census/soup.ts`) -- a seeded `mulberry32` PRNG fills a
   `width x height` grid at a given live-cell density. Same seed, same soup,
   forever.
2. **Stabilize** (`census/stabilize.ts`) -- step the grid, hashing the
   _origin-normalized_ live-cell set each generation. When a hash repeats,
   the generation gap is the **period** and the absolute-origin delta is the
   **displacement**. Normalizing before hashing is the trick that lets a
   moving spaceship's hash ever repeat at all. A generation cap (default 5000) catches soups that never settle.
3. **Separate** (`census/components.ts`) -- Moore-adjacency connected-component
   labeling splits the settled grid into isolated objects, merging components
   whose bounding boxes lie within a small proximity gap (to tolerate
   oscillators, like a pulsar, whose cells momentarily separate mid-period).
4. **Canonicalize** (`census/canonical.ts`) -- each object is reduced to a
   symmetry-invariant key: apply all 8 dihedral transforms (4 rotations x 2
   reflections), normalize each to its own origin, and keep the
   lexicographically smallest serialization. Two objects share a key exactly
   when one is a rotation/reflection of the other.
5. **Classify** (`census/classify.ts`) -- each object is re-run in isolation
   on a padded field and fed back through the same cycle detector: period 1 +
   zero displacement is a still life, period > 1 + zero displacement is an
   oscillator, non-zero displacement is a spaceship.
6. **Census** (`census/census.ts`) -- runs `N` seeded soups (seeds
   `seedStart .. seedStart + N - 1`), aggregates classified objects by
   canonical key via `census/names.ts` (which builds its key -> name table by
   canonicalizing the bundled pattern library at startup, not by
   hand-encoding keys), and renders both a JSON report and a ranked text
   summary.

### Usage

CLI:

```bash
npm run dev -- census --soups 5000 --size 16 --density 0.4
npm run dev -- census --soups 1000 --seed-start 0 --json --out census.json
```

```
Census over 5000 soups (16x16, density 0.40, rule B3/S23)
Still lifes : block x1423  beehive x402  loaf x188  ...
Oscillators : blinker x510  toad x77  pulsar x9  ...
Spaceships  : glider x58
Extinct     : 611 soups
Unknown     : 3 patterns (reported by canonical key)
```

Web: run `npm run serve`, open `http://localhost:3000/census.html`, set the
soup count/size/density/rule and click **Run census** -- the server streams
progress over SSE (`/census-events`) exactly as the live viewer streams
generations, then renders the ranked report client-side.

### Reproducibility

A census is fully determined by its options (soup count, size, density, rule,
seed start) -- the same inputs always produce the same tally, which is what
makes a census result independently re-verifiable. `tests/census/census.test.ts`
locks this in end-to-end, including a fully-predictable all-density-zero case
where every soup is guaranteed extinct.

### Scope & honesty notes

- The canonical-form + connected-component approach here is a **scoped
  simplification** of production apgcode/Catagolue, which uses a far more
  rigorous canonicalization and a distributed, continuously-running census.
  This feature borrows the idea at a much smaller scale.
- **Imperfect separation:** the proximity-gap merge in `components.ts` is a
  heuristic, not a guarantee. Occasionally a component that looked separable
  in a single settled-grid snapshot turns out, when re-simulated in
  isolation, to not persist as a still life/oscillator/spaceship (it was
  still interacting with a neighbor the heuristic didn't merge). Rather than
  mislabel that as a "pattern", the census counts it under
  `unclassifiedObjects` and surfaces the count instead of hiding it.
- **Bounded soup field:** the soup itself steps on a fixed-size dense grid, so
  a structure that drifts to the edge is clipped exactly as the base engine's
  "outside the grid is dead" rule already defines -- an accepted property of
  a bounded field, not a bug.
- **Performance:** classification re-runs each separated object on a padded
  dense field (default: 100 generations, 60-cell margin) rather than the
  sparse engine, so a very large soup count is slow by design in this scoped
  version. Parallelizing the search across `worker_threads` and switching
  classification to the sparse engine (both noted as optional, unimplemented
  extensions in the feature spec this was built from) would be the next step
  for a production-scale run.
- **Not handled:** very-high-period oscillators that exceed the generation
  cap (reported as `unstabilized`), and two spaceships that collide
  mid-census (whatever debris results is classified as its own object, not
  specially detected as a collision).

## References

- [Conway's Game of Life — Wikipedia](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life)
- [Run Length Encoded — LifeWiki](https://conwaylife.com/wiki/Run_Length_Encoded)
- [Catagolue](https://catagolue.hatsoft.com/) — the production-grade
  distributed soup-search census, and the origin of the apgcode identifier
  this feature's canonical key is a simplified stand-in for.

## License

MIT — see [LICENSE](./LICENSE).
