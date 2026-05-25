import { escapeHtml, round1 } from "../utils.js";
import { apiPost } from "../api.js";
import { loadData } from "../app.js";

const STARTER_SUGGESTIONS =
  '<div class="ai-msg ai-msg-assistant" style="color:var(--term-dim);">' +
    'Я помогу с едой и замерами. Примеры команд:<br>' +
    '• <em>добавь 200г куриной грудки на обед</em><br>' +
    '• <em>замени ужин: 150g лосося + 100g риса</em><br>' +
    '• <em>удали последнюю запись</em><br>' +
    '• <em>вес сегодня 81.2 кг</em><br>' +
    '• <em>обнови профиль: цель — похудение</em>' +
  '</div>';

export function openAIChat() {
  const overlay = document.getElementById("modal-overlay");
  const box = document.getElementById("modal-box");
  box.className = "modal-box ai-modal";
  box.innerHTML =
    '<div class="ai-chat-header"><span>🥗 AI Ассистент</span><button id="ai-modal-close">✕</button></div>' +
    '<div class="ai-chat-msgs" id="ai-msg-area">' +
      STARTER_SUGGESTIONS +
    '</div>' +
    '<div class="ai-loading" id="ai-loading">⏳ Думаю...</div>' +
    '<div class="ai-chat-input-row">' +
      '<input id="ai-input" type="text" placeholder="Добавить еду, вес, цели..." autocomplete="off">' +
      '<button id="ai-send">→</button>' +
    '</div>';
  overlay.classList.add("active");
  document.getElementById("ai-modal-close").onclick = closeAIChat;
  document.getElementById("ai-send").onclick = sendAIMessage;
  document.getElementById("ai-input").onkeydown = (e) => { if (e.key === "Enter") sendAIMessage(); };
  document.getElementById("ai-input").focus();
}

export function closeAIChat() {
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
