/**
 * `<pattern-grid cells='[[0,0],[0,1]]' rule="B3/S23" cell-px="14" margin="10"></pattern-grid>`
 *
 * A reusable custom element that *animates* a shape stepping forward under a
 * Life-like rule on a canvas, rather than showing a single static frame --
 * this is what actually shows an oscillator oscillating or a spaceship
 * moving, which a `<pattern-view>` snapshot can't. `cells` are pre-
 * normalized (min x/y = 0) coordinate pairs.
 *
 * The step logic here mirrors src/engine/sparse.ts and src/engine/rules.ts
 * (live-cell-set stepping, Bxx/Sxx rulestring parsing): this is a plain
 * browser script with no build step, so it can't import the TypeScript
 * engine directly, and duplicating this ~20-line core is the pragmatic
 * tradeoff over adding a bundler for one small widget.
 */
const NEIGHBOR_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

function parseRulestring(raw) {
  const match = /^B([0-8]*)\/S([0-8]*)$/i.exec((raw ?? "").trim());
  if (!match) return { births: new Set([3]), survivals: new Set([2, 3]) };
  return {
    births: new Set([...match[1]].map(Number)),
    survivals: new Set([...match[2]].map(Number)),
  };
}

function stepLiveCells(live, rule) {
  const neighborCounts = new Map();
  for (const key of live) {
    const [x, y] = key.split(",").map(Number);
    for (const [dx, dy] of NEIGHBOR_OFFSETS) {
      const neighborKey = `${x + dx},${y + dy}`;
      neighborCounts.set(neighborKey, (neighborCounts.get(neighborKey) ?? 0) + 1);
    }
    if (!neighborCounts.has(key)) neighborCounts.set(key, 0);
  }
  const next = new Set();
  for (const [key, count] of neighborCounts) {
    const set = live.has(key) ? rule.survivals : rule.births;
    if (set.has(count)) next.add(key);
  }
  return next;
}

const DEFAULT_CELL_PX = 14;
const DEFAULT_MARGIN = 10;
const TICK_MS = 300;

class PatternGrid extends HTMLElement {
  static get observedAttributes() {
    return ["cells", "rule", "cell-px", "margin"];
  }

  connectedCallback() {
    this.innerHTML = `<canvas></canvas><div class="pattern-grid-label"></div>`;
    this.canvas = this.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.label = this.querySelector(".pattern-grid-label");
    this.restart();
  }

  disconnectedCallback() {
    this.stop();
  }

  attributeChangedCallback() {
    // Per the custom-elements spec, attributeChangedCallback for attributes
    // already present on the tag fires during upgrade *before*
    // connectedCallback -- so `this.canvas` may not exist yet. Guard on it
    // directly rather than `this.isConnected` (which can already be true at
    // that point).
    if (this.canvas) this.restart();
  }

  parsedCells() {
    try {
      const parsed = JSON.parse(this.getAttribute("cells") ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  restart() {
    this.stop();
    const cellPx = Number(this.getAttribute("cell-px") ?? DEFAULT_CELL_PX);
    const margin = Number(this.getAttribute("margin") ?? DEFAULT_MARGIN);
    const rule = parseRulestring(this.getAttribute("rule"));
    const initial = this.parsedCells();

    let live = new Set(initial.map(([x, y]) => `${x},${y}`));
    let generation = 0;

    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    for (const [x, y] of initial) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const viewCols = maxX - minX + 1 + margin * 2;
    const viewRows = maxY - minY + 1 + margin * 2;
    const offsetX = minX - margin;
    const offsetY = minY - margin;

    this.canvas.width = viewCols * cellPx;
    this.canvas.height = viewRows * cellPx;

    const draw = () => {
      if (this.ctx) {
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "#4ade80";
        for (const key of live) {
          const [x, y] = key.split(",").map(Number);
          const dx = x - offsetX;
          const dy = y - offsetY;
          if (dx >= 0 && dx < viewCols && dy >= 0 && dy < viewRows) {
            this.ctx.fillRect(dx * cellPx, dy * cellPx, cellPx, cellPx);
          }
        }
      }
      this.label.textContent = `gen ${generation} · ${live.size} live cells`;
    };

    draw();
    this.timer = setInterval(() => {
      live = stepLiveCells(live, rule);
      generation++;
      draw();
    }, TICK_MS);
  }
}

if (!customElements.get("pattern-grid")) {
  customElements.define("pattern-grid", PatternGrid);
}
