import { state } from "./state.js";

const DAY_NAMES = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
const MONTH_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(dateStr, deltaDays) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function sumField(items, field) {
  return items.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0");
}

function fmtDateLong(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return DAY_NAMES[d.getDay()] + ", " + fmtDate(dateStr) + "." + d.getFullYear();
}

function getUserStamp(profile) {
  return state.currentUserEmail || "USER " + (profile.user_id || "?");
}

function getViewportMode() {
  if (window.innerWidth < 1200) return "mobile";
  return "desktop";
}

function updateResponsiveScale() {
  const root = document.documentElement;
  if (window.innerWidth < 1200) {
    root.style.fontSize = (window.innerWidth / 40) + "px";
  } else {
    root.style.fontSize = "14px";
  }
}

function roundDisplay(value, unit) {
  if (unit === "мг") return Math.round(value);
  return Math.round(value);
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function makeSection(title, width) {
  const lineW = Math.max(12, width || 28);
  if (getViewportMode() === "mobile") {
    const titleText = " " + title + " ";
    const dashW = Math.max(0, lineW - titleText.length);
    const leftW = Math.floor(dashW / 2);
    const rightW = dashW - leftW;
    return "\u250c" + "\u2500".repeat(leftW) + titleText + "\u2500".repeat(rightW) + "\u2510\n\n";
  }
  return "\u250c" + "\u2500".repeat(lineW) + "\u2510\n" +
    "\u2502 " + title.padEnd(lineW - 2, " ") + "\u2502\n" +
    "\u2514" + "\u2500".repeat(lineW) + "\u2518\n\n";
}

function fitSectionWidth(kind, preferredWidth, minWidth) {
  const isLeft = kind === "left" || kind === "meals";
  const available = getViewportMode() === "mobile"
    ? Math.min(state.panelMetrics.leftChars, state.panelMetrics.rightChars)
    : (isLeft ? state.panelMetrics.leftChars : state.panelMetrics.rightChars);
  const cap = Math.max((minWidth || 18), available - 2);
  return clamp(Math.min(preferredWidth, cap), minWidth || 18, cap);
}

function bar(value, target, width) {
  if (!target || width <= 0) {
    return "\u2591".repeat(Math.max(width, 0));
  }
  const filled = clamp(Math.round((Math.min(value, target) / target) * width), 0, width);
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled);
}

function formatDelta(value, unit) {
  return unit === "мг" ? Math.round(value) : round1(value);
}

function getPanelCharCapacity(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return null;
  const width = element.clientWidth;
  if (!width) return null;
  const style = window.getComputedStyle(element);
  const canvas = getPanelCharCapacity.canvas || (getPanelCharCapacity.canvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  ctx.font = [style.fontWeight, style.fontSize, style.fontFamily].filter(Boolean).join(" ");
  const charWidth = ctx.measureText("0").width || (parseFloat(style.fontSize) * 0.62) || 8;
  return Math.max(24, Math.floor(width / charWidth) - 1);
}

function computePanelMetrics() {
  const isMobile = getViewportMode() === "mobile";
  const leftChars = getPanelCharCapacity("left-panel") || (isMobile ? 68 : 72);
  const rightChars = getPanelCharCapacity("right-panel") || (isMobile ? 68 : 72);
  return {
    leftChars, rightChars,
    leftBarW: isMobile ? clamp(leftChars - 28, 18, 80) : clamp(leftChars - 30, 22, 72),
    rightBarW: isMobile ? clamp(rightChars - 18, 20, 84) : clamp(rightChars - 20, 24, 68),
    chartW: isMobile ? clamp(rightChars - 16, 24, 72) : clamp(rightChars - 14, 28, 60)
  };
}

function estimateTDEE(profile) {
  const weight = Number(profile.current_weight_kg) || 79;
  const height = Number(profile.height_cm) || 172;
  const age = Number(profile.age) || 28;
  const sex = profile.sex === "female" ? "female" : "male";
  const activityFactor = Number(profile.activity_factor) || 1.35;
  const bmr = sex === "female"
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;
  return Math.round(bmr * activityFactor);
}

function bmi(weight, heightCm) {
  const h = (Number(heightCm) || 172) / 100;
  if (!h) return 0;
  return weight / (h * h);
}

function getWaistSeries(dailyMetrics) {
  return dailyMetrics
    .filter((metric) => metric.date && Number(metric.waist_cm))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((metric) => ({ date: metric.date, waist: Number(metric.waist_cm) }));
}

function getTargets(profile) {
  const calories = Number(profile.daily_calorie_target) || 2200;
  const weight = Number(profile.current_weight_kg) || 79;
  const proteinRecommended = Math.round(weight * 1.8);
  const fatRecommended = Math.round(weight * 0.8);
  const carbsRecommended = Math.max(130, Math.round((calories - proteinRecommended * 4 - fatRecommended * 9) / 4));
  const fiberRecommended = Math.max(25, Math.round((calories / 1000) * 14));
  return {
    calories,
    protein: Number(profile.protein_target_g) || proteinRecommended,
    fat: Number(profile.fat_target_g) || fatRecommended,
    carbs: Number(profile.carbs_target_g) || carbsRecommended,
    fiber: Number(profile.fiber_target_g) || fiberRecommended,
    sugar: Number(profile.sugar_target_g) || 50,
    sodium: Number(profile.sodium_target_mg) || 2300,
    saturatedFat: Number(profile.saturated_fat_target_g) || Math.round((calories * 0.1) / 9),
    recommended: { protein: proteinRecommended, fat: fatRecommended, carbs: carbsRecommended, fiber: fiberRecommended }
  };
}

function getTodayMetrics(entries) {
  return {
    calories: Math.round(sumField(entries, "calories")),
    protein: round1(sumField(entries, "protein")),
    fat: round1(sumField(entries, "fat")),
    carbs: round1(sumField(entries, "carbs")),
    fiber: round1(sumField(entries, "fiber")),
    sugar: round1(sumField(entries, "sugar")),
    sodium: Math.round(sumField(entries, "sodium_mg")),
    saturatedFat: round1(sumField(entries, "saturated_fat"))
  };
}

export {
  DAY_NAMES, MONTH_SHORT,
  today, shiftDate, clamp, round1, sumField, escapeHtml,
  fmtDate, fmtDateLong, getUserStamp, getViewportMode,
  updateResponsiveScale, roundDisplay, daysInMonth,
  makeSection, fitSectionWidth, bar, formatDelta,
  getPanelCharCapacity, computePanelMetrics, estimateTDEE,
  bmi, getWaistSeries, getTargets, getTodayMetrics,
};
