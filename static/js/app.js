import { state } from "./state.js";
import {
  DAY_NAMES, MONTH_SHORT,
  today, shiftDate, clamp, round1, sumField, escapeHtml,
  fmtDate, fmtDateLong, getUserStamp, getViewportMode,
  updateResponsiveScale, roundDisplay, daysInMonth,
  makeSection, fitSectionWidth, bar, formatDelta,
  getPanelCharCapacity, computePanelMetrics, estimateTDEE,
  bmi, getWaistSeries, getTargets, getTodayMetrics,
} from "./utils.js";
import {
  apiGet, apiPost, apiPut, apiDelete, setOnUnauthorized,
} from "./api.js";

/* ── Today panel ─────────────────────────── */

function buildToday(profile, entries, dateStr, sectionTitle) {
  const viewportMode = getViewportMode();
  const compact = viewportMode === "mobile";
  const targets = getTargets(profile);
  const metrics = getTodayMetrics(entries);
  const tdee = estimateTDEE(profile);
  const deficit = tdee - targets.calories;
  const rows = [
    ["БЕЛКИ", metrics.protein, targets.protein, "г"],
    ["ЖИРЫ", metrics.fat, targets.fat, "г"],
    ["УГЛЕВОДЫ", metrics.carbs, targets.carbs, "г"],
    ["КЛЕТЧАТКА", metrics.fiber, targets.fiber, "г"]
  ];

  if (metrics.sugar > 0 || profile.sugar_target_g) {
    rows.push(["САХАР", metrics.sugar, targets.sugar, "г"]);
  }
  if (metrics.sodium > 0 || profile.sodium_target_mg) {
    rows.push(["НАТРИЙ", metrics.sodium, targets.sodium, "мг"]);
  }
  if (metrics.saturatedFat > 0 || profile.saturated_fat_target_g) {
    rows.push(["НАСЫЩ. ЖИРЫ", metrics.saturatedFat, targets.saturatedFat, "г"]);
  }

  const calorieLabel = "КАЛОРИИ";
  const renderedRows = rows.map(([label, value, target, unit]) => [label, value, target, unit]);
  const labelW = Math.max(calorieLabel.length, ...renderedRows.map(([label]) => label.length));
  const currentW = Math.max(
    String(Math.round(metrics.calories)).length,
    ...renderedRows.map(([, value, , unit]) => String(roundDisplay(value, unit)).length)
  );
  const targetW = Math.max(
    String(Math.round(targets.calories)).length,
    ...renderedRows.map(([, , target, unit]) => String(roundDisplay(target, unit)).length)
  );
  const lineW = compact ? fitSectionWidth("left", state.panelMetrics.leftChars - 2, 24) : 0;
  const valueTextW = Math.max(
    (String(Math.round(metrics.calories)) + "  /  " + String(Math.round(targets.calories)) + " ккал").length,
    ...renderedRows.map(([, value, target, unit]) => (
      String(roundDisplay(value, unit)) + "  /  " + String(roundDisplay(target, unit)) + " " + unit
    ).length)
  );
  const barW = clamp(
    state.panelMetrics.leftChars - labelW - valueTextW - 5,
    compact ? 10 : 18,
    state.panelMetrics.leftBarW
  );
  const dateLabel = compact
    ? DAY_NAMES[new Date(dateStr + "T12:00:00").getDay()] + " " + fmtDate(dateStr)
    : fmtDateLong(dateStr);

  let out = "";
  out += makeSection(sectionTitle, fitSectionWidth("left", compact ? lineW : barW + 31, compact ? 20 : 24));
  out += "Дата: " + dateLabel + "\n";
  out += calorieLabel.padEnd(labelW) + " |" + bar(metrics.calories, targets.calories, barW) + "| ";
  out += String(Math.round(metrics.calories)).padStart(currentW) + "  /  " + String(Math.round(targets.calories)).padStart(targetW) + " ккал\n";
  out += metrics.calories <= targets.calories
    ? (compact ? "запас " : "в запасе ") + (targets.calories - metrics.calories) + " ккал\n\n"
    : (compact ? "перебор " : "перебор ") + (metrics.calories - targets.calories) + " ккал\n\n";

  renderedRows.forEach(([label, value, target, unit]) => {
    const marker = value > target ? " !" : "  ";
    const displayValue = roundDisplay(value, unit);
    const displayTarget = roundDisplay(target, unit);
    out += label.padEnd(labelW) + " |" + bar(value, target, barW) + "|" + marker;
    out += String(displayValue).padStart(currentW) + "  /  " + String(displayTarget).padStart(targetW) + " " + unit + "\n";
  });

  out += "\n";
  out += "TDEE: " + tdee + " ккал";
  out += deficit > 0 ? "   Плановый дефицит: " + deficit + " ккал/д" : "";
  out += "\n";
  return out;
}

