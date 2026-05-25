import { round1, escapeHtml, shiftDate, today } from "../utils.js";
import { state } from "../state.js";
import { apiPost, apiPut, apiDelete } from "../api.js";
import { loadData } from "../app.js";

export function renderInteractiveMeals(entries) {
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
      html += '<div class="meal-entry-meta">' +
        '<span class="meta-cell">' + Math.round(e.weight_g) + 'г</span>' +
        '<span class="meta-cell">Б:' + round1(e.protein) + '</span>' +
        '<span class="meta-cell">Ж:' + round1(e.fat) + '</span>' +
        '<span class="meta-cell">У:' + round1(e.carbs) + '</span>' +
        '<span class="meta-cell">Кл:' + round1(e.fiber) + '</span>' +
        '</div></div>';
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

export function openEntryEditor(entry) {
  const overlay = document.getElementById("modal-overlay");
  const box = document.getElementById("modal-box");
  box.className = "modal-box";
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
