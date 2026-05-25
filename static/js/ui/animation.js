import { state } from "../state.js";
import { escapeHtml } from "../utils.js";

export function animatePre(element, text) {
  if (!element) return;
  const html = text.split("\n").map((line) => {
    const firstPipe = line.indexOf("|");
    const lastPipe = line.lastIndexOf("|");
    if (firstPipe < 0 || lastPipe <= firstPipe) return escapeHtml(line);
    const left = escapeHtml(line.slice(0, firstPipe + 1));
    const right = escapeHtml(line.slice(lastPipe));
    const barText = line.slice(firstPipe + 1, lastPipe);
    let barHtml = "";
    for (let i = 0; i < barText.length; i++) {
      barHtml += barText[i] === "\u2591"
        ? '<span class="bar-inactive">\u2591</span>'
        : escapeHtml(barText[i]);
    }
    return left + '<span class="bar-wrap"><span class="bar-fill">' + barHtml + "</span></span>" + right;
  }).join("\n");
  element.innerHTML = html;
}

function runBitGlitch() {
  const textNodes = [];
  document.querySelectorAll("pre").forEach((pre) => {
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && node.parentElement.closest(".bar-wrap")) continue;
      const text = node.nodeValue || "";
      let mutated = null;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === "\n" || text[i] === " " || text[i] === "\t") continue;
        if (Math.random() < 0.0018) {
          mutated = mutated || text.split("");
          mutated[i] = Math.random() < 0.5 ? "0" : "1";
        }
      }
      if (mutated) textNodes.push({ node, original: text, mutated: mutated.join("") });
    }
  });
  if (!textNodes.length) return;
  textNodes.forEach((item) => { item.node.nodeValue = item.mutated; });
  setTimeout(() => {
    textNodes.forEach((item) => { if (item.node) item.node.nodeValue = item.original; });
  }, 70);
}

export function startBitGlitch() {
  if (state.bitGlitchTimer) clearInterval(state.bitGlitchTimer);
  state.bitGlitchTimer = setInterval(runBitGlitch, 950);
}