function buildMeals(entries) {
  const compact = getViewportMode() === "mobile";
  const mealConfig = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекусы" };
  const mealOrder = ["breakfast", "lunch", "dinner", "snack"];
  if (!entries.length) {
    return makeSection("ПИТАНИЕ", fitSectionWidth("meals", compact ? state.panelMetrics.leftChars - 2 : 36, 24)) + "За сегодня записей пока нет.";
  }
  let out = makeSection("ПИТАНИЕ", fitSectionWidth("meals", compact ? state.panelMetrics.leftChars - 2 : 36, 24));
  const weightW = Math.max(...entries.map((e) => String(Math.round(e.weight_g)).length)) + 1;
  const proteinW = Math.max(...entries.map((e) => String(round1(e.protein)).length)) + 1;
  const fatW = Math.max(...entries.map((e) => String(round1(e.fat)).length)) + 1;
  const carbsW = Math.max(...entries.map((e) => String(round1(e.carbs)).length)) + 1;
  const fiberW = Math.max(...entries.map((e) => String(round1(e.fiber)).length)) + 1;
  const metricGap = "      ";
  mealOrder.forEach((mealKey) => {
    const mealEntries = entries.filter((e) => e.meal === mealKey);
    if (!mealEntries.length) return;
    const mealCalories = Math.round(sumField(mealEntries, "calories"));
    out += mealConfig[mealKey].toUpperCase() + " :: " + mealCalories + " ккал\n";
    mealEntries.forEach((e) => {
      out += "  " + e.description + "\n";
      out += "  " + String(Math.round(e.weight_g)).padStart(weightW) + "г" + metricGap
        + "Б:" + String(round1(e.protein)).padStart(proteinW) + metricGap
        + "Ж:" + String(round1(e.fat)).padStart(fatW) + metricGap
        + "У:" + String(round1(e.carbs)).padStart(carbsW) + metricGap
        + "Кл:" + String(round1(e.fiber)).padStart(fiberW) + "\n";
    });
    out += "\n";
  });
  return out.trimEnd();
}

/* ── History panel ───────────────────────── */

function buildHistory(entries, profile, period) {
  const targets = getTargets(profile);
  const dailyTarget = targets.calories;
  const todayStr = today();
  let rows = [];
  if (period === "7" || period === "14" || period === "30") {
    const days = Number(period);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(todayStr + "T12:00:00");
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const dayEntries = entries.filter((e) => e.date === ds);
      const kcal = Math.round(sumField(dayEntries, "calories"));
      const hasData = dayEntries.length > 0;
      rows.push({ label: DAY_NAMES[d.getDay()] + " " + fmtDate(ds), value: kcal, target: dailyTarget, hasData, flag: "" });
    }
  } else if (period === "weeks") {
    const weeks = {};
    entries.forEach((e) => {
      const d = new Date(e.date + "T12:00:00");
      const weekStart = new Date(d);
      const shift = (d.getDay() + 6) % 7;
      weekStart.setDate(d.getDate() - shift);
      const key = weekStart.toISOString().slice(0, 10);
      if (!weeks[key]) weeks[key] = { kcal: 0, days: new Set(), start: new Date(weekStart) };
      weeks[key].kcal += Number(e.calories) || 0;
      weeks[key].days.add(e.date);
    });
    rows = Object.keys(weeks).sort().slice(-8).map((key) => {
      const loggedDays = weeks[key].days.size || 1;
      const avg = Math.round(weeks[key].kcal / loggedDays);
      return { label: fmtDate(key) + "–" + fmtDate(new Date(new Date(weeks[key].start).setDate(weeks[key].start.getDate() + 6)).toISOString().slice(0, 10)), value: avg, target: dailyTarget, hasData: true, detail: null, detailLabel: "", flag: "" };
    });
  } else {
    const months = {};
    entries.forEach((e) => {
      const key = e.date.slice(0, 7);
      if (!months[key]) {
        const [year, month] = key.split("-").map(Number);
        months[key] = { kcal: 0, days: new Set(), year, month: month - 1 };
      }
      months[key].kcal += Number(e.calories) || 0;
      months[key].days.add(e.date);
    });
    rows = Object.keys(months).sort().slice(-6).map((key) => {
      const m = months[key];
      const loggedDays = m.days.size || 1;
      const avg = Math.round(m.kcal / loggedDays);
      return { label: MONTH_SHORT[m.month].toUpperCase() + " " + String(m.year).slice(2), value: avg, target: dailyTarget, hasData: true, detail: null, detailLabel: "", flag: "" };
    });
  }
  if (!rows.length) return "Нет данных за выбранный период.";
  const labelW = Math.max(...rows.map((r) => r.label.length));
  const maxValue = Math.max(...rows.map((r) => Math.max(r.value, r.target)), 1);
  const barW = clamp(state.panelMetrics.rightChars - labelW - 5 - Math.max(...rows.map((r) => (String(r.value) + "  /  " + String(r.target)).length)), 12, state.panelMetrics.rightBarW);
  const valueW = Math.max(...rows.map((r) => String(r.value).length), String(dailyTarget).length);
  let out = makeSection("СТАТИСТИКА :: " + period.toUpperCase(), fitSectionWidth("history", state.panelMetrics.rightChars - 2, 28));
  rows.forEach((r) => {
    out += r.label.padEnd(labelW) + " |" + bar(r.value, maxValue, barW) + "| ";
    out += String(r.value).padStart(valueW) + "  /  " + String(r.target).padStart(valueW) + "\n";
  });
  out += "\n";
  if (period === "7" || period === "14" || period === "30") {
    out += "Пустые дни показаны отдельно.";
  } else {
    out += "Для недель и месяцев показано среднее.";
  }
  return out;
}

