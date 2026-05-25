import { state } from "../state.js";
import { apiPut } from "../api.js";
import { loadData } from "../app.js";

export function openGoalEditor() {
  const profile = state.globalProfile;
  if (!profile) return;
  const overlay = document.getElementById("modal-overlay");
  const box = document.getElementById("modal-box");
  box.className = "modal-box";
  box.innerHTML =
    '<h2>ЦЕЛИ</h2>' +
    '<label>Цель (описание) <input id="g-goal" type="text" value="' + (profile.goal || "") + '" placeholder="напр. похудение, поддержание"></label>' +
    '<label>Калории (ккал/д) <input id="g-cal" type="number" step="10" value="' + (profile.daily_calorie_target || "") + '"></label>' +
    '<label>Белки (г/д) <input id="g-protein" type="number" step="5" value="' + (profile.protein_target_g || "") + '"></label>' +
    '<label>Жиры (г/д) <input id="g-fat" type="number" step="5" value="' + (profile.fat_target_g || "") + '"></label>' +
    '<label>Углеводы (г/д) <input id="g-carbs" type="number" step="5" value="' + (profile.carbs_target_g || "") + '"></label>' +
    '<label>Вес цели (кг) <input id="g-target-weight" type="number" step="0.1" value="' + (profile.target_weight_kg || "") + '"></label>' +
    '<div class="modal-actions">' +
      '<button class="primary" id="g-save">СОХРАНИТЬ</button>' +
      '<button id="g-cancel">ОТМЕНА</button>' +
    '</div>';
  overlay.classList.add("active");
  document.getElementById("g-cancel").onclick = () => overlay.classList.remove("active");
  document.getElementById("g-save").onclick = async () => {
    const data = {
      goal: document.getElementById("g-goal").value || null,
      daily_calorie_target: parseInt(document.getElementById("g-cal").value) || null,
      protein_target_g: parseInt(document.getElementById("g-protein").value) || null,
      fat_target_g: parseInt(document.getElementById("g-fat").value) || null,
      carbs_target_g: parseInt(document.getElementById("g-carbs").value) || null,
      target_weight_kg: parseFloat(document.getElementById("g-target-weight").value) || null,
    };
    try {
      await apiPut("/api/profile", data);
      overlay.classList.remove("active");
      await loadData();
    } catch (err) { alert("Ошибка: " + err.message); }
  };
}
