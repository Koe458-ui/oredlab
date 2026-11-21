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
