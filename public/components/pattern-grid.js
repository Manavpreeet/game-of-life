/**
 * `<pattern-grid cells='[[0,0],[0,1]]' rule="B3/S23" cell-px="14" margin="10"></pattern-grid>`
 *
 * A reusable custom element that *animates* a shape stepping forward under a
 * Life-like rule on a canvas, rather than showing a single static frame --
 * this is what actually shows an oscillator oscillating or a spaceship
 * moving, which a `<pattern-view>` snapshot can't. `cells` are pre-
 * normalized (min x/y = 0) coordinate pairs.
 *
 * The canvas is draggable: the simulation itself is never clipped (`live`
 * is an unbounded cell set), only the fixed-size *view* into it is, so a
 * spaceship that drifts past the initial viewport can be dragged back into
 * view rather than being lost for good.
 *
 * Stepping/rule-parsing comes from life-engine.js (must be loaded first) --
 * see that file for why the logic is duplicated from the TypeScript engine
 * rather than imported.
 */
const { parseRulestring, stepLiveCells } = window.LifeEngine;

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
    this.panPxX = 0;
    this.panPxY = 0;
    this.setUpDragging();
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

  /** Click-and-drag pans the view (pixel offset only -- never touches the simulation state). Registered once; reads live cellPx/redraw off `this` so it keeps working across restarts. */
  setUpDragging() {
    let dragging = false;
    let startClientX = 0;
    let startClientY = 0;
    let startPanX = 0;
    let startPanY = 0;

    this.canvas.style.cursor = "grab";
    this.canvas.style.touchAction = "none";

    this.canvas.addEventListener("pointerdown", (event) => {
      dragging = true;
      startClientX = event.clientX;
      startClientY = event.clientY;
      startPanX = this.panPxX;
      startPanY = this.panPxY;
      // Not every environment implements pointer capture (e.g. jsdom in
      // tests) -- it's a nice-to-have (keeps the drag going even if the
      // cursor leaves the canvas mid-drag), not a requirement.
      this.canvas.setPointerCapture?.(event.pointerId);
      this.canvas.style.cursor = "grabbing";
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      this.panPxX = startPanX + (event.clientX - startClientX);
      this.panPxY = startPanY + (event.clientY - startClientY);
      this.redraw?.();
    });

    const endDrag = () => {
      dragging = false;
      this.canvas.style.cursor = "grab";
    };
    this.canvas.addEventListener("pointerup", endDrag);
    this.canvas.addEventListener("pointerleave", endDrag);
    this.canvas.addEventListener("pointercancel", endDrag);
  }

  restart() {
    this.stop();
    const cellPx = Number(this.getAttribute("cell-px") ?? DEFAULT_CELL_PX);
    const margin = Number(this.getAttribute("margin") ?? DEFAULT_MARGIN);
    const rule = parseRulestring(this.getAttribute("rule"));
    const initial = this.parsedCells();
    this.panPxX = 0;
    this.panPxY = 0;

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
          const px = (x - offsetX) * cellPx + this.panPxX;
          const py = (y - offsetY) * cellPx + this.panPxY;
          // No visibility bounds-check: dragging can bring any cell into
          // view, and the canvas already clips fillRect calls outside its
          // pixel bounds for free.
          this.ctx.fillRect(px, py, cellPx, cellPx);
        }
      }
      this.label.textContent = `gen ${generation} · ${live.size} live cells`;
    };

    this.redraw = draw;
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