function buildWeightSeries(profile, dailyMetrics, period) {
  const metrics = dailyMetrics
    .filter((m) => m.date && Number(m.weight_kg))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, weight: Number(m.weight_kg) }));
  if (!metrics.length) {
    metrics.push({ date: today(), weight: Number(profile.current_weight_kg) || 79 });
  }
  const lastPoint = metrics[metrics.length - 1];
  const targets = getTargets(profile);
  const tdee = estimateTDEE(profile);
  const plannedDeficit = Math.max(0, tdee - targets.calories);
  const lookbackDays = { "7": 7, "14": 14, "30": 30, "weeks": 28, "months": 90 }[period] || 14;
  let actualCalories = 0, loggedDays = 0;
  for (let i = 0; i < lookbackDays; i++) {
    const ds = shiftDate(today(), -i);
    const dayCalories = Math.round(sumField(state.globalEntries.filter((e) => e.date === ds), "calories"));
    if (dayCalories > 0) { actualCalories += dayCalories; loggedDays += 1; }
  }
  const avgCalories = loggedDays ? Math.round(actualCalories / loggedDays) : targets.calories;
  const actualDeficit = Math.max(0, tdee - avgCalories);
  const deficitForForecast = actualDeficit || plannedDeficit || 250;
  const forecastPoints = [];
  for (let i = 0; i <= 6; i++) {
    const dayOffset = Math.round((90 / 6) * i);
    const date = new Date(lastPoint.date + "T12:00:00");
    date.setDate(date.getDate() + dayOffset);
    forecastPoints.push({ date: date.toISOString().slice(0, 10), weight: round1(Math.max((Number(profile.target_weight_kg) || 72) - 0.2, lastPoint.weight - (deficitForForecast * dayOffset) / 7700)) });
  }
  return { actual: metrics, forecast: forecastPoints, avgCalories, plannedDeficit, actualDeficit };
}

