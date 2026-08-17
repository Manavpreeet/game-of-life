/**
 * `<pattern-view cells='[[0,0],[0,1]]' cell-size="4"></pattern-view>`
 *
 * A reusable, self-contained custom element that renders a shape's live
 * cells as a small SVG grid: one accent-colored rect per live cell, sized to
 * its own bounding box. `cells` are pre-normalized (min x/y = 0) coordinate
 * pairs, as `separateComponents`/`classifyObject` on the server already
 * produce -- this element only draws, it doesn't normalize.
 */
class PatternView extends HTMLElement {
  static get observedAttributes() {
    return ["cells", "cell-size"];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  parsedCells() {
    try {
      const parsed = JSON.parse(this.getAttribute("cells") ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  render() {
    const cellSize = Number(this.getAttribute("cell-size") ?? "4");
    const cells = this.parsedCells();

    if (cells.length === 0) {
      this.innerHTML = `<svg width="${cellSize}" height="${cellSize}"></svg>`;
      return;
    }

    let maxX = 0;
    let maxY = 0;
    for (const [x, y] of cells) {
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    const w = (maxX + 1) * cellSize;
    const h = (maxY + 1) * cellSize;
    const rects = cells
      .map(
        ([x, y]) =>
          `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" />`,
      )
      .join("");
    this.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${rects}</svg>`;
  }
}

// Guard against double-registration (e.g. the script tag included twice, or
// a test re-importing the module) rather than letting it throw.
if (!customElements.get("pattern-view")) {
  customElements.define("pattern-view", PatternView);
}
