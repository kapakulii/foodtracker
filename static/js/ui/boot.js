const SPINNERS = ["◴", "◷", "◶", "◵"];

let timerId = null;
let aborted = false;
let bootStartedAt = 0;

function renderSpinner(frame) {
  return `<span class="boot-spinner">${SPINNERS[frame % SPINNERS.length]}</span>`;
}

function renderBar(percent, width) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  let out = "";
  for (let i = 0; i < width; i++) {
    out += `<span class="boot-bar-fill" style="color:var(--${i < filled ? 'term-fg' : 'inactive'})">${i < filled ? '█' : '░'}</span>`;
  }
  return out;
}

function renderPhase(label, pct, done, frame) {
  const icon = done ? "◉" : renderSpinner(frame);
  const shownPct = done ? 100 : Math.min(99, Math.max(0, Math.round(pct)));
  return `<span class="${done ? "boot-done" : "boot-active"}">  ${icon}  ${label}</span>  [${renderBar(done ? 100 : shownPct, 18)}]  ${String(shownPct).padStart(3)}%`;
}

function headerText() {
  return (
    "╔══════════════════════════════════════╗\n" +
    "║         FOODTRACKER v2.0            ║\n" +
    "║      ПОСЛЕДОВАТЕЛЬНОСТЬ ЗАПУСКА     ║\n" +
    "╚══════════════════════════════════════╝\n\n"
  );
}

function phasesText() {
  return [
    "ИНИЦИАЛИЗАЦИЯ ЯДРА",
    "ПРОВЕРКА СЕССИИ",
    "ЗАЩИЩЕННЫЙ КАНАЛ",
    "ЗАГРУЗКА ПРОФИЛЯ",
  ];
}

function clearActions() {
  const actions = document.getElementById("boot-actions");
  if (!actions) return;
  actions.classList.remove("active");
  actions.innerHTML = "";
}

export function startBoot() {
  aborted = false;
  bootStartedAt = performance.now();
  const boot = document.getElementById("boot-screen");
  const content = document.getElementById("boot-content");
  if (!boot || !content) return;
  boot.classList.remove("hidden");
  clearActions();

  const phases = phasesText();
  const totalDuration = 3600;
  let frame = 0;

  function tick() {
    if (aborted) return;
    const elapsed = performance.now() - bootStartedAt;
    const overallPct = Math.min(100, (elapsed / totalDuration) * 100);
    frame += 1;

    let out = headerText();
    phases.forEach((phase, idx) => {
      const phaseStart = (idx / phases.length) * 100;
      const phaseEnd = ((idx + 0.82) / phases.length) * 100;
      let pct = 0;
      let done = false;
      if (overallPct >= phaseEnd) {
        pct = 100;
        done = true;
      } else if (overallPct >= phaseStart) {
        pct = ((overallPct - phaseStart) / (phaseEnd - phaseStart)) * 100;
      }
      out += renderPhase(phase, pct, done, frame) + "\n";
    });

    out += "\n  СТАТУС: " + (overallPct < 100
      ? "<span class=\"boot-active\">ПОДКЛЮЧЕНИЕ...</span>"
      : "<span class=\"boot-active\">ПРОВЕРКА ДОСТУПА...</span>");

    content.innerHTML = out;
    timerId = requestAnimationFrame(tick);
  }

  tick();
}

export function showBootDelay(onContinue) {
  const actions = document.getElementById("boot-actions");
  if (!actions) return;
  actions.classList.add("active");
  actions.innerHTML =
    '<div style="color:var(--term-dim);margin-bottom:0.5rem">ЗАДЕРЖКА СЕТИ. Проверка сессии заняла слишком много времени.</div>' +
    '<button type="button" class="boot-continue-btn" id="boot-continue-btn">ПРОДОЛЖИТЬ</button>';
  const btn = document.getElementById("boot-continue-btn");
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
    await new Promise((resolve) => setTimeout(resolve, waitMore));
  }

  aborted = true;
  if (timerId) cancelAnimationFrame(timerId);
  timerId = null;
  clearActions();

  const content = document.getElementById("boot-content");
  if (content) {
    let out = headerText();
    phasesText().forEach((phase) => {
      out += renderPhase(phase, 100, true, 0) + "\n";
    });

    if (mode === "app") {
      out += "\n  СТАТУС: <span style=\"color:var(--term-fg)\">СЕССИЯ АКТИВНА  ✓</span>\n\n  Добро пожаловать.";
    } else {
      out += "\n  СТАТУС: <span style=\"color:var(--term-dim)\">ТРЕБУЕТСЯ ВХОД</span>\n\n  Войдите или зарегистрируйтесь.";
    }
    content.innerHTML = out;
  }

  await new Promise((resolve) => setTimeout(resolve, resultHoldMs));

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
