const runButton = document.getElementById("run");
const soupsInput = document.getElementById("soups");
const sizeInput = document.getElementById("size");
const densityInput = document.getElementById("density");
const ruleInput = document.getElementById("rule");
const seedStartInput = document.getElementById("seedStart");
const progressFill = document.getElementById("progressFill");
const statusEl = document.getElementById("status");
const reportEl = document.getElementById("report");
const inspectorEl = document.getElementById("inspector");
const patternSelect = document.getElementById("patternSelect");
const previewPane = document.getElementById("previewPane");

let source = null;
let currentEntries = [];
let currentRule = "B3/S23";

function streamParams() {
  const params = new URLSearchParams();
  params.set("soups", soupsInput.value);
  params.set("size", sizeInput.value);
  params.set("density", densityInput.value);
  params.set("rule", ruleInput.value);
  params.set("seedStart", seedStartInput.value);
  return params;
}

function groupLabel(type) {
  if (type === "still-life") return "Still lifes";
  if (type === "oscillator") return "Oscillators";
  return "Spaceships";
}

/** Markup for a `<pattern-view>` element (see pattern-view.js) showing `cells` at `cellSize` px/cell. */
function patternView(cells, cellSize) {
  return `<pattern-view cells='${JSON.stringify(cells)}' cell-size="${cellSize}"></pattern-view>`;
}

function renderReport(report) {
  const groups = ["still-life", "oscillator", "spaceship"];
  const html = [];

  for (const type of groups) {
    const items = report.entries.filter((entry) => entry.type === type);
    if (items.length === 0) continue;
    html.push(`<div class="group"><h2>${groupLabel(type)}</h2><div class="entries">`);
    for (const entry of items) {
      const cls = entry.name.startsWith("unknown(") ? "entry unknown" : "entry";
      const thumb = patternView(entry.examplePattern, 4);
      html.push(
        `<span class="${cls}">${thumb} ${entry.name} <span class="count">x${entry.count}</span></span>`,
      );
    }
    html.push("</div></div>");
  }

  html.push(
    `<div class="group"><h2>Summary</h2><div class="entries">` +
      `<span class="entry">extinct <span class="count">${report.extinctSoups}</span></span>` +
      (report.unstabilizedSoups > 0
        ? `<span class="entry">unstabilized <span class="count">${report.unstabilizedSoups}</span></span>`
        : "") +
      (report.unclassifiedObjects > 0
        ? `<span class="entry">unclassified objects <span class="count">${report.unclassifiedObjects}</span></span>`
        : "") +
      `</div></div>`,
  );

  reportEl.innerHTML = html.join("");
}

/** Markup for a `<pattern-grid>` element (see pattern-grid.js) animating `cells` live under `rule`. */
function patternGrid(cells, rule) {
  return `<pattern-grid cells='${JSON.stringify(cells)}' rule="${rule}" cell-px="14" margin="10"></pattern-grid>`;
}

function renderPreview(index) {
  const entry = currentEntries[index];
  if (!entry) {
    previewPane.innerHTML = "";
    return;
  }
  const grid = patternGrid(entry.examplePattern, currentRule);
  previewPane.innerHTML =
    `${grid}` +
    `<dl>` +
    `<dt>name</dt><dd>${entry.name}</dd>` +
    `<dt>type</dt><dd>${entry.type}</dd>` +
    `<dt>period</dt><dd>${entry.period}</dd>` +
    `<dt>size</dt><dd>${entry.boundingBox.width}x${entry.boundingBox.height}</dd>` +
    `<dt>found</dt><dd>${entry.count} time${entry.count === 1 ? "" : "s"}</dd>` +
    `<dt>canonical key</dt><dd>${entry.canonicalKey}</dd>` +
    `</dl>`;
}

function populateInspector(report) {
  currentEntries = report.entries;
  currentRule = report.rule;
  if (currentEntries.length === 0) {
    inspectorEl.style.display = "none";
    patternSelect.innerHTML = "";
    previewPane.innerHTML = "";
    return;
  }

  patternSelect.innerHTML = currentEntries
    .map(
      (entry, i) => `<option value="${i}">${entry.name} (${entry.type}) x${entry.count}</option>`,
    )
    .join("");
  inspectorEl.style.display = "flex";
  patternSelect.selectedIndex = 0;
  renderPreview(0);
}

patternSelect.addEventListener("change", () => {
  renderPreview(Number(patternSelect.value));
});

function disconnect() {
  if (source) {
    source.close();
    source = null;
  }
}

function run() {
  disconnect();
  reportEl.innerHTML = "";
  inspectorEl.style.display = "none";
  currentEntries = [];
  progressFill.style.width = "0%";
  statusEl.textContent = "starting…";
  runButton.disabled = true;

  source = new EventSource("/census-events?" + streamParams().toString());

  source.addEventListener("progress", (event) => {
    const { done, total } = JSON.parse(event.data);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    progressFill.style.width = `${pct}%`;
    statusEl.textContent = `${done} / ${total} soups`;
  });

  source.addEventListener("done", (event) => {
    const report = JSON.parse(event.data);
    progressFill.style.width = "100%";
    statusEl.textContent = `done — ${report.soups} soups (${report.width}x${report.height}, density ${report.density.toFixed(2)}, rule ${report.rule})`;
    renderReport(report);
    populateInspector(report);
    disconnect();
    runButton.disabled = false;
  });

  source.onerror = () => {
    statusEl.textContent = "connection lost";
    disconnect();
    runButton.disabled = false;
  };
}

runButton.addEventListener("click", run);
