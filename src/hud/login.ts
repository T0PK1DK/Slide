import {
  accountLabel,
  currentCloudUser,
  PASSWORD_MAX,
  PASSWORD_MIN,
  prepareAccount,
  signInWithUsername,
  signOutAccount,
  signUpWithUsername,
  type CloudUser,
} from "../lib/account";
import { cloudConfigured } from "../lib/cloud";
import {
  eraseDeviceData,
  hashPin,
  isSignedIn,
  isStandalone,
  loadProfile,
  requestPersistentStorage,
  saveProfile,
  setSignedIn,
  touchProfile,
  type DriverProfile,
} from "../lib/profile";

type Done = (p: DriverProfile) => void;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Gate the app. When accounts are on, restore the Supabase session first,
 * show Sign in / Create account (username + password, no email), then the
 * on-device driver card. Returning drivers skip straight in.
 */
export function ensureSignedIn(root: HTMLElement, onReady: Done) {
  void bootGate(root, onReady);
}

async function bootGate(root: HTMLElement, onReady: Done) {
  let user: CloudUser | null = null;
  if (cloudConfigured()) {
    try {
      user = await prepareAccount();
    } catch {
      user = currentCloudUser();
    }
  }
  const existing = loadProfile();
  if (existing && isSignedIn() && (!cloudConfigured() || user)) {
    onReady(touchProfile(existing));
    void requestPersistentStorage();
    return;
  }
  const gate = document.createElement("div");
  gate.className = "login";
  gate.setAttribute("role", "dialog");
  gate.setAttribute("aria-modal", "true");
  gate.setAttribute("aria-labelledby", "login-title");
  root.appendChild(gate);
  if (cloudConfigured() && !user) {
    renderAccount(gate, onReady);
    return;
  }
  if (existing) renderWelcomeBack(gate, existing, onReady);
  else renderCreate(gate, onReady);
}

/** Lock the app: keeps every saved thing, shows "Welcome back" next time. */
export function lockApp() {
  setSignedIn(false);
  location.reload();
}

function finish(gate: HTMLElement, p: DriverProfile, onReady: Done) {
  setSignedIn(true);
  const next = touchProfile(p);
  void requestPersistentStorage();
  gate.classList.add("leaving");
  window.setTimeout(() => gate.remove(), 220);
  onReady(next);
}

function homeScreenHint(): string {
  if (isStandalone()) return "";
  return `<p class="login-hint">Tip: add Slide to your Home Screen (Share → Add to Home Screen) so this phone keeps you signed in.</p>`;
}

function showError(el: HTMLElement, msg: string) {
  el.textContent = msg;
  el.hidden = !msg;
}