function renderWeightChart(actualPoints, forecastPoints, targetWeight, width, height) {
  const allPoints = [...actualPoints, ...forecastPoints];
  const timestamps = allPoints.map((p) => new Date(p.date + "T12:00:00").getTime());
  const startTs = Math.min(...timestamps);
  const endTs = Math.max(...timestamps);
  const weights = allPoints.map((p) => p.weight);
  const yMax = Math.max(...weights, targetWeight) + 0.5;
  const yMin = Math.min(...weights, targetWeight) - 0.5;
  const yRange = yMax - yMin || 1;
  const grid = Array.from({ length: height }, () => Array(width).fill(" "));

  function xForDate(dateStr) {
    const ts = new Date(dateStr + "T12:00:00").getTime();
    return endTs === startTs ? 0 : clamp(Math.round(((ts - startTs) / (endTs - startTs)) * (width - 1)), 0, width - 1);
  }
  function yForWeight(weight) {
    return clamp(Math.round(((yMax - weight) / yRange) * (height - 1)), 0, height - 1);
  }
  function drawSeries(points, pointChar, lineChars) {
    let previous = null;
    points.forEach((p) => {
      const x = xForDate(p.date);
      const y = yForWeight(p.weight);
      if (previous) {
        const dx = x - previous.x, dy = y - previous.y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
        for (let i = 1; i < steps; i++) {
          const ix = Math.round(previous.x + (dx * i) / steps);
          const iy = Math.round(previous.y + (dy * i) / steps);
          const slope = Math.abs(dy) / steps;
          const symbol = slope < 0.28 ? lineChars.flat : (dy > 0 ? lineChars.down : lineChars.up);
          if (grid[iy][ix] === " " || grid[iy][ix] === "\u00b7") grid[iy][ix] = symbol;
        }
      }
      grid[y][x] = pointChar;
      previous = { x, y };
    });
  }

  const targetRow = yForWeight(targetWeight);
  for (let x = 0; x < width; x++) grid[targetRow][x] = "\u00b7";

  const monthTicks = [];
  let monthCursor = new Date(new Date(actualPoints[0].date + "T12:00:00").getFullYear(), new Date(actualPoints[0].date + "T12:00:00").getMonth(), 1);
  const lastDate = new Date(forecastPoints[forecastPoints.length - 1].date + "T12:00:00");
  while (monthCursor <= lastDate) {
    const pos = xForDate(monthCursor.toISOString().slice(0, 10));
    monthTicks.push({ pos, label: MONTH_SHORT[monthCursor.getMonth()] });
    for (let row = 0; row < height; row++) {
      if (row !== targetRow && grid[row][pos] === " ") grid[row][pos] = "\u2506";
    }
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }

  drawSeries(forecastPoints, "\u25cb", { flat: "\u2504", up: "\u2571", down: "\u2572" });
  drawSeries(actualPoints, "\u25cf", { flat: "\u2500", up: "\u2571", down: "\u2572" });

  const yLabelW = 8;
  let out = "";
  for (let row = 0; row < height; row++) {
    const yValue = yMax - (row / (height - 1)) * yRange;
    const label = row % 2 === 0 ? (yValue.toFixed(1) + " кг").padStart(yLabelW) : " ".repeat(yLabelW);
    out += label + " \u2502" + grid[row].join("") + (row === targetRow ? "  цель" : "") + "\n";
  }

  const tickLine = Array(width).fill(" ");
  const labelLine = Array(width).fill(" ");
  let lastLabelEnd = -100;
  monthTicks.forEach(({ pos, label }) => {
    tickLine[pos] = "\u252c";
    if (pos - lastLabelEnd >= label.length + 1) {
      for (let i = 0; i < label.length && pos + i < width; i++) labelLine[pos + i] = label[i];
      lastLabelEnd = pos + label.length - 1;
    }
  });
  out += " ".repeat(yLabelW) + " \u2514" + "\u2500".repeat(width) + "\n";
  out += " ".repeat(yLabelW + 2) + tickLine.join("") + "\n";
  out += " ".repeat(yLabelW + 2) + labelLine.join("") + "\n";
  return out;
}

