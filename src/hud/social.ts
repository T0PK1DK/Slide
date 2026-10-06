import { currentCloudUser, PASSWORD_MAX, PASSWORD_MIN, signInWithUsername, signUpWithUsername } from "../lib/account";
import { cloudConfigured } from "../lib/cloud";
import { stopPresence } from "../lib/presence";
import type { DriverProfile } from "../lib/profile";
import {
  carLabel,
  currentUserId,
  deleteAccount,
  follow,
  myCounts,
  myNetwork,
  myProfile,
  normalizeHandle,
  removeFollower,
  saveMyProfile,
  searchDrivers,
  signOut,
  unfollow,
  type PublicProfile,
  type Relation,
} from "../lib/social";

/**
 * The "Slide account" part of the Profile sheet: sign in with username + password (no email),
 * pick a @handle, then followers / following / friends and driver search.
 * Only the handle, name, car tag and (opt-in) car label are public.
 */
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Tab = "friends" | "followers" | "following";


export type ShareHooks = { sharing: () => boolean; setSharing: (on: boolean) => void };

export function renderSocial(box: HTMLElement, local: DriverProfile, share: ShareHooks) {
  if (!cloudConfigured()) {
    box.innerHTML = `<h3>Friends & followers</h3><p class="pf-note">Slide accounts aren't switched on for this build yet. Your profile works on this phone in the meantime.</p>`;
    return;
  }
  box.innerHTML = `<h3>Friends & followers</h3><p class="pf-note">Loading…</p>`;
  let mode: "in" | "up" = "in";
  let tab: Tab = "friends";

  const say = (msg: string) => {
    const el = box.querySelector<HTMLElement>(".sc-msg");
    if (el) el.textContent = msg;
  };
  const fail = (e: unknown) => say(e instanceof Error ? e.message : "Something went wrong.");

  const signedOut = () => {
    const up = mode === "up";
    box.innerHTML = `<h3>Friends & followers</h3>
      <p class="pf-note">Sign in to follow drivers and report on the radar. Anyone can create an account with a username and password. No email needed.</p>
      <form class="pf-form sc-account" novalidate>
        <label>Username<input name="username" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" maxlength="21" required /></label>
        <label>Password<input name="password" type="password" autocomplete="${up ? "new-password" : "current-password"}" minlength="${PASSWORD_MIN}" maxlength="${PASSWORD_MAX}" required /></label>
        <div class="pf-actions"><button type="submit" class="pf-save">${up ? "Create account" : "Sign in"}</button><button type="button" class="pf-link" data-mode>${up ? "Have an account? Sign in" : "New? Create an account"}</button></div>
      </form>
      <p class="sc-msg pf-note" role="status"></p>`;
    box.querySelector<HTMLFormElement>(".sc-account")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = new FormData(e.target as HTMLFormElement);
      const username = String(d.get("username") ?? "");
      const password = String(d.get("password") ?? "");
      try {
        if (up) await signUpWithUsername(username, password);
        else await signInWithUsername(username, password);
        await load();
      } catch (err) { fail(err); }
    });
    box.querySelector("[data-mode]")?.addEventListener("click", () => { mode = up ? "in" : "up"; signedOut(); });
  };

  const needsProfile = () => {
    const suggested = currentCloudUser()?.username ?? normalizeHandle(local.name.replace(/\s+/g, "_")) ?? "";
    box.innerHTML = `<h3>Pick your handle</h3>
      <form class="pf-form sc-create">
        <label>Handle<input name="handle" maxlength="21" value="@${esc(suggested)}" autocapitalize="none" autocomplete="username" required /></label>
        <label class="pf-check"><input type="checkbox" name="showCar" /> Show my car on my profile${local.car ? ` (${esc(carLabel(local.car) ?? "")})` : ""}</label>
        <button type="submit" class="pf-save">Create my driver profile</button>
      </form>
      <p class="pf-note">Public: your handle, name (${esc(local.name)}) and car tag (${esc(local.tag)}). Never public: your drives, places or location.</p>
      <p class="sc-msg pf-note" role="status"></p>`;
    box.querySelector<HTMLFormElement>(".sc-create")!.addEventListener("submit", async (e) => {
      e.preventDefault();
      const d = new FormData(e.target as HTMLFormElement);
      const handle = normalizeHandle(String(d.get("handle") ?? ""));
      if (!handle) return say("Handles are 3–20 letters, numbers or underscores.");
      try {
        await saveMyProfile({ handle, display_name: local.name.slice(0, 24), car_tag: local.tag, car_label: d.get("showCar") === "on" ? carLabel(local.car) : null });
        await load();
      } catch (err) { fail(err); }
    });
  };

  const personRow = (p: PublicProfile & Partial<Relation>) => {
    const btn = p.following
      ? `<button type="button" class="pf-link" data-unfollow="${p.id}">Following</button>`
      : `<button type="button" class="pf-save" data-follow="${p.id}">${p.followsYou ? "Follow back" : "Follow"}</button>`;
    const remove = tab === "followers" && p.followsYou ? `<button type="button" class="pf-x" data-remove="${p.id}" aria-label="Remove @${esc(p.handle)} as a follower">Remove</button>` : "";
    return `<li class="sc-person"><div class="pf-avatar sm" aria-hidden="true">${esc((p.display_name[0] ?? "?").toUpperCase())}</div>
      <div class="sc-who"><b>${esc(p.display_name)}</b><span>@${esc(p.handle)}${p.car_tag ? ` · ${esc(p.car_tag)}` : ""}${p.car_label ? ` · ${esc(p.car_label)}` : ""}</span></div>${btn}${remove}</li>`;
  };

  const signedIn = async (me: PublicProfile) => {
    const [counts, net] = await Promise.all([myCounts(), myNetwork()]);
    const lists: Record<Tab, Array<PublicProfile & Relation>> = {
      friends: net.filter((p) => p.following && p.followsYou),
      followers: net.filter((p) => p.followsYou),
      following: net.filter((p) => p.following),
    };
    const draw = () => {
      box.innerHTML = `<h3>Friends & followers</h3>
        <div class="sc-me"><b>@${esc(me.handle)}</b><span>${me.car_label ? esc(me.car_label) : "Car hidden on your profile"}</span></div>
        <div class="sc-tabs" role="tablist">
          ${(["friends", "followers", "following"] as Tab[]).map((t) => `<button type="button" role="tab" aria-selected="${t === tab}" class="sc-tab${t === tab ? " on" : ""}" data-tab="${t}"><b>${counts[t]}</b>${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
        </div>
        <ul class="sc-list">${lists[tab].length ? lists[tab].map(personRow).join("") : `<li class="pf-note">${tab === "friends" ? "Friends are people you follow who follow you back." : "No one here yet."}</li>`}</ul>
        <label class="switch sc-share"><span>Share my rough location with friends<small>About 1 km, only friends who follow you back, gone after 15 min. Never shown while driving.</small></span><input type="checkbox" data-share${share.sharing() ? " checked" : ""} /></label>
        <form class="pf-form sc-search" role="search"><label>Find drivers<input name="q" placeholder="@handle or name" autocomplete="off" /></label></form>
        <ul class="sc-list sc-results"></ul>
        <p class="sc-msg pf-note" role="status"></p>
        <div class="pf-actions wrap"><button type="button" class="pf-link" data-signout>Sign out</button><button type="button" class="pf-danger" data-delete>Delete my Slide account</button></div>`;
      bind();
    };
    const act = async (fn: () => Promise<void>) => { try { await fn(); await signedIn(me); } catch (err) { fail(err); } };
    const bindPeople = (root: ParentNode) => {
      root.querySelectorAll<HTMLButtonElement>("[data-follow]").forEach((b) => b.addEventListener("click", () => act(() => follow(b.dataset.follow!))));
      root.querySelectorAll<HTMLButtonElement>("[data-unfollow]").forEach((b) => b.addEventListener("click", () => act(() => unfollow(b.dataset.unfollow!))));
      root.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((b) => b.addEventListener("click", () => act(() => removeFollower(b.dataset.remove!))));
    };
    const bind = () => {
      box.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab as Tab; draw(); }));
      bindPeople(box.querySelector(".sc-list")!);
      let timer = 0;
      const input = box.querySelector<HTMLInputElement>(".sc-search input")!;
      box.querySelector(".sc-search")!.addEventListener("submit", (e) => e.preventDefault());
      input.addEventListener("input", () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(async () => {
          const out = box.querySelector<HTMLElement>(".sc-results")!;
          try {
            const found = (await searchDrivers(input.value)).filter((p) => p.id !== me.id);
            const rel = new Map(net.map((n) => [n.id, n]));
            out.innerHTML = found.map((p) => personRow({ ...p, ...(rel.get(p.id) ?? { following: false, followsYou: false }) })).join("") || (input.value.trim().length >= 2 ? `<li class="pf-note">No drivers found.</li>` : "");
            bindPeople(out);
          } catch (err) { fail(err); }
        }, 300);
      });
      box.querySelector<HTMLInputElement>("[data-share]")!.addEventListener("change", async (e) => {
        const on = (e.target as HTMLInputElement).checked;
        share.setSharing(on);
        if (!on) await stopPresence().catch(() => undefined);
        say(on ? "Friends can now see roughly where you are." : "Stopped sharing. Your position was removed.");
      });
      box.querySelector("[data-signout]")!.addEventListener("click", async () => { try { share.setSharing(false); await stopPresence().catch(() => undefined); await signOut(); location.reload(); } catch (err) { fail(err); } });
      box.querySelector("[data-delete]")!.addEventListener("click", async () => {
        if (!confirm("Delete your Slide account? Your profile, follows and reports are removed from the server. Drives on this phone stay.")) return;
        try { await deleteAccount(); await load(); } catch (err) { fail(err); }
      });
    };
    draw();
  };

  const load = async () => {
    try {
      if (!(await currentUserId())) return signedOut();
      const me = await myProfile();
      if (!me) return needsProfile();
      await signedIn(me);
    } catch (err) {
      box.innerHTML = `<h3>Friends & followers</h3><p class="pf-note">Can't reach Slide accounts right now.</p><p class="sc-msg pf-note" role="status"></p>`;
      fail(err);
    }
  };
  void load();
}
