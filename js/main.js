const starsLayer = document.getElementById("stars");
const STAR_COUNT = 220;
for (let i = 0; i < STAR_COUNT; i++) {
  const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  c.setAttribute("class", "star");
  c.setAttribute("cx", (Math.random() * 1500 - 225).toFixed(1));
  c.setAttribute("cy", (Math.random() * 760 - 300).toFixed(1));
  c.setAttribute("r", (Math.random() * 1.2 + 0.7).toFixed(2));
  c.style.animationDelay = (Math.random() * 3).toFixed(2) + "s";
  c.style.animationDuration = (2 + Math.random() * 3).toFixed(2) + "s";
  starsLayer.appendChild(c);
}

const ROWS = 14;
const SPEED = 0.25;
const HORIZON = 475;
const BOTTOM = 700;
const CENTER = 525;

const rowsW = document.getElementById("rowsW");
const rowsC = document.getElementById("rowsC");
const cols = document.getElementById("cols");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let off = 0;
let last = 0;

let colsPath = "";
for (let k = -45; k <= 45; k++) {
  colsPath += "M" + (CENTER + k * 58) + " " + HORIZON + "L" + (CENTER + k * 145) + " " + BOTTOM;
}
cols.setAttribute("d", colsPath);

function rowsPath(shift) {
  let d = "";
  for (let i = 0; i < ROWS; i++) {
    const t = (i + off + shift) / ROWS;
    if (t <= 0 || t >= 1) continue;
    const y = HORIZON + (BOTTOM - HORIZON) * t * t;
    d += "M-4000 " + y.toFixed(1) + "H5000";
  }
  return d;
}

function draw() {
  rowsW.setAttribute("d", rowsPath(0));
  rowsC.setAttribute("d", rowsPath(0.5));
}

function frame(now) {
  const dt = (now - last) / 1000 || 0;
  last = now;
  off = (off + SPEED * dt) % 1;
  draw();
  requestAnimationFrame(frame);
}

draw();
if (!reduce) requestAnimationFrame(frame);
