const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const patternSelect = document.getElementById("pattern");
const engineSelect = document.getElementById("engine");
const speedInput = document.getElementById("speed");
const playPauseButton = document.getElementById("playPause");
const resetButton = document.getElementById("reset");

let source = null;
let playing = true;
let lastFrame = null;
let panPxX = 0;
let panPxY = 0;

function draw(frame) {
  lastFrame = frame;
  const cellSize = Math.min(canvas.width / frame.width, canvas.height / frame.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#4ade80";
  for (const [x, y] of frame.cells) {
    ctx.fillRect(x * cellSize + panPxX, y * cellSize + panPxY, cellSize, cellSize);
  }
}

// Click-and-drag pans the view: a spaceship that drifts off the server's
// fixed viewport can be dragged back into view. Purely a rendering offset --
// it never touches the stream or the simulation, so it survives redraws
// without any server-side awareness of it.
(function setUpDragging() {
  let dragging = false;
  let startClientX = 0;
  let startClientY = 0;
  let startPanX = 0;
  let startPanY = 0;

  canvas.style.cursor = "grab";
  canvas.style.touchAction = "none";

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    startClientX = event.clientX;
    startClientY = event.clientY;
    startPanX = panPxX;
    startPanY = panPxY;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.style.cursor = "grabbing";
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    panPxX = startPanX + (event.clientX - startClientX);
    panPxY = startPanY + (event.clientY - startClientY);
    if (lastFrame) draw(lastFrame);
  });

  const endDrag = () => {
    dragging = false;
    canvas.style.cursor = "grab";
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointerleave", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
})();

function streamParams() {
  const params = new URLSearchParams();
  params.set("pattern", patternSelect.value);
  params.set("engine", engineSelect.value);
  params.set("speed", speedInput.value);
  return params;
}

// Disconnecting closes the EventSource, which the server observes via its
// 'close' event and uses to stop the generation interval and free resources.
function disconnect() {
  if (source) {
    source.close();
    source = null;
  }
}

// The server holds no session state across connections, so "play" (and
// "reset") always start a fresh simulation from generation 0 for the current
// pattern/engine/speed -- there is no mid-run resume, only pause (disconnect)
// and (re)start (reconnect). This keeps the server trivially stateless.
function connect() {
  disconnect();
  panPxX = 0;
  panPxY = 0;
  source = new EventSource("/events?" + streamParams().toString());
  source.addEventListener("generation", (event) => {
    const frame = JSON.parse(event.data);
    draw(frame);
    statusEl.textContent = `generation ${frame.generation}`;
  });
  source.onerror = () => {
    statusEl.textContent = "connection lost";
  };
}

playPauseButton.addEventListener("click", () => {
  playing = !playing;
  playPauseButton.textContent = playing ? "Pause" : "Play";
  if (playing) {
    connect();
  } else {
    disconnect();
    statusEl.textContent = "paused";
  }
});

resetButton.addEventListener("click", () => {
  playing = true;
  playPauseButton.textContent = "Pause";
  connect();
});

for (const control of [patternSelect, engineSelect, speedInput]) {
  control.addEventListener("change", () => {
    if (playing) connect();
  });
}

connect();
