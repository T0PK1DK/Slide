/**
 * Slide's rides: top-down, toy-car style vehicle designs drawn as SVG, so the
 * marker stays sharp at any zoom and costs no downloads. The driver picks a
 * model, a paint and a livery in the Garage; the Garage glow is the accent
 * (underglow, stripes, light trim).
 *
 * Every design here is original. Future collab packs (licensed game or brand
 * cars) are added as new entries with their own `pack` name — the marker,
 * Garage and save format don't change.
 */
export type StarterVehicleId = "slipstream" | "brawler" | "hatch" | "ridge" | "hauler" | "classic";
/** Extra original rides. Locked by the game layer until a level or badge opens them. */
export type UnlockVehicleId = "nimbus" | "glider";
export type VehicleId = StarterVehicleId | UnlockVehicleId;
export type StarterLivery = "solid" | "stripes" | "fade";
/** Extra original liveries. Locked by the game layer; no licensed brands. */
export type UnlockLivery = "halo" | "dusk";
export type Livery = StarterLivery | UnlockLivery;

export type Vehicle = {
  id: VehicleId;
  name: string;
  /** One-line flavour shown in the Garage. */
  kind: string;
  pack: string;
  /** Body outline, nose pointing up, in a 48×84 box. */
  body: string;
  /** Windshield / canopy / rear glass. */
  glass: string[];
  /** Painted panels that sit a shade lighter (roof, hood). */
  panels?: string[];
  /** Extra detail lines (vents, bed rails, roof rack), drawn dark. */
  details?: string[];
  /** Wheel boxes: [x, y, w, h]. */
  wheels: Array<[number, number, number, number]>;
  /** Headlight centres. */
  lights: Array<[number, number]>;
  /** Taillight y position and half-spread from centre. */
  tail: [number, number];
};

/** Liveries the Garage already lists. Unlockables live on `ALL_LIVERIES`. */
export const STARTER_LIVERIES: readonly StarterLivery[] = ["solid", "stripes", "fade"];
export const UNLOCK_LIVERIES: readonly UnlockLivery[] = ["halo", "dusk"];
export const LIVERIES: readonly Livery[] = STARTER_LIVERIES;
export const ALL_LIVERIES: readonly Livery[] = [...STARTER_LIVERIES, ...UNLOCK_LIVERIES];
export const LIVERY_LABEL: Record<Livery, string> = {
  solid: "Solid",
  stripes: "Stripes",
  fade: "Fade",
  halo: "Halo",
  dusk: "Dusk",
};

