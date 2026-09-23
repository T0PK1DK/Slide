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
 * Gate the app behind an on-device driver profile. Resolves immediately when the
 * driver is already signed in, so returning testers never see this screen.
 * The map keeps loading underneath while the gate is up.
 */
export function ensureSignedIn(root: HTMLElement, onReady: Done) {
  const existing = loadProfile();
  if (existing && isSignedIn()) {
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
  return `<p class="login-hint">Tip: add Slide to your Home Screen (Share → Add to Home Screen) so your phone keeps your garage and places.</p>`;
}

function renderCreate(gate: HTMLElement, onReady: Done) {
  gate.innerHTML = `
    <form class="login-card" novalidate>
      <span class="login-kicker">SLIDE · TEST DRIVE</span>
      <h1 id="login-title">Set up your driver</h1>
      <p class="login-sub">Everything stays on this phone. No email, no password.</p>
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
    };
    saveProfile(profile);
    finish(gate, profile, onReady);
  });
}

function renderWelcomeBack(gate: HTMLElement, p: DriverProfile, onReady: Done) {
  gate.innerHTML = `
    <form class="login-card" novalidate>
      <span class="login-kicker">${esc(p.tag)}</span>
      <h1 id="login-title">Welcome back, ${esc(p.name)}</h1>
      <p class="login-sub">Your garage, places and ghosts are saved on this phone.</p>
      ${p.pinHash ? `<label class="login-field"><span>PIN</span>
        <input name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="current-password" />
      </label>` : ""}
      <p class="login-error" role="alert" hidden></p>
      <button class="primary login-go" type="submit">Continue</button>
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
  gate.querySelector(".login-reset")!.addEventListener("click", () => {
    if (!confirm(`Erase ${p.name}'s garage, places and ghosts from this phone?`)) return;
    eraseDeviceData();
    renderCreate(gate, onReady);
  });
}

function showError(el: HTMLElement, msg: string) {
  el.textContent = msg;
  el.hidden = false;
}
