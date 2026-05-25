import { state } from "./state.js";

let _onUnauthorized = null;

export function setOnUnauthorized(cb) {
  _onUnauthorized = cb;
}

function getCSRFToken() {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return m ? m[1] : "";
}

export async function apiGet(path) {
  const r = await fetch(path + "?t=" + Date.now(), {credentials: "include"});
  if (r.status === 401) { if (_onUnauthorized) _onUnauthorized(); throw new Error("Unauthorized"); }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiPost(path, data) {
  const r = await fetch(path, { method: "POST", headers: {"Content-Type":"application/json","X-CSRF-Token": getCSRFToken()}, body: JSON.stringify(data), credentials: "include" });
  if (r.status === 401) { if (_onUnauthorized) _onUnauthorized(); throw new Error("Unauthorized"); }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiPut(path, data) {
  const r = await fetch(path, { method: "PUT", headers: {"Content-Type":"application/json","X-CSRF-Token": getCSRFToken()}, body: JSON.stringify(data), credentials: "include" });
  if (r.status === 401) { if (_onUnauthorized) _onUnauthorized(); throw new Error("Unauthorized"); }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiDelete(path) {
  const r = await fetch(path, { method: "DELETE", headers: {"X-CSRF-Token": getCSRFToken()}, credentials: "include" });
  if (r.status === 401) { if (_onUnauthorized) _onUnauthorized(); throw new Error("Unauthorized"); }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