export const VEHICLES: readonly Vehicle[] = [
  {
    id: "slipstream", name: "Slipstream", kind: "Mid-engine hypercar", pack: "Slide Originals",
    body: "M24 4C30 4 36 10 38 22L40 44C41 56 40 70 36 78L12 78C8 70 7 56 8 44L10 22C12 10 18 4 24 4Z",
    glass: ["M24 24C30 24 33 30 33 37L32 49C30 53 18 53 16 49L15 37C15 30 18 24 24 24Z"],
    details: ["M17 60H31", "M18 64H30", "M19 68H29"],
    wheels: [[5, 16, 5, 12], [38, 16, 5, 12], [4, 56, 6, 13], [38, 56, 6, 13]],
    lights: [[17, 10], [31, 10]],
    tail: [76, 9],
  },
  {
    id: "brawler", name: "Brawler", kind: "V8 muscle coupe", pack: "Slide Originals",
    body: "M14 6H34C37 6 38 8 38 11L39 72C39 76 37 78 34 78H14C11 78 9 76 9 72L10 11C10 8 11 6 14 6Z",
    glass: ["M15 30H33L35 38H13Z", "M14 56H34L32 62H16Z"],
    panels: ["M13 38H35V56H13Z", "M20 12H28V24H20Z"],
    wheels: [[6, 14, 5, 12], [37, 14, 5, 12], [6, 58, 5, 12], [37, 58, 5, 12]],
    lights: [[15, 9], [33, 9]],
    tail: [77, 11],
  },
  {
    id: "hatch", name: "Pocket", kind: "Hot hatch", pack: "Slide Originals",
    body: "M24 10C33 10 37 14 37 22V66C37 72 34 74 24 74C14 74 11 72 11 66V22C11 14 15 10 24 10Z",
    glass: ["M14 26H34L32 33H16Z", "M16 60H32L33 66H15Z"],
    panels: ["M15 33H33V60H15Z"],
    wheels: [[8, 18, 5, 11], [35, 18, 5, 11], [8, 54, 5, 11], [35, 54, 5, 11]],
    lights: [[16, 14], [32, 14]],
    tail: [72, 10],
  },
  {
    id: "ridge", name: "Ridge", kind: "Trail SUV", pack: "Slide Originals",
    body: "M13 6H35C38 6 40 8 40 12V74C40 77 38 78 35 78H13C10 78 8 77 8 74V12C8 8 10 6 13 6Z",
    glass: ["M11 22H37L35 29H13Z", "M13 68H35L34 73H14Z"],
    panels: ["M12 29H36V68H12Z"],
    details: ["M15 33V64", "M33 33V64", "M15 40H33", "M15 50H33", "M15 60H33"],
    wheels: [[4, 14, 6, 13], [38, 14, 6, 13], [4, 58, 6, 13], [38, 58, 6, 13]],
    lights: [[14, 9], [34, 9]],
    tail: [77, 12],
  },
  {
    id: "hauler", name: "Hauler", kind: "Pickup truck", pack: "Slide Originals",
    body: "M13 4H35C38 4 40 6 40 10V76C40 79 38 80 35 80H13C10 80 8 79 8 76V10C8 6 10 4 13 4Z",
    glass: ["M11 18H37L35 25H13Z", "M13 38H35L34 41H14Z"],
    panels: ["M12 25H36V38H12Z"],
    details: ["M11 45H37V77H11Z", "M15 49V73", "M24 49V73", "M33 49V73"],
    wheels: [[4, 10, 6, 13], [38, 10, 6, 13], [4, 60, 6, 13], [38, 60, 6, 13]],
    lights: [[14, 7], [34, 7]],
    tail: [79, 12],
  },
  {
    id: "classic", name: "Classic", kind: "The original Slide wedge", pack: "Slide Originals",
    body: "M24 6L37 70C37 74 35 76 31 76H17C13 76 11 74 11 70Z",
    glass: ["M24 24L29 46H19Z"],
    wheels: [[9, 52, 5, 12], [34, 52, 5, 12]],
    lights: [[21, 14], [27, 14]],
    tail: [75, 8],
  },
];

/**
 * Unlockable originals. Not listed in the Garage picker yet (Grim's stage
 * will show them). `vehicleById` and garage migration still recognise them.
 */
export const UNLOCK_VEHICLES: readonly Vehicle[] = [
  {
    id: "nimbus", name: "Nimbus", kind: "Touring coupe", pack: "Slide Originals",
    body: "M24 5C32 5 37 12 38 22L40 50C41 64 38 76 32 80H16C10 76 7 64 8 50L10 22C11 12 16 5 24 5Z",
    glass: ["M16 26H32L34 36H14Z", "M15 58H33L32 66H16Z"],
    panels: ["M14 36H34V58H14Z"],
    details: ["M18 42H30", "M19 48H29"],
    wheels: [[5, 16, 5, 12], [38, 16, 5, 12], [4, 56, 6, 13], [38, 56, 6, 13]],
    lights: [[17, 10], [31, 10]],
    tail: [78, 9],
  },
  {
    id: "glider", name: "Glider", kind: "Low touring wagon", pack: "Slide Originals",
    body: "M11 10H37C41 10 43 14 43 20V70C43 75 39 78 33 78H15C9 78 5 75 5 70V20C5 14 7 10 11 10Z",
    glass: ["M10 22H38L36 30H12Z", "M12 62H36L35 70H13Z"],
    panels: ["M11 30H37V62H11Z"],
    details: ["M14 36H34", "M14 46H34", "M14 56H34"],
    wheels: [[3, 16, 6, 12], [39, 16, 6, 12], [3, 58, 6, 13], [39, 58, 6, 13]],
    lights: [[15, 13], [33, 13]],
    tail: [76, 11],
  },
];

