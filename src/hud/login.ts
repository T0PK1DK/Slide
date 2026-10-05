import {
  currentCloudUser,
  peekAuthLinkResult,
  prepareAccount,
  sendMagicLink,
  signOutAccount,
  takeAuthLinkResult,
  verifyMagicCode,
  type AuthLinkResult,
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
 * show Sign in / Create account and the 6-digit code screen, then the
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
  const notice = peekAuthLinkResult();
  if (cloudConfigured() && !user) {
    renderAccount(gate, onReady, notice);
    return;
  }
  // First-time driver after a magic-link return: don't also pop Profile.
  if (user && notice && !existing) takeAuthLinkResult();
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

function renderAccount(gate: HTMLElement, onReady: Done, notice: AuthLinkResult | null, mode: "in" | "up" = "in") {
  const afterLink = takeAuthLinkResult() ?? notice;
  let pendingEmail = "";
  const paint = (view: "form" | "check") => {
    const title = mode === "up" ? "Create your account" : "Sign in";
    const sub =
      mode === "up"
        ? "Anyone can join. We'll email a 6-digit code. No password."
        : "We'll email a 6-digit code. Type it in this app. On a computer you can tap the link instead.";
    const go = mode === "up" ? "Email me a sign-up code" : "Email me a code";
    const switchLabel = mode === "up" ? "Already have an account? Sign in" : "New here? Create an account";
    const msg =
      afterLink && !afterLink.ok ? afterLink.message
        : afterLink?.ok ? "You're signed in. One moment…"
        : "";
    const codeHint = isStandalone()
      ? "Stay in this app and type the code. The email link opens Safari and will not sign the Home Screen app in."
      : "Type the 6-digit code here. On a computer or in Safari you can tap the link in the email instead.";
    if (view === "check") {
      gate.innerHTML = `
        <form class="login-card" novalidate>
          <span class="login-kicker">SLIDE</span>
          <h1 id="login-title">Enter your code</h1>
          <p class="login-sub">We sent a 6-digit code to ${esc(pendingEmail)}.</p>
          <label class="login-field login-code"><span>6-digit code</span>
            <input name="code" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" placeholder="000000" />
          </label>
          <p class="login-hint">${codeHint}</p>
          <p class="login-error" role="alert" hidden></p>
          <button class="primary login-go" type="submit">Sign in with code</button>
          <button class="ghost login-reset" type="button" data-resend>Resend code</button>
          <button class="ghost login-reset" type="button" data-restart>Use a different email</button>
        </form>`;
    } else {
      gate.innerHTML = `
        <form class="login-card" novalidate>
          <span class="login-kicker">SLIDE</span>
          <h1 id="login-title">${title}</h1>
          <p class="login-sub">${sub}</p>
          <label class="login-field"><span>Email</span>
            <input name="email" type="email" autocomplete="email" required placeholder="you@email.com" />
          </label>
          <p class="login-error" role="alert"${msg ? "" : " hidden"}>${esc(msg)}</p>
          <button class="primary login-go" type="submit">${go}</button>
          <p class="login-switch"><button type="button" class="login-text" data-switch>${switchLabel}</button></p>
          ${homeScreenHint()}
        </form>`;
    }
    const form = gate.querySelector("form")!;
    const err = gate.querySelector<HTMLElement>(".login-error")!;
    gate.querySelector<HTMLInputElement>('[name="email"], [name="code"]')?.focus();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      if (view === "check") {
        const code = String(data.get("code") ?? "").trim();
        if (!code) return showError(err, "Enter the 6-digit code from the email.");
        try {
          await verifyMagicCode(pendingEmail, code);
        } catch (ex) {
          return showError(err, ex instanceof Error ? ex.message : "That code didn't work.");
        }
        afterAccount(gate, onReady);
        return;
      }
      const email = String(data.get("email") ?? "").trim();
      if (!/.+@.+\..+/.test(email)) return showError(err, "Add a real email address.");
      const btn = form.querySelector<HTMLButtonElement>(".login-go")!;
      btn.disabled = true;
      try {
        await sendMagicLink(email);
        pendingEmail = email;
        paint("check");
      } catch (ex) {
        btn.disabled = false;
        showError(err, ex instanceof Error ? ex.message : "Couldn't send the email.");
      }
    });
    gate.querySelector("[data-switch]")?.addEventListener("click", () => {
      mode = mode === "up" ? "in" : "up";
      paint("form");
    });
    gate.querySelector("[data-resend]")?.addEventListener("click", async () => {
      try {
        await sendMagicLink(pendingEmail);
        showError(err, "Sent another code.");
      } catch (ex) {
        showError(err, ex instanceof Error ? ex.message : "Couldn't send the email.");
      }
    });
    gate.querySelector("[data-restart]")?.addEventListener("click", () => {
      pendingEmail = "";
      paint("form");
    });
  };
  if (afterLink?.ok && currentCloudUser()) {
    afterAccount(gate, onReady);
    return;
  }
  paint("form");
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
  const email = currentCloudUser()?.email;
  gate.innerHTML = `
    <form class="login-card" novalidate>
      <span class="login-kicker">SLIDE</span>
      <h1 id="login-title">Set up your driver</h1>
      <p class="login-sub">${email ? `Signed in as ${esc(email)}. Name and car stay on this phone, private to your account.` : cloudConfigured() ? "Name and car stay on this phone, private to your account." : "Everything stays on this phone. No email, no password."}</p>
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
  const email = currentCloudUser()?.email;
  gate.innerHTML = `
    <form class="login-card" novalidate>
      <span class="login-kicker">${esc(p.tag)}</span>
      <h1 id="login-title">Welcome back, ${esc(p.name)}</h1>
      <p class="login-sub">${email ? `Signed in as ${esc(email)}. ` : ""}Your garage, places and ghosts are saved ${cloudConfigured() ? "for this account" : "on this phone"}.</p>
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
  renderAccount(gate, onReady, null);
}