function buildWeight(profile, dailyMetrics, period) {
  const isMobile = window.innerWidth < 1200;
  const targetWeight = Number(profile.target_weight_kg) || 72;
  const currentWeight = Number(profile.current_weight_kg) || 79;
  const heightCm = Number(profile.height_cm) || 172;
  const series = buildWeightSeries(profile, dailyMetrics, period);
  const waistSeries = getWaistSeries(dailyMetrics);
  const chart = renderWeightChart(
    series.actual, series.forecast, targetWeight,
    isMobile ? Math.max(24, state.panelMetrics.chartW - 6) : state.panelMetrics.chartW,
    isMobile ? 7 : 9
  );
  const lastActual = series.actual[series.actual.length - 1];
  const delta = round1(lastActual.weight - series.actual[0].weight);
  const currentBmi = round1(bmi(lastActual.weight, heightCm));
  const targetBmi = round1(bmi(targetWeight, heightCm));
  const bmiMin = 18.5, bmiMax = 29;
  const bmiValue = Math.max(bmiMin, Math.min(currentBmi, bmiMax));
  const metricLabelW = 14;
  const bmiValueText = String(currentBmi) + " / " + String(targetBmi);
  const waistValueTextBase = waistSeries.length ? (String(round1(waistSeries[waistSeries.length - 1].waist)) + " см") : "нет данных";
  const metricValueW = Math.max(bmiValueText.length, waistValueTextBase.length, 10);
  const bmiBarW = clamp(state.panelMetrics.rightChars - metricLabelW - metricValueW - 7, 10, state.panelMetrics.rightBarW - 2);

  function bmiLabel(value) {
    if (value < 18.5) return "ниже нормы";
    if (value < 25) return "норма";
    if (value < 30) return "избыток";
    return "высокий";
  }

  let out = makeSection("ВЕС", fitSectionWidth("weight", state.panelMetrics.rightChars - 2, 24));
  out += "Последний вес: " + lastActual.weight + " кг   Цель: " + targetWeight + " кг\n";
  out += "Старт в истории: " + series.actual[0].weight + " кг   Изменение: " + (delta > 0 ? "+" : "") + delta + " кг\n\n";
  out += chart + "\n";
  out += "ИМТ".padEnd(metricLabelW) + " |" + bar(bmiValue - bmiMin, bmiMax - bmiMin, bmiBarW) + "|  ";
  out += bmiValueText.padStart(metricValueW) + "\n";
  out += "СТАТУС ИМТ".padEnd(metricLabelW) + " " + bmiLabel(currentBmi) + "\n";
  if (waistSeries.length) {
    const lastWaist = waistSeries[waistSeries.length - 1];
    const prevWaist = waistSeries.length > 1 ? waistSeries[waistSeries.length - 2] : null;
    const waistDelta = prevWaist ? round1(lastWaist.waist - prevWaist.waist) : 0;
    const waistMin = 75, waistMax = 115;
    const waistBarW = clamp(state.panelMetrics.rightChars - metricLabelW - metricValueW - 7, 10, state.panelMetrics.rightBarW - 2);
    const waistValue = Math.max(waistMin, Math.min(lastWaist.waist, waistMax));
    const waistValueText = String(round1(lastWaist.waist)) + " см";
    out += "ТАЛИЯ".padEnd(metricLabelW) + " |" + bar(waistValue - waistMin, waistMax - waistMin, waistBarW) + "|  ";
    out += waistValueText.padStart(metricValueW);
    out += prevWaist ? "  " + (waistDelta > 0 ? "+" : "") + waistDelta + " см" : "";
    out += "\n";
  } else {
    out += "ТАЛИЯ".padEnd(metricLabelW) + " |" + "\u2591".repeat(bmiBarW) + "|  нет данных\n";
  }
  out += "Факт по еде: " + series.avgCalories + " ккал/д   дефицит " + series.actualDeficit + " ккал/д\n";
  out += "План в профиле: " + currentWeight + " \u2192 " + targetWeight + " кг   дефицит " + series.plannedDeficit + " ккал/д\n";
  return out;
}

/* ── Animations and glitch ───────────────── */

function animatePre(element, text) {
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

function startBitGlitch() {
  if (state.bitGlitchTimer) clearInterval(state.bitGlitchTimer);
  state.bitGlitchTimer = setInterval(runBitGlitch, 950);
}

/* ── Tabs and mobile view ────────────────── */

function bindDayTabs() {
  document.querySelectorAll("#day-tabs .ptab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.day === state.currentDayView);
    tab.onclick = () => {
      state.currentDayView = tab.dataset.day;
      if (state.globalProfile) render(state.globalProfile, state.globalEntries, state.globalDailyMetrics, state.currentPeriod);
    };
  });
}

function bindPeriodTabs() {
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

function syncMobileView() {
  const app = document.getElementById("app");
  const isMobile = window.innerWidth < 1200;
  if (app) app.dataset.mobileView = isMobile ? state.currentMobileView : "all";
  document.querySelectorAll("#mobile-view-tabs .mview-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mobileView === state.currentMobileView);
  });
  renderMobileSecondaryTabs();
}

function bindMobileViewTabs() {
  document.querySelectorAll("#mobile-view-tabs .mview-tab").forEach((tab) => {
    tab.onclick = () => { state.currentMobileView = tab.dataset.mobileView; syncMobileView(); if (state.globalProfile) render(state.globalProfile, state.globalEntries, state.globalDailyMetrics, state.currentPeriod); };
  });
}

/* ── Main render ─────────────────────────── */

