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

function draw(frame) {
  const cellSize = Math.min(canvas.width / frame.width, canvas.height / frame.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#4ade80";
  for (const [x, y] of frame.cells) {
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  }
}

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