export const ALL_VEHICLES: readonly Vehicle[] = [...VEHICLES, ...UNLOCK_VEHICLES];
export const VEHICLE_IDS: readonly VehicleId[] = ALL_VEHICLES.map((v) => v.id);

export function vehicleById(id: string): Vehicle {
  return ALL_VEHICLES.find((v) => v.id === id) ?? VEHICLES[0];
}

let uid = 0;

export type VehicleLook = { model: string; paint: string; accent: string; livery: Livery; ghost?: boolean };

/** The ride as an SVG string (48×84, nose up). Colours must already be validated hex. */
export function vehicleSvg(look: VehicleLook): string {
  const v = vehicleById(look.model);
  const id = `v${(uid++).toString(36)}`;
  const { paint, accent } = look;
  const op = look.ghost ? 0.55 : 1;
  const stripes = look.livery === "stripes"
    ? `<g clip-path="url(#${id}c)"><rect x="19.5" y="0" width="3" height="84" fill="${accent}"/><rect x="25.5" y="0" width="3" height="84" fill="${accent}"/></g>`
    : "";
  const fade = look.livery === "fade"
    ? `<path d="${v.body}" fill="url(#${id}f)"/>`
    : "";
  const dusk = look.livery === "dusk"
    ? `<path d="${v.body}" fill="url(#${id}d)"/>`
    : "";
  const halo = look.livery === "halo"
    ? `<g clip-path="url(#${id}c)"><rect x="22" y="0" width="4" height="84" fill="${accent}" opacity=".9"/></g><ellipse cx="24" cy="18" rx="8" ry="4.5" fill="none" stroke="${accent}" stroke-width="1.4" opacity=".85"/>`
    : "";
  const [ty, tx] = v.tail;
  return `<svg viewBox="0 0 48 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" opacity="${op}">
<defs>
<clipPath id="${id}c"><path d="${v.body}"/></clipPath>
<linearGradient id="${id}s" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".14"/><stop offset=".78" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>
<linearGradient id="${id}f" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stop-color="${accent}" stop-opacity=".95"/><stop offset=".55" stop-color="${accent}" stop-opacity="0"/></linearGradient>
<linearGradient id="${id}d" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity=".9"/><stop offset=".45" stop-color="${paint}" stop-opacity="0"/></linearGradient>
<filter id="${id}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
</defs>
<ellipse cx="24" cy="44" rx="19" ry="38" fill="${accent}" opacity=".45" filter="url(#${id}g)"/>
${v.wheels.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#0a0b0d"/>`).join("")}
<path d="${v.body}" fill="${paint}"/>
${fade}${dusk}${stripes}${halo}
${(v.panels ?? []).map((d) => `<path d="${d}" fill="#fff" opacity=".07"/>`).join("")}
<path d="${v.body}" fill="url(#${id}s)"/>
${(v.details ?? []).map((d) => `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.2" stroke-linecap="round"/>`).join("")}
${v.glass.map((d) => `<path d="${d}" fill="#0b1218"/><path d="${d}" fill="none" stroke="#8fb4d8" stroke-opacity=".35" stroke-width=".8"/>`).join("")}
${v.lights.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.6" fill="#fff6d8"/>`).join("")}
<rect x="${24 - tx - 2}" y="${ty - 1.6}" width="5" height="1.8" rx=".9" fill="#ff3b3b"/><rect x="${24 + tx - 3}" y="${ty - 1.6}" width="5" height="1.8" rx=".9" fill="#ff3b3b"/>
<path d="${v.body}" fill="none" stroke="${accent}" stroke-opacity=".55" stroke-width="1"/>
</svg>`;
}