function render(profile, entries, dailyMetrics, period) {
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

function renderInteractiveMeals(entries) {
  const container = document.getElementById("meals-interactive");
  if (!container) return;
  const mealOrder = ["breakfast","lunch","dinner","snack"];
  const mealLabels = {breakfast:"Завтрак",lunch:"Обед",dinner:"Ужин",snack:"Перекусы"};
  let html = "";
  mealOrder.forEach(key => {
    const mealEntries = entries.filter(e => e.meal === key);
    if (!mealEntries.length) return;
    html += '<div class="meal-header-row"><span>' + mealLabels[key].toUpperCase() + '</span> <span>' + Math.round(mealEntries.reduce((s,e) => s + Number(e.calories||0), 0)) + ' ккал</span></div>';
    mealEntries.forEach(e => {
      html += '<div class="meal-entry" data-entry-id="' + e.id + '">';
      html += '<div class="meal-entry-main"><div class="meal-entry-title">' + escapeHtml(e.description) + '</div>';
      html += '<div class="meal-entry-meta">' + Math.round(e.weight_g) + 'г Б:' + round1(e.protein) + ' Ж:' + round1(e.fat) + ' У:' + round1(e.carbs) + ' Кл:' + round1(e.fiber) + '</div></div>';
      html += '<div class="meal-entry-cal">' + Math.round(Number(e.calories) || 0) + '</div></div>';
    });
  });
  if (!html) {
    html = '<div style="color:var(--term-dim);padding:0.5em 0;font-size:0.9em">Нет записей за этот день. Нажми + чтобы добавить.</div>';
  }
  container.innerHTML = html;
  container.querySelectorAll(".meal-entry").forEach(el => {
    el.addEventListener("click", function() {
      const entry = state.globalEntries.find(e => e.id === this.dataset.entryId);
      if (entry) openEntryEditor(entry);
    });
  });
}

function openEntryEditor(entry) {
  const overlay = document.getElementById("modal-overlay");
  const box = document.getElementById("modal-box");
  const isNew = !entry;
  const e = entry || {date: state.currentDayView === "yesterday" ? shiftDate(today(), -1) : today(), meal:"breakfast", description:"", weight_g:0, calories:0, protein:0, fat:0, carbs:0, fiber:0, sugar:0, sodium_mg:0, saturated_fat:0};
  box.innerHTML = '<h2>' + (isNew ? 'ДОБАВИТЬ ЗАПИСЬ' : 'РЕДАКТИРОВАТЬ') + '</h2>' +
    '<label>Дата <input id="m-date" type="date" value="' + e.date + '"></label>' +
    '<label>Приём пищи <select id="m-meal">' +
      ['breakfast','lunch','dinner','snack'].map(m => '<option' + (m===e.meal?' selected':'') + '>' + m + '</option>').join('') +
    '</select></label>' +
    '<label>Описание <textarea id="m-desc" rows="2">' + escapeHtml(e.description) + '</textarea></label>' +
    '<label>Вес (г) <input id="m-weight" type="number" step="1" value="' + Math.round(e.weight_g) + '"></label>' +
    '<label>Калории <input id="m-cal" type="number" step="1" value="' + Math.round(e.calories) + '"></label>' +
    '<label>Белки (г) <input id="m-protein" type="number" step="0.1" value="' + round1(e.protein) + '"></label>' +
    '<label>Жиры (г) <input id="m-fat" type="number" step="0.1" value="' + round1(e.fat) + '"></label>' +
    '<label>Углеводы (г) <input id="m-carbs" type="number" step="0.1" value="' + round1(e.carbs) + '"></label>' +
    '<label>Клетчатка (г) <input id="m-fiber" type="number" step="0.1" value="' + round1(e.fiber) + '"></label>' +
    '<label>Сахар (г) <input id="m-sugar" type="number" step="0.1" value="' + round1(e.sugar) + '"></label>' +
    '<label>Натрий (мг) <input id="m-sodium" type="number" step="1" value="' + Math.round(e.sodium_mg) + '"></label>' +
    '<label>Насыщ. жиры (г) <input id="m-satfat" type="number" step="0.1" value="' + round1(e.saturated_fat) + '"></label>' +
    '<div class="modal-actions">' +
      '<button class="primary" id="m-save">СОХРАНИТЬ</button>' +
      (!isNew ? '<button class="danger" id="m-delete">УДАЛИТЬ</button>' : '') +
      '<button id="m-cancel">ОТМЕНА</button>' +
    '</div>';
  overlay.classList.add("active");
  document.getElementById("m-cancel").onclick = () => overlay.classList.remove("active");
  document.getElementById("m-save").onclick = async () => {
    const data = {
      date: document.getElementById("m-date").value,
      meal: document.getElementById("m-meal").value,
      description: document.getElementById("m-desc").value,
      weight_g: parseFloat(document.getElementById("m-weight").value) || 0,
      calories: parseFloat(document.getElementById("m-cal").value) || 0,
      protein: parseFloat(document.getElementById("m-protein").value) || 0,
      fat: parseFloat(document.getElementById("m-fat").value) || 0,
      carbs: parseFloat(document.getElementById("m-carbs").value) || 0,
      fiber: parseFloat(document.getElementById("m-fiber").value) || 0,
      sugar: parseFloat(document.getElementById("m-sugar")?.value) || 0,
      sodium_mg: parseFloat(document.getElementById("m-sodium")?.value) || 0,
      saturated_fat: parseFloat(document.getElementById("m-satfat")?.value) || 0,
    };
    try {
      if (isNew) { await apiPost("/api/entries", data); }
      else { await apiPut("/api/entries/" + e.id, data); }
      overlay.classList.remove("active");
      await loadData();
    } catch (err) { alert("Ошибка: " + err.message); }
  };
  if (!isNew) {
    document.getElementById("m-delete").onclick = async () => {
      if (!confirm("Удалить запись?")) return;
      try {
        await apiDelete("/api/entries/" + e.id);
        overlay.classList.remove("active");
        await loadData();
      } catch (err) { alert("Ошибка: " + err.message); }
    };
  }
}

/* ── AI Chat ─────────────────────────────── */

function openAIChat() {
  const overlay = document.getElementById("modal-overlay");
  const box = document.getElementById("modal-box");
  box.className = "modal-box ai-modal";
  box.innerHTML =
    '<div class="ai-chat-header"><span>🥗 AI Ассистент</span><button id="ai-modal-close">✕</button></div>' +
    '<div class="ai-chat-msgs" id="ai-msg-area">' +
      '<div class="ai-msg ai-msg-assistant" style="color:var(--term-dim);">Напиши, что хочешь добавить.</div>' +
    '</div>' +
    '<div class="ai-loading" id="ai-loading">⏳ Думаю...</div>' +
    '<div class="ai-chat-input-row">' +
      '<input id="ai-input" type="text" placeholder="Добавить еду..." autocomplete="off">' +
      '<button id="ai-send">→</button>' +
    '</div>';
  overlay.classList.add("active");
  document.getElementById("ai-modal-close").onclick = closeAIChat;
  document.getElementById("ai-send").onclick = sendAIMessage;
  document.getElementById("ai-input").onkeydown = (e) => { if (e.key === "Enter") sendAIMessage(); };
  document.getElementById("ai-input").focus();
}

function closeAIChat() {
  document.getElementById("modal-overlay").classList.remove("active");
}

function normalizeTone(text) {
  return text
    .replace(/\b(добавлен[аоы]?|добавил[аи]?)\b/gi, "предлагаю добавить")
    .replace(/\b(обновлен[аоы]?|обновил[аи]?|изменен[аоы]?|изменил[аи]?)\b/gi, "предлагаю изменить")
    .replace(/\b(удален[аоы]?|удалил[аи]?)\b/gi, "предлагаю удалить")
    .replace(/\b(создан[аоы]?|создал[аи]?)\b/gi, "предлагаю создать");
}

function addAIMessage(role, text, changes) {
  const container = document.getElementById("ai-msg-area");
  if (!container) return;
  const div = document.createElement("div");
  div.className = "ai-msg ai-msg-" + role;
  if (role === "user") {
    div.textContent = "> " + text;
  } else {
    let html = '<div class="ai-msg-explanation">' + escapeHtml(normalizeTone(text)) + '</div>';
    if (changes && changes.length) {
      html += '<ul class="ai-msg-changes">';
      changes.forEach((c) => {
        const label = ({add_entry:"➕ Добавить", update_entry:"✏️ Изменить", delete_entry:"🗑️ Удалить", update_profile:"⚙️ Профиль", update_metric:"📊 Метрика"})[c.type] || c.type;
        let detail = escapeHtml(normalizeTone(c.description || ""));
        if (c.type === "add_entry" && c.data) {
          const d = c.data;
          detail += ' <span class="ai-macros">' + Math.round(d.calories || 0) + ' ккал · Б:' + round1(d.protein) + ' · Ж:' + round1(d.fat) + ' · У:' + round1(d.carbs) + '</span>';
        }
        html += '<li>' + label + ' — ' + detail + '</li>';
      });
      html += '</ul>';
      html += '<button class="ai-apply-btn">ПРИМЕНИТЬ</button>';
    }
    div.innerHTML = html;
    const applyBtn = div.querySelector(".ai-apply-btn");
    if (applyBtn) {
      applyBtn._changes = changes;
      applyBtn.onclick = async function() {
        try {
          const result = await apiPost("/api/ai/apply", {changes: this._changes});
          addAIMessage("assistant", "✅ Применено: " + result.applied + " изменений" + (result.errors?.length ? ", ошибок: " + result.errors.length : ""), null);
          await loadData();
          setTimeout(closeAIChat, 800);
        } catch (err) { addAIMessage("assistant", "❌ Ошибка: " + err.message, null); }
      };
    }
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendAIMessage() {
  const input = document.getElementById("ai-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  addAIMessage("user", text, null);
  const loading = document.getElementById("ai-loading");
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (loading) {
      loading.textContent = attempt === 0 ? "⏳ Думаю..." : `⏳ Повтор ${attempt}/${maxRetries}...`;
      loading.classList.add("active");
    }
    try {
      const result = await apiPost("/api/ai/parse", {message: text});
      if (loading) loading.classList.remove("active");
      addAIMessage("assistant", result.explanation || "Изменений не найдено.", (result.changes || []).length ? result.changes : null);
      return;
    } catch (err) {
      if (loading) loading.classList.remove("active");
      const isRetriable = err.message.includes("5") || err.message.includes("timeout") || err.message.includes("network") || err.message.includes("Failed to fetch");
      if (attempt < maxRetries && isRetriable) {
        await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
        continue;
      }
      addAIMessage("assistant", "❌ Ошибка: " + err.message, null);
      return;
    }
  }
}

/* ── Auth ────────────────────────────────── */

function handleUnauthorized() {
  state.globalProfile = null;
  document.getElementById("app-shell-wrapper").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");
}

function showAuthError(msg) {
  document.getElementById("auth-error").textContent = msg;
}

async function handleAuthSubmit() {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!email || !password) { showAuthError("Заполните email и пароль"); return; }
  showAuthError("");
  const endpoint = state.isRegisterMode ? "/api/auth/register" : "/api/auth/login";
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email, password}),
      credentials: "include",
    });
    if (!r.ok) {
      const err = await r.json();
      showAuthError(err.detail || "Ошибка авторизации");
      return;
    }
    const user = await r.json();
    state.currentUserEmail = user.email;
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app-shell-wrapper").classList.remove("hidden");
    loadData();
  } catch (e) { showAuthError("Ошибка соединения: " + e.message); }
}