export function renderAccount(gate: HTMLElement, onReady: Done, mode: "in" | "up" = "in") {
  const up = mode === "up";
  gate.innerHTML = `
    <form class="login-card" novalidate>
      <span class="login-kicker">SLIDE</span>
      <h1 id="login-title">${up ? "Create your account" : "Sign in"}</h1>
      <p class="login-sub">${up ? "Pick a username and a password. No email needed." : "Use your Slide username and password."}</p>
      <div class="login-modes" role="group" aria-label="Sign in or create an account">
        <button type="button" data-mode="in" class="${up ? "" : "on"}" aria-pressed="${!up}">Sign in</button>
        <button type="button" data-mode="up" class="${up ? "on" : ""}" aria-pressed="${up}">Create account</button>
      </div>
      <label class="login-field"><span>Username</span>
        <input name="username" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" maxlength="21" placeholder="king_slides" required />
      </label>
      <label class="login-field"><span>Password</span>
        <input name="password" type="password" autocomplete="${up ? "new-password" : "current-password"}" minlength="${PASSWORD_MIN}" maxlength="${PASSWORD_MAX}" placeholder="${up ? `At least ${PASSWORD_MIN} characters` : ""}" required />
      </label>
      ${up ? `<p class="login-hint">Usernames are 3–20 letters, numbers or _. There's no email reset yet, so keep your password somewhere safe.</p>` : ""}
      <p class="login-error" role="alert" hidden></p>
      <button class="primary login-go" type="submit">${up ? "Create account" : "Sign in"}</button>
      ${homeScreenHint()}
    </form>`;
  const form = gate.querySelector("form")!;
  const err = gate.querySelector<HTMLElement>(".login-error")!;
  const userInput = gate.querySelector<HTMLInputElement>('[name="username"]')!;
  userInput.focus();
  gate.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      const next = b.dataset.mode === "up" ? "up" : "in";
      if (next === mode) return;
      const typed = userInput.value;
      renderAccount(gate, onReady, next);
      gate.querySelector<HTMLInputElement>('[name="username"]')!.value = typed;
    })
  );
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const username = String(data.get("username") ?? "");
    const password = String(data.get("password") ?? "");
    const btn = form.querySelector<HTMLButtonElement>(".login-go")!;
    btn.disabled = true;
    showError(err, "");
    try {
      if (up) await signUpWithUsername(username, password);
      else await signInWithUsername(username, password);
    } catch (ex) {
      btn.disabled = false;
      return showError(err, ex instanceof Error ? ex.message : "That didn't work. Try again.");
    }
    afterAccount(gate, onReady);
  });
}

function afterAccount(gate: HTMLElement, onReady: Done) {
  const existing = loadProfile();
  if (existing && isSignedIn()) {
    finish(gate, existing, onReady);
    return;
  }
  if (existing) renderWelcomeBack(gate, existing, onReady);
  else renderCreate(gate, onReady);
}

function renderCreate(gate: HTMLElement, onReady: Done) {
  const who = accountLabel(currentCloudUser());
  gate.innerHTML = `
    <form class="login-card" novalidate>
      <span class="login-kicker">SLIDE</span>
      <h1 id="login-title">Set up your driver</h1>
      <p class="login-sub">${who ? `Signed in as ${esc(who)}. Name and car stay on this phone, private to your account.` : cloudConfigured() ? "Name and car stay on this phone, private to your account." : "Everything stays on this phone. No email, no password."}</p>
      <label class="login-field"><span>Your name</span>
        <input name="name" autocomplete="nickname" maxlength="24" required placeholder="King" />
      </label>
      <label class="login-field"><span>Car tag</span>
        <input name="tag" autocapitalize="characters" maxlength="10" placeholder="SLIDE-01" />
      </label>
      <label class="login-field"><span>4-digit PIN (optional)</span>
        <input name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password" placeholder="Skip to stay signed in" />
      </label>
      <p class="login-error" role="alert" hidden></p>
      <button class="primary login-go" type="submit">Start driving</button>
      ${cloudConfigured() ? `<button class="ghost login-reset" type="button" data-signout>Sign out</button>` : ""}
      ${homeScreenHint()}
    </form>`;
  const form = gate.querySelector("form")!;
  const err = gate.querySelector<HTMLElement>(".login-error")!;
  gate.querySelector<HTMLInputElement>('[name="name"]')!.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const tag = String(data.get("tag") ?? "").trim().toUpperCase() || "SLIDE-01";
    const pin = String(data.get("pin") ?? "").trim();
    if (!name) return showError(err, "Add a name so Slide can greet you.");
    if (pin && !/^\d{4}$/.test(pin)) return showError(err, "PIN is 4 digits, or leave it empty.");
    const now = Date.now();
    const profile: DriverProfile = {
      name,
      tag,
      pinHash: pin ? await hashPin(pin) : null,
      createdAt: now,
      lastSeen: now,
      car: null,
    };
    saveProfile(profile);
    finish(gate, profile, onReady);
  });
  gate.querySelector("[data-signout]")?.addEventListener("click", () => void signOutFromGate(gate, onReady));
}

function renderWelcomeBack(gate: HTMLElement, p: DriverProfile, onReady: Done) {
  const who = accountLabel(currentCloudUser());
  gate.innerHTML = `
    <form class="login-card" novalidate>
      <span class="login-kicker">${esc(p.tag)}</span>
      <h1 id="login-title">Welcome back, ${esc(p.name)}</h1>
      <p class="login-sub">${who ? `Signed in as ${esc(who)}. ` : ""}Your garage, places and ghosts are saved ${cloudConfigured() ? "for this account" : "on this phone"}.</p>
      ${p.pinHash ? `<label class="login-field"><span>PIN</span>
        <input name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="current-password" />
      </label>` : ""}
      <p class="login-error" role="alert" hidden></p>
      <button class="primary login-go" type="submit">Continue</button>
      ${cloudConfigured() ? `<button class="ghost login-reset" type="button" data-signout>Sign out</button>` : ""}
      <button class="ghost login-reset" type="button">Not ${esc(p.name)}? Start over</button>
      ${homeScreenHint()}
    </form>`;
  const form = gate.querySelector("form")!;
  const err = gate.querySelector<HTMLElement>(".login-error")!;
  gate.querySelector<HTMLInputElement>('[name="pin"]')?.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (p.pinHash) {
      const pin = String(new FormData(form).get("pin") ?? "").trim();
      if ((await hashPin(pin)) !== p.pinHash) return showError(err, "That PIN doesn't match.");
    }
    finish(gate, p, onReady);
  });
  gate.querySelector("[data-signout]")?.addEventListener("click", () => void signOutFromGate(gate, onReady));
  gate.querySelector(".login-reset:not([data-signout])")?.addEventListener("click", () => {
    if (!confirm(`Erase ${p.name}'s garage, places and ghosts from this phone?`)) return;
    eraseDeviceData();
    renderCreate(gate, onReady);
  });
}

async function signOutFromGate(gate: HTMLElement, onReady: Done) {
  try {
    await signOutAccount();
  } catch {
    /* still show the sign-in card */
  }
  renderAccount(gate, onReady);
}
