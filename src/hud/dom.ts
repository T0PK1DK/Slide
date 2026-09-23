import { TRAILS, type GarageConfig } from "../lib/garage";

export function $(sel: string): HTMLElement {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el as HTMLElement;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export function applyTheme(cfg: GarageConfig) {
  document.documentElement.style.setProperty("--glow", cfg.glow);
  document.documentElement.style.setProperty("--mint", TRAILS[cfg.trail].line);
}

export function showCoach(on: boolean) {
  $("#coach").toggleAttribute("hidden", !on);
}

export function setStatus(text: string) {
  const statusEl = $("#status");
  statusEl.textContent = text;
  statusEl.classList.toggle("show", Boolean(text));
}

export function showError(text: string) {
  const errorEl = $("#error");
  errorEl.textContent = text;
  errorEl.toggleAttribute("hidden", !text);
}

export function showNetBanner(text: string) {
  const el = $("#net-banner");
  el.textContent = text;
  el.toggleAttribute("hidden", !text);
}

export type HudMode = "plan" | "review" | "drive";
