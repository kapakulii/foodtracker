import { DAY_NAMES, MONTH_SHORT, today, shiftDate, clamp, round1, sumField, fmtDate, fmtDateLong, makeSection, fitSectionWidth, bar, getTargets, getTodayMetrics, estimateTDEE, roundDisplay, bmi, getWaistSeries, getViewportMode } from "../utils.js";
import { state } from "../state.js";

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

export { buildToday, buildMeals, buildHistory, buildWeightSeries, renderWeightChart, buildWeight };