function toggleAuthMode() {
  state.isRegisterMode = !state.isRegisterMode;
  document.getElementById("auth-submit").textContent = state.isRegisterMode ? "ЗАРЕГИСТРИРОВАТЬСЯ" : "ВОЙТИ";
  const toggleLink = document.getElementById("auth-toggle-link");
  toggleLink.textContent = state.isRegisterMode ? "Войти" : "Зарегистрироваться";
  toggleLink.parentElement.innerHTML = (state.isRegisterMode ? "Уже есть аккаунт? " : "Нет аккаунта? ") + '<a id="auth-toggle-link">' + (state.isRegisterMode ? "Войти" : "Зарегистрироваться") + "</a>";
  document.getElementById("auth-toggle-link").addEventListener("click", toggleAuthMode);
  showAuthError("");
}

async function handleLogout() {
  try {
    const csrf = (document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/) || [])[1] || "";
    await fetch("/api/auth/logout", { method: "POST", headers: {"X-CSRF-Token": csrf}, credentials: "include" });
  } catch (_) {}
  state.currentUserEmail = null;
  state.globalProfile = null;
  state.globalEntries = [];
  state.globalDailyMetrics = [];
  document.getElementById("user-email").textContent = "";
  document.getElementById("app-shell-wrapper").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");
}

async function checkAuth() {
  try {
    const r = await fetch("/api/auth/me", { credentials: "include" });
    if (!r.ok) throw new Error("not authenticated");
    const user = await r.json();
    state.currentUserEmail = user.email;
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app-shell-wrapper").classList.remove("hidden");
    loadData();
  } catch (_) {
    document.getElementById("auth-screen").classList.remove("hidden");
    document.getElementById("app-shell-wrapper").classList.add("hidden");
  }
}

/* ── loadData ────────────────────────────── */

async function loadData() {
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
