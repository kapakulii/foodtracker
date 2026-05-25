import { state } from "../state.js";
import { loadData } from "../app.js";

export function handleUnauthorized() {
  state.globalProfile = null;
  document.body.classList.add("auth-screen-shown");
  document.getElementById("app-shell-wrapper").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");
}

function showAuthError(msg) {
  document.getElementById("auth-error").textContent = msg;
}

export async function handleAuthSubmit() {
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
    document.body.classList.remove("auth-screen-shown");
    loadData();
  } catch (e) { showAuthError("Ошибка соединения: " + e.message); }
}

export function toggleAuthMode() {
  state.isRegisterMode = !state.isRegisterMode;
  document.getElementById("auth-submit").textContent = state.isRegisterMode ? "ЗАРЕГИСТРИРОВАТЬСЯ" : "ВОЙТИ";
  const toggleLink = document.getElementById("auth-toggle-link");
  toggleLink.textContent = state.isRegisterMode ? "Войти" : "Зарегистрироваться";
  toggleLink.parentElement.innerHTML = (state.isRegisterMode ? "Уже есть аккаунт? " : "Нет аккаунта? ") + '<a id="auth-toggle-link">' + (state.isRegisterMode ? "Войти" : "Зарегистрироваться") + "</a>";
  document.getElementById("auth-toggle-link").addEventListener("click", toggleAuthMode);
  showAuthError("");
}

export async function handleLogout() {
  try {
    const csrf = (document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/) || [])[1] || "";
    await fetch("/api/auth/logout", { method: "POST", headers: {"X-CSRF-Token": csrf}, credentials: "include" });
  } catch {}
  state.currentUserEmail = null;
  state.globalProfile = null;
  state.globalEntries = [];
  state.globalDailyMetrics = [];
  document.body.classList.add("auth-screen-shown");
  document.getElementById("user-email").textContent = "";
  document.getElementById("app-shell-wrapper").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");
}

export async function checkAuth() {
  try {
    const r = await fetch("/api/auth/me", { credentials: "include" });
    if (!r.ok) throw new Error("not authenticated");
    const user = await r.json();
    state.currentUserEmail = user.email;
    return true;
  } catch {
    return false;
  }
}
