/**
 * Fill Grim's empty game slots. Unhide with `.hidden = false`.
 * Markup uses his tokens/classes; no CSS override layer.
 */
import {
  ALL_LIVERIES,
  ALL_VEHICLES,
  LIVERY_LABEL,
  vehicleById,
  vehicleSvg,
  type Livery,
  type VehicleId,
} from "../lib/vehicles";
import { mountCarStage, type CarStageHandle, type CarStageLook } from "../lib/game/carStage";
import {
  mountShareCard,
  shareTrip,
  unlockCatalog,
  unlockLabel,
  xpToNextLevel,
  type GameApi,
  type LeaderboardApi,
  type ShareCardMount,
  type TripAward,
} from "../lib/game";

export type RideRef = CarStageLook & { name: string; liveryLabel: string };

export type GameSlots = {
  showAward(award: TripAward | null, ride: RideRef): void;
  hideAward(): void;
  showStage(ride: RideRef): void;
  hideStage(): void;
  refreshStage(ride: RideRef): void;
  hide(): void;
  preview: {
    arrival(award: TripAward, ride: RideRef): void;
    share(award: TripAward, ride: RideRef): void;
    stage(ride: RideRef): void;
  };
};

export function hasArrivalAward(award: TripAward | null): boolean {
  if (!award || award.alreadyRecorded) return false;
  return award.xpEarned > 0 || award.leveledUp || award.badgesEarned.length > 0 || award.unlocks.length > 0;
}

function $(sel: string): HTMLElement | null {
  return document.querySelector(sel);
}

function paintBar(el: HTMLElement, into: number, need: number) {
  const pct = need > 0 ? Math.min(100, Math.round((into / need) * 100)) : 0;
  el.style.width = `${pct}%`;
}

function badgeLine(award: TripAward): string | null {
  const badge = award.badgesEarned[award.badgesEarned.length - 1];
  if (!badge) return null;
  return `${badge.name} · ${badge.tier}`;
}

