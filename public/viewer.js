const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

const streamUrl = "/events" + location.search;

function draw(frame) {
  const cellSize = Math.min(canvas.width / frame.width, canvas.height / frame.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#4ade80";
  for (const [x, y] of frame.cells) {
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  }
}

const source = new EventSource(streamUrl);

source.addEventListener("generation", (event) => {
  const frame = JSON.parse(event.data);
  draw(frame);
  statusEl.textContent = `generation ${frame.generation}`;
});

source.onerror = () => {
  statusEl.textContent = "connection lost";
};
