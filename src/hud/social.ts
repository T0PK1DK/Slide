import { cloudConfigured } from "../lib/cloud";
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
  sendCode,
  signOut,
  unfollow,
  verifyCode,
  type PublicProfile,
  type Relation,
} from "../lib/social";

/**
 * The "Slide account" part of the Profile sheet: sign in with an emailed code,
 * pick a @handle, then followers / following / friends and driver search.
 * Only the handle, name, car tag and (opt-in) car label are public.
 */
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Tab = "friends" | "followers" | "following";

export function renderSocial(box: HTMLElement, local: DriverProfile) {
  if (!cloudConfigured()) {
    box.innerHTML = `<h3>Friends & followers</h3><p class="pf-note">Slide accounts aren't switched on for this build yet. Your profile works on this phone in the meantime.</p>`;
    return;
  }
  box.innerHTML = `<h3>Friends & followers</h3><p class="pf-note">Loading…</p>`;
  let pendingEmail = "";
  let tab: Tab = "friends";

  const say = (msg: string) => {
    const el = box.querySelector<HTMLElement>(".sc-msg");
    if (el) el.textContent = msg;
  };
  const fail = (e: unknown) => say(e instanceof Error ? e.message : "Something went wrong.");

  const signedOut = () => {
    box.innerHTML = `<h3>Friends & followers</h3>
      <p class="pf-note">Sign in to follow drivers, have followers, and report police, crashes and hazards on the radar. No password: we email you a 6-digit code.</p>
      ${pendingEmail
        ? `<form class="pf-form sc-code"><label>Code sent to ${esc(pendingEmail)}<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required /></label>
            <div class="pf-actions"><button type="submit" class="pf-save">Sign in</button><button type="button" class="pf-link" data-restart>Use a different email</button></div></form>`
        : `<form class="pf-form sc-email"><label>Email<input name="email" type="email" autocomplete="email" required /></label>
            <button type="submit" class="pf-save">Email me a code</button></form>`}
      <p class="sc-msg pf-note" role="status"></p>`;
    box.querySelector<HTMLFormElement>(".sc-email")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = String(new FormData(e.target as HTMLFormElement).get("email") ?? "");
      try { await sendCode(email); pendingEmail = email; signedOut(); say("Check your email for the code."); } catch (err) { fail(err); }
    });
    box.querySelector<HTMLFormElement>(".sc-code")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = String(new FormData(e.target as HTMLFormElement).get("code") ?? "");
      try { await verifyCode(pendingEmail, code); pendingEmail = ""; await load(); } catch (err) { fail(err); }
    });
    box.querySelector("[data-restart]")?.addEventListener("click", () => { pendingEmail = ""; signedOut(); });
  };

  const needsProfile = () => {
    const suggested = normalizeHandle(local.name.replace(/\s+/g, "_")) ?? "";
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
      box.querySelector("[data-signout]")!.addEventListener("click", async () => { try { await signOut(); await load(); } catch (err) { fail(err); } });
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
