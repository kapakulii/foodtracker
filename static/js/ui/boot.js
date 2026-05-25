const SPINNERS = ["◴", "◷", "◶", "◵"];
const BAR_CHARS = ["░", "▒", "▓", "█"];

let _timer = null;
let _aborted = false;

function renderSpinner(frame) {
  return `<span class="boot-spinner">${SPINNERS[frame % SPINNERS.length]}</span>`;
}

function renderBar(pct, width) {
  const filled = Math.round((pct / 100) * width);
  let html = "";
  for (let i = 0; i < width; i++) {
    if (i < filled) {
      const depth = Math.min(3, Math.round(((i % 4) / 3) * 3));
      html += `<span class="boot-bar-fill" style="color:var(--term-fg)">${BAR_CHARS[depth]}</span>`;
    } else {
      html += `<span class="boot-bar-fill" style="color:var(--inactive)">░</span>`;
    }
  }
  return html;
}

function buildPhase(label, pct, done, frame) {
  const spinnerChar = done ? "◉" : renderSpinner(frame);
  return `<span class="${done ? 'boot-done' : 'boot-active'}">  ${spinnerChar}  ${label}</span>  [${renderBar(done ? 100 : Math.min(pct, 99), 18)}]  ${done ? "100%" : String(Math.min(pct, 99)).padStart(2) + "%"}`;
}

export function startBoot() {
  _aborted = false;
  const el = document.getElementById("boot-content");
  document.getElementById("boot-screen").classList.remove("hidden");
  if (!el) return;

  const header =
    "╔══════════════════════════════════════╗\n" +
    "║         FOODTRACKER v2.0            ║\n" +
    "║         BOOT SEQUENCE               ║\n" +
    "╚══════════════════════════════════════╝\n\n";

  const phases = [
    "INITIALIZING CORE",
    "VERIFYING SESSION TOKEN",
    "ESTABLISHING SECURE LINK",
    "LOADING USER CONTEXT",
  ];

  const startTime = performance.now();
  const totalDuration = 3000;
  let frame = 0;

  function tick() {
    if (_aborted) return;
    const elapsed = performance.now() - startTime;
    const overallPct = Math.min(100, (elapsed / totalDuration) * 100);
    frame++;

    let out = header;
    phases.forEach((phase, idx) => {
      const phaseStart = (idx / phases.length) * 100;
      const phaseEnd = ((idx + 0.8) / phases.length) * 100;
      let pct;
      let done;
      if (overallPct >= phaseEnd) {
        pct = 100;
        done = true;
      } else if (overallPct >= phaseStart) {
        pct = ((overallPct - phaseStart) / (phaseEnd - phaseStart)) * 100;
        done = false;
      } else {
        pct = 0;
        done = false;
      }
      if (overallPct < phaseStart && idx === 0) {
        pct = overallPct / phaseStart * 100;
        done = false;
      }
      out += buildPhase(phase, pct, done, frame) + "\n";
    });

    out += "\n  STATUS: " + (overallPct < 100 ? "<span class=\"boot-active\">BOOTING...</span>" : "<span class=\"boot-active\">ESTABLISHING SESSION...</span>");

    el.innerHTML = out;
    _timer = requestAnimationFrame(tick);
  }

  tick();
}

export function finishBoot(mode) {
  _aborted = true;
  if (_timer) cancelAnimationFrame(_timer);
  _timer = null;

  const el = document.getElementById("boot-content");
  const header =
    "╔══════════════════════════════════════╗\n" +
    "║         FOODTRACKER v2.0            ║\n" +
    "║         BOOT SEQUENCE               ║\n" +
    "╚══════════════════════════════════════╝\n\n";

  const phases = [
    "INITIALIZING CORE",
    "VERIFYING SESSION TOKEN",
    "ESTABLISHING SECURE LINK",
    "LOADING USER CONTEXT",
  ];

  let out = header;
  phases.forEach((p) => {
    out += buildPhase(p, 100, true, 0) + "\n";
  });

  if (mode === "app") {
    out += "\n  STATUS: <span style=\"color:var(--term-fg)\">CONNECTION ESTABLISHED  ✓</span>\n\n  Добро пожаловать.";
  } else {
    out += "\n  STATUS: <span style=\"color:var(--term-dim)\">NO ACTIVE SESSION — GUEST MODE</span>\n\n  Войдите или зарегистрируйтесь.";
  }

  if (el) el.innerHTML = out;

  setTimeout(() => {
    document.getElementById("boot-screen").classList.add("hidden");
    if (mode === "app") {
      document.getElementById("auth-screen").classList.add("hidden");
      document.getElementById("app-shell-wrapper").classList.remove("hidden");
    } else {
      document.getElementById("auth-screen").classList.remove("hidden");
      document.getElementById("app-shell-wrapper").classList.add("hidden");
    }
  }, mode === "app" ? 300 : 400);
}
