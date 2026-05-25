import { state } from "../state.js";

export function bindDayTabs() {
  document.querySelectorAll("#day-tabs .ptab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.day === state.currentDayView);
    tab.onclick = () => {
      state.currentDayView = tab.dataset.day;
      if (state.globalProfile) render(state.globalProfile, state.globalEntries, state.globalDailyMetrics, state.currentPeriod);
    };
  });
}

export function bindPeriodTabs() {
  document.querySelectorAll("#period-tabs .ptab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.period === state.currentPeriod);
    tab.onclick = () => {
      state.currentPeriod = tab.dataset.period;
      if (state.globalProfile) render(state.globalProfile, state.globalEntries, state.globalDailyMetrics, state.currentPeriod);
    };
  });
}

function renderMobileSecondaryTabs() {
  const container = document.getElementById("mobile-secondary-tabs");
  if (!container) return;
  if (window.innerWidth >= 1200) { container.innerHTML = ""; return; }
  if (state.currentMobileView === "tracker") {
    container.innerHTML = [
      '<button class="ptab' + (state.currentDayView === "yesterday" ? " active" : "") + '" type="button" data-mobile-day="yesterday">ВЧЕРА</button>',
      '<button class="ptab' + (state.currentDayView === "today" ? " active" : "") + '" type="button" data-mobile-day="today">СЕГОДНЯ</button>'
    ].join("");
    container.querySelectorAll("[data-mobile-day]").forEach((tab) => {
      tab.onclick = () => { state.currentDayView = tab.dataset.mobileDay; if (state.globalProfile) render(state.globalProfile, state.globalEntries, state.globalDailyMetrics, state.currentPeriod); };
    });
    return;
  }
  container.innerHTML = [["7","7 ДН"],["14","14 ДН"],["30","30 ДН"],["weeks","НЕДЕЛИ"],["months","МЕСЯЦЫ"]]
    .map(([value, label]) => '<button class="ptab' + (state.currentPeriod === value ? " active" : "") + '" type="button" data-mobile-period="' + value + '">' + label + "</button>").join("");
  container.querySelectorAll("[data-mobile-period]").forEach((tab) => {
    tab.onclick = () => { state.currentPeriod = tab.dataset.mobilePeriod; if (state.globalProfile) render(state.globalProfile, state.globalEntries, state.globalDailyMetrics, state.currentPeriod); };
  });
}

export function syncMobileView() {
  const app = document.getElementById("app");
  const isMobile = window.innerWidth < 1200;
  if (app) app.dataset.mobileView = isMobile ? state.currentMobileView : "all";
  document.querySelectorAll("#mobile-view-tabs .mview-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mobileView === state.currentMobileView);
  });
  renderMobileSecondaryTabs();
}

export function bindMobileViewTabs() {
  document.querySelectorAll("#mobile-view-tabs .mview-tab").forEach((tab) => {
    tab.onclick = () => { state.currentMobileView = tab.dataset.mobileView; syncMobileView(); if (state.globalProfile) render(state.globalProfile, state.globalEntries, state.globalDailyMetrics, state.currentPeriod); };
  });
}

/* ── Circular ref workaround ──────────────── */
import { render } from "../app.js";