export function mountGameSlots(opts: {
  game: GameApi;
  onSelect: (next: { vehicle?: VehicleId; livery?: Livery }) => void;
}): GameSlots {
  const xpEl = $("#arr-xp");
  const shareEl = $("#share-card-mount");
  const stageEl = $("#car-stage");
  let share: ShareCardMount | null = null;
  let stage: CarStageHandle | null = null;

  const hideShare = () => {
    share?.unmount();
    share = null;
    if (shareEl) {
      shareEl.replaceChildren();
      shareEl.hidden = true;
    }
  };

  const hideXp = () => {
    if (!xpEl) return;
    xpEl.replaceChildren();
    xpEl.hidden = true;
  };

  const disposeStage = () => {
    stage?.dispose();
    stage = null;
    if (stageEl) {
      stageEl.replaceChildren();
      stageEl.hidden = true;
    }
  };

  const paintXp = (award: TripAward) => {
    if (!xpEl) return;
    const bar = xpToNextLevel(award.xpTotal);
    const badge = badgeLine(award);
    xpEl.replaceChildren();
    const xp = document.createElement("b");
    xp.className = "arr-xp-xp";
    xp.textContent = `+${award.xpEarned} XP`;
    const lvl = document.createElement("span");
    lvl.className = "arr-xp-level";
    lvl.textContent = award.leveledUp ? `Level ${award.level}` : `Level ${bar.level}`;
    const rail = document.createElement("div");
    rail.className = "arr-xp-bar";
    rail.setAttribute("role", "progressbar");
    rail.setAttribute("aria-valuemin", "0");
    rail.setAttribute("aria-valuemax", String(bar.need));
    rail.setAttribute("aria-valuenow", String(bar.into));
    rail.setAttribute("aria-label", `Level ${bar.level} progress`);
    const fill = document.createElement("i");
    fill.className = "arr-xp-fill";
    paintBar(fill, bar.into, bar.need);
    rail.append(fill);
    xpEl.append(xp, lvl, rail);
    if (badge) {
      const chip = document.createElement("span");
      chip.className = "arr-xp-badge";
      chip.textContent = badge;
      xpEl.append(chip);
    }
    xpEl.hidden = false;
  };

  const paintShare = (award: TripAward, ride: RideRef) => {
    if (!shareEl) return;
    shareEl.replaceChildren();
    const frame = document.createElement("div");
    frame.className = "share-card-frame";
    const shareBtn = document.createElement("button");
    shareBtn.className = "primary";
    shareBtn.type = "button";
    shareBtn.textContent = "Share";
    const closeBtn = document.createElement("button");
    closeBtn.className = "ghost";
    closeBtn.type = "button";
    closeBtn.textContent = "Close";
    shareEl.append(frame, shareBtn, closeBtn);
    const input = { card: award.shareCard, ride: { name: ride.name, livery: ride.liveryLabel } };
    share = mountShareCard(frame, input);
    shareBtn.addEventListener("click", () => {
      void (share ? share.share() : shareTrip(input));
    });
    closeBtn.addEventListener("click", hideShare);
    shareEl.hidden = false;
  };

  const catalog = unlockCatalog();
  const reqFor = (type: "vehicle" | "livery", id: string) =>
    catalog.find((d) => d.type === type && d.id === id)?.req;

  const paintStageChrome = (ride: RideRef) => {
    if (!stageEl) return;
    const v = vehicleById(ride.vehicle);
    const canRide = opts.game.canUseVehicle(ride.vehicle);
    const canPaint = opts.game.canUseLivery(ride.livery);
    const rideReq = reqFor("vehicle", ride.vehicle);
    const livReq = reqFor("livery", ride.livery);
    const lockBits = [
      !canRide && rideReq ? `${v.name}: ${unlockLabel(rideReq)}` : null,
      !canPaint && livReq ? `${LIVERY_LABEL[ride.livery]}: ${unlockLabel(livReq)}` : null,
    ].filter(Boolean);

    let view = stageEl.querySelector<HTMLElement>(".car-stage-view");
    let meta = stageEl.querySelector<HTMLElement>(".car-stage-meta");
    let picks = stageEl.querySelector<HTMLElement>(".car-stage-picks");
    if (!view || !meta || !picks) {
      stageEl.replaceChildren();
      const close = document.createElement("button");
      close.className = "close car-stage-close";
      close.type = "button";
      close.setAttribute("aria-label", "Close car stage");
      close.textContent = "×";
      close.addEventListener("click", disposeStage);
      view = document.createElement("div");
      view.className = "car-stage-view";
      meta = document.createElement("div");
      meta.className = "car-stage-meta";
      picks = document.createElement("div");
      picks.className = "car-stage-picks";
      stageEl.append(close, view, meta, picks);
      stage = mountCarStage(view);
    }

    meta.replaceChildren();
    const name = document.createElement("b");
    name.textContent = v.name;
    const kind = document.createElement("span");
    kind.textContent = v.kind;
    meta.append(name, kind);
    const note = document.createElement("small");
    note.className = lockBits.length ? "car-stage-lock" : "car-stage-ok";
    note.textContent = lockBits.length ? lockBits.join(" · ") : "Ready to drive";
    meta.append(note);

    const rides = document.createElement("div");
    rides.className = "rides";
    rides.setAttribute("role", "radiogroup");
    rides.setAttribute("aria-label", "Stage ride");
    for (const r of ALL_VEHICLES) {
      const open = opts.game.canUseVehicle(r.id);
      const req = reqFor("vehicle", r.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `ride${r.id === ride.vehicle ? " on" : ""}${open ? "" : " locked"}`;
      btn.dataset.ride = r.id;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", String(r.id === ride.vehicle));
      btn.setAttribute("aria-label", open ? r.name : `${r.name}, locked, ${req ? unlockLabel(req) : "locked"}`);
      btn.innerHTML = `${vehicleSvg({ model: r.id, paint: ride.paint, accent: ride.accent, livery: ride.livery })}<span>${r.name}</span>${open ? "" : `<small>${req ? unlockLabel(req) : "Locked"}</small>`}`;
      btn.addEventListener("click", () => {
        const next: RideRef = { ...ride, vehicle: r.id, name: r.name };
        if (open) opts.onSelect({ vehicle: r.id });
        paintStageChrome(open ? { ...next } : next);
        void stage?.show(next);
      });
      rides.append(btn);
    }

    const liv = document.createElement("div");
    liv.className = "liveries";
    liv.setAttribute("role", "radiogroup");
    liv.setAttribute("aria-label", "Stage livery");
    for (const l of ALL_LIVERIES) {
      const open = opts.game.canUseLivery(l);
      const req = reqFor("livery", l);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.livery = l;
      btn.className = `${l === ride.livery ? "on" : ""}${open ? "" : " locked"}`;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", String(l === ride.livery));
      btn.setAttribute("aria-label", open ? LIVERY_LABEL[l] : `${LIVERY_LABEL[l]}, locked, ${req ? unlockLabel(req) : "locked"}`);
      btn.textContent = LIVERY_LABEL[l];
      if (!open && req) {
        const hint = document.createElement("small");
        hint.textContent = unlockLabel(req);
        btn.append(hint);
      }
      btn.addEventListener("click", () => {
        const next: RideRef = { ...ride, livery: l, liveryLabel: LIVERY_LABEL[l] };
        if (open) opts.onSelect({ livery: l });
        paintStageChrome(open ? { ...next } : next);
        void stage?.show(next);
      });
      liv.append(btn);
    }
    picks.replaceChildren(rides, liv);
    stageEl.hidden = false;
  };

  return {
    showAward(award, ride) {
      if (!hasArrivalAward(award) || !award) {
        hideXp();
        hideShare();
        return;
      }
      paintXp(award);
      paintShare(award, ride);
    },
    hideAward() {
      hideXp();
      hideShare();
    },
    showStage(ride) {
      paintStageChrome(ride);
      void stage?.show(ride);
    },
    hideStage: disposeStage,
    refreshStage(ride) {
      if (!stageEl || stageEl.hidden) return;
      paintStageChrome(ride);
      void stage?.show(ride);
    },
    hide() {
      hideXp();
      hideShare();
      disposeStage();
    },
    preview: {
      arrival(award) {
        disposeStage();
        hideShare();
        paintXp(award);
      },
      share(award, ride) {
        disposeStage();
        hideXp();
        paintShare(award, ride);
      },
      stage(ride) {
        hideXp();
        hideShare();
        paintStageChrome(ride);
        void stage?.show(ride);
      },
    },
  };
}

export function currentRide(
  garage: { vehicle: VehicleId; livery: Livery; carColor: string; glow: string }
): RideRef {
  const v = vehicleById(garage.vehicle);
  return {
    vehicle: garage.vehicle,
    livery: garage.livery,
    name: v.name,
    liveryLabel: LIVERY_LABEL[garage.livery],
    paint: garage.carColor,
    accent: garage.glow,
  };
}

export function demoAward(): TripAward {
  return {
    tripId: "preview",
    score: {
      total: 88,
      factors: { pace: 0.9, turn: 0.86, limit: 1 },
      scoredMiles: 3.2,
      overLimitMiles: 0,
      overLimitSec: 0,
      harshBrake: false,
      segments: 40,
    },
    xpEarned: 42,
    xpTotal: 122,
    level: 2,
    leveledUp: true,
    badgesEarned: [{ id: "first-line", name: "First Line", tier: "bronze" }],
    unlocks: [],
    shareCard: {
      score: 88,
      xp: 42,
      miles: 3.2,
      level: 2,
      badge: { name: "First Line", tier: "bronze" },
    },
    alreadyRecorded: false,
  };
}

declare global {
  interface Window {
    slidePreviewGame?: {
      arrival: () => void;
      share: () => void;
      stage: () => void;
    };
  }
}

export function bindBoardToggle(board: LeaderboardApi) {
  const box = document.querySelector<HTMLInputElement>("#g-board");
  if (!box) return;
  box.checked = board.isOptedIn();
  box.addEventListener("change", () => board.setOptIn(box.checked));
}
