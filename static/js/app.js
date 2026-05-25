import { state } from "./state.js";
import { computePanelMetrics, today, shiftDate, updateResponsiveScale } from "./utils.js";
import { apiGet } from "./api.js";
import { setOnUnauthorized } from "./api.js";
import { buildToday, buildHistory, buildWeight } from "./ui/render.js";
import { renderInteractiveMeals } from "./ui/meals.js";
import { openAIChat } from "./ui/ai-chat.js";
import { openGoalEditor } from "./ui/profile-goal.js";
import { handleUnauthorized, handleAuthSubmit, toggleAuthMode, handleLogout, checkAuth } from "./ui/auth.js";
import { bindDayTabs, bindPeriodTabs, syncMobileView, bindMobileViewTabs } from "./ui/tabs.js";
import { animatePre, startBitGlitch } from "./ui/animation.js";

/* ── Main render ─────────────────────────── */

export function render(profile, entries, dailyMetrics, period) {
  state.panelMetrics = computePanelMetrics();
  document.getElementById("title").textContent = "FOOD_TRACKER";
  document.getElementById("user-email").textContent = state.currentUserEmail ? "(" + state.currentUserEmail + ")" : "";
  const selectedDate = state.currentDayView === "yesterday" ? shiftDate(today(), -1) : today();
  const sectionTitle = state.currentDayView === "yesterday" ? "ВЧЕРА" : "СЕГОДНЯ";
  const selectedEntries = entries.filter((e) => e.date === selectedDate);
  animatePre(document.getElementById("left-panel"), buildToday(profile, selectedEntries, selectedDate, sectionTitle));
  renderInteractiveMeals(selectedEntries);
  animatePre(document.getElementById("right-panel"), buildHistory(entries, profile, period) + "\n\n" + buildWeight(profile, dailyMetrics, period));
  bindDayTabs();
  bindPeriodTabs();
  syncMobileView();
  startBitGlitch();
}

/* ── loadData ────────────────────────────── */

export async function loadData() {
  try {
    const data = await apiGet("/api/summary");
    state.globalProfile = data.profile || {};
    state.globalEntries = Array.isArray(data.entries) ? data.entries : [];
    state.globalDailyMetrics = Array.isArray(data.daily_metrics) ? data.daily_metrics : [];
    render(state.globalProfile, state.globalEntries, state.globalDailyMetrics, state.currentPeriod);
  } catch (error) {
    const errPre = document.createElement("pre");
    errPre.textContent = "Ошибка загрузки.\n\n" + error.message + "\n\nЗапусти сервер через python3 server.py";
    const appEl = document.getElementById("app");
    appEl.innerHTML = "";
    appEl.appendChild(errPre);
  }
}

/* ── Init ────────────────────────────────── */

setOnUnauthorized(handleUnauthorized);

document.getElementById("auth-submit").addEventListener("click", handleAuthSubmit);
document.getElementById("auth-password").addEventListener("keydown", (e) => { if (e.key === "Enter") handleAuthSubmit(); });
document.getElementById("auth-toggle-link").addEventListener("click", toggleAuthMode);
document.getElementById("stamp").addEventListener("click", handleLogout);
document.getElementById("goal-btn").addEventListener("click", openGoalEditor);

updateResponsiveScale();
checkAuth();
bindMobileViewTabs();
syncMobileView();
setInterval(() => { if (state.globalProfile) loadData(); }, 60000);

document.getElementById("fab-btn").addEventListener("click", openAIChat);
document.getElementById("modal-overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.target.classList.remove("active"); });

window.addEventListener("resize", () => {
  updateResponsiveScale();
  syncMobileView();
  if (state.globalProfile) render(state.globalProfile, state.globalEntries, state.globalDailyMetrics, state.currentPeriod);
});

if (window.visualViewport) {
  const updateVH = () => {
    document.documentElement.style.setProperty("--vh", window.visualViewport.height + "px");
  };
  window.visualViewport.addEventListener("resize", updateVH);
  updateVH();
}
