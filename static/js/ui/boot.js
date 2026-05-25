let timerId = null;
let aborted = false;
let bootStartedAt = 0;

function renderBar(pct, width) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  let out = "";
  for (let i = 0; i < width; i++) {
    const ch = i < filled ? "█" : "░";
    const color = i < filled ? "var(--term-fg)" : "var(--inactive)";
    out += `<span style="color:${color}">${ch}</span>`;
  }
  return out;
}

const PHASES = [
  "ИНИЦИАЛИЗАЦИЯ",
  "ПРОВЕРКА СЕССИИ",
  "ЗАЩИЩЕННЫЙ КАНАЛ",
  "ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ",
];

const LABEL_W = Math.max(...PHASES.map((p) => p.length));

function headerText() {
  return (
    "╔══════════════════════════════════════╗\n" +
    "║         FOODTRACKER v2.0            ║\n" +
    "╚══════════════════════════════════════╝\n\n"
  );
}

function barWidth() {
  return window.innerWidth < 1200 ? 10 : 16;
}

function buildLine(label, marker, pct, done) {
  const bw = barWidth();
  const shownPct = done ? 100 : Math.min(99, Math.max(0, Math.round(pct)));
  const labelPadded = label.padEnd(LABEL_W, " ");
  const out =
    marker +
    "  " +
    labelPadded +
    "  [" +
    renderBar(done ? 100 : shownPct, bw) +
    "]  " +
    String(shownPct).padStart(3) +
    "%";
  return `<span style="color:var(--${done ? 'term-dim' : 'term-fg'})">${out}</span>`;
}

function clearActions() {
  const el = document.getElementById("boot-actions");
  if (!el) return;
  el.classList.remove("active");
  el.innerHTML = "";
}

export function startBoot() {
  aborted = false;
  bootStartedAt = performance.now();
  const boot = document.getElementById("boot-screen");
  const content = document.getElementById("boot-content");
  if (!boot || !content) return;
  boot.classList.remove("hidden");
  clearActions();

  const totalDuration = 3200;

  function tick() {
    if (aborted) return;
    const elapsed = performance.now() - bootStartedAt;
    const overallPct = Math.min(100, (elapsed / totalDuration) * 100);

    let out = headerText();
    PHASES.forEach((phase, idx) => {
      const phaseStart = (idx / PHASES.length) * 100;
      const phaseEnd = ((idx + 0.82) / PHASES.length) * 100;
      let pct = 0;
      let done = false;
      if (overallPct >= phaseEnd) {
        pct = 100;
        done = true;
      } else if (overallPct >= phaseStart) {
        pct = ((overallPct - phaseStart) / (phaseEnd - phaseStart)) * 100;
      }
      const marker = done ? "✓" : (overallPct >= phaseStart ? ">" : " ");
      out += buildLine(phase, marker, pct, done) + "\n";
    });

    out +=
      "\n  " +
      (overallPct < 100
        ? '<span style="color:var(--term-fg)">ПОДКЛЮЧЕНИЕ...</span>'
        : '<span style="color:var(--term-fg)">ПРОВЕРКА ДОСТУПА...</span>');

    content.innerHTML = out;
    timerId = requestAnimationFrame(tick);
  }

  tick();
}

export function showBootDelay(onContinue) {
  const el = document.getElementById("boot-actions");
  if (!el) return;
  el.classList.add("active");
  el.innerHTML =
    '<div style="color:var(--term-dim);margin-bottom:0.5rem">ЗАДЕРЖКА СЕТИ</div>' +
    '<button type="button" class="boot-continue-btn">ПРОДОЛЖИТЬ</button>';
  const btn = el.querySelector(".boot-continue-btn");
  if (btn) {
    btn.onclick = () => {
      clearActions();
      if (typeof onContinue === "function") onContinue();
    };
  }
}

export async function finishBoot(mode, options = {}) {
  const minVisibleMs = options.minVisibleMs ?? 1400;
  const resultHoldMs = options.resultHoldMs ?? 420;

  const elapsed = performance.now() - bootStartedAt;
  const waitMore = Math.max(0, minVisibleMs - elapsed);
  if (waitMore > 0) {
    await new Promise((r) => setTimeout(r, waitMore));
  }

  aborted = true;
  if (timerId) cancelAnimationFrame(timerId);
  timerId = null;
  clearActions();

  const content = document.getElementById("boot-content");
  if (content) {
    let out = headerText();
    PHASES.forEach((phase) => {
      out += buildLine(phase, "✓", 100, true) + "\n";
    });
    if (mode === "app") {
      out += '\n  <span style="color:var(--term-fg)">СЕССИЯ АКТИВНА  ✓</span>\n\n  Добро пожаловать.';
    } else {
      out += '\n  <span style="color:var(--term-dim)">ТРЕБУЕТСЯ ВХОД</span>\n\n  Войдите или зарегистрируйтесь.';
    }
    content.innerHTML = out;
  }

  await new Promise((r) => setTimeout(r, resultHoldMs));

  const boot = document.getElementById("boot-screen");
  if (boot) boot.classList.add("hidden");

  if (mode === "app") {
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app-shell-wrapper").classList.remove("hidden");
  } else {
    document.getElementById("auth-screen").classList.remove("hidden");
    document.getElementById("app-shell-wrapper").classList.add("hidden");
  }
}
