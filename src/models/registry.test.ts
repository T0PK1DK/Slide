import { afterEach, describe, expect, it } from "vitest";
import {
  clearHologramRenderers,
  mountHologram,
  registerHologramRenderer,
  resolveHologramRenderer,
} from "../look/hologram";
import { fallbackHologramMarkup } from "./fallback";
import {
  clearGhostCarRenderers,
  mountGhostCar,
  registerGhostCarRenderer,
  resolveGhostCarRenderer,
} from "./ghost-renderer";
import {
  FALLBACK_MODEL_KEY,
  GENERIC_MODEL_KEYS,
  GHOST_CAR_KEYS,
  HOLOGRAM_BRAND_KEYS,
  HOLOGRAM_MODEL_KEYS,
} from "./keys";
import { registerSlideModels, resetSlideModelsForTests } from "./register";
import { BRANDS, KNOWN_STORE_MODELS } from "../lib/stores/brands";
import { hasBrandModel, resolveGhostCarKey, resolveHologramModelKey } from "./resolve";
import { estimateStoreTriangles, storeRecipe, storeSignature } from "./store-meshes";
import { ghostCarSignature } from "./car-meshes";

function fakeEl(): HTMLElement {
  const flags = new Set<string>();
  const el = {
    innerHTML: "",
    dataset: {} as Record<string, string>,
    replaceChildren() {
      this.innerHTML = "";
    },
    classList: {
      add: (n: string) => flags.add(n),
      toggle: (n: string, on?: boolean) => {
        if (on) flags.add(n);
        else flags.delete(n);
      },
      contains: (n: string) => flags.has(n),
    },
  };
  return el as unknown as HTMLElement;
}

afterEach(() => {
  resetSlideModelsForTests();
  clearHologramRenderers();
  clearGhostCarRenderers();
});

describe("hologram model registry", () => {
  it("resolves a brand model, then the generic category, then *", () => {
    expect(resolveHologramModelKey("walmart")).toBe("walmart");
    expect(resolveHologramModelKey("Target")).toBe("target");
    expect(resolveHologramModelKey("generic-grocery")).toBe("generic-grocery");
    expect(resolveHologramModelKey("generic-fast_food")).toBe("generic-fast_food");
    expect(resolveHologramModelKey("no-such-chain")).toBe("*");
    expect(resolveHologramModelKey("")).toBe("*");
    expect(resolveHologramModelKey(undefined)).toBe("*");
  });

  it("covers Nard's 32 chains plus one generic per category and *", () => {
    expect(HOLOGRAM_BRAND_KEYS).toHaveLength(32);
    expect(HOLOGRAM_BRAND_KEYS).toEqual(KNOWN_STORE_MODELS);
    expect(HOLOGRAM_BRAND_KEYS).toEqual(BRANDS.map((b) => b.brandKey));
    expect(GENERIC_MODEL_KEYS).toEqual([
      "generic-grocery",
      "generic-pharmacy",
      "generic-fuel",
      "generic-fast_food",
      "generic-coffee",
      "generic-retail",
      "generic-other",
    ]);
    expect(HOLOGRAM_MODEL_KEYS.at(-1)).toBe(FALLBACK_MODEL_KEY);
    expect(hasBrandModel("shell")).toBe(true);
    expect(hasBrandModel("mystery")).toBe(false);
  });

  it("gives every model key a unique silhouette under a 250-triangle budget", () => {
    const signatures = HOLOGRAM_MODEL_KEYS.map((key) => storeSignature(key));
    expect(new Set(signatures).size).toBe(HOLOGRAM_MODEL_KEYS.length);
    for (const key of HOLOGRAM_MODEL_KEYS) {
      expect(storeRecipe(key).key).toBe(key);
      expect(estimateStoreTriangles(key)).toBeLessThanOrEqual(250);
    }
  });

  it("registers brand, generic, then * on Grim's hologram hook", () => {
    registerSlideModels();
    const brand = resolveHologramRenderer("walmart");
    const generic = resolveHologramRenderer("generic-pharmacy");
    const fallback = resolveHologramRenderer("totally-unknown");
    const star = resolveHologramRenderer("*");
    expect(brand).toBe(star);
    expect(generic).toBe(star);
    expect(fallback).toBe(star);

    const seen: string[] = [];
    clearHologramRenderers();
    registerHologramRenderer("walmart", (el) => {
      el.innerHTML = "brand";
      seen.push("brand");
    });
    registerHologramRenderer("generic-grocery", (el) => {
      el.innerHTML = "generic";
      seen.push("generic");
    });
    registerHologramRenderer("*", (el) => {
      el.innerHTML = "star";
      seen.push("star");
    });
    mountHologram(fakeEl(), { modelKey: "walmart", color: "#0071ce" });
    mountHologram(fakeEl(), { modelKey: "generic-grocery", color: "#3d8b37" });
    mountHologram(fakeEl(), { modelKey: "unknown-mart", color: "#888888" });
    expect(seen).toEqual(["brand", "generic", "star"]);
  });

  it("paints an SVG fallback tagged with the resolved key when WebGL is missing", () => {
    const html = fallbackHologramMarkup("walmart", "#0071ce");
    expect(html).toContain('data-model-key="walmart"');
    expect(html).toContain('data-holo-fallback="1"');
    expect(html).toContain("#0071ce");
    expect(html).not.toContain(".svg");
    expect(html).not.toContain("logo");

    registerSlideModels();
    const el = fakeEl();
    const dispose = mountHologram(el, { modelKey: "generic-fuel", color: "#ffd100" });
    expect(el.innerHTML).toContain('data-model-key="generic-fuel"');
    expect(el.innerHTML).toContain("data-holo-fallback");
    dispose();
    expect(el.innerHTML).toBe("");
  });
});

describe("ghost car registry", () => {
  it("maps garage ids onto sedan / suv / pickup / sports / default", () => {
    expect(resolveGhostCarKey("slipstream")).toBe("sports");
    expect(resolveGhostCarKey("brawler")).toBe("sports");
    expect(resolveGhostCarKey("hatch")).toBe("sedan");
    expect(resolveGhostCarKey("ridge")).toBe("suv");
    expect(resolveGhostCarKey("hauler")).toBe("pickup");
    expect(resolveGhostCarKey("unknown-ride")).toBe("default");
    expect(GHOST_CAR_KEYS).toEqual(["sedan", "suv", "pickup", "sports", "default"]);
    const signatures = GHOST_CAR_KEYS.map((key) => ghostCarSignature(key));
    expect(new Set(signatures).size).toBe(GHOST_CAR_KEYS.length);
  });

  it("resolves a typed car, then *", () => {
    registerGhostCarRenderer("sports", (el) => {
      el.innerHTML = "sports";
    });
    registerGhostCarRenderer("*", (el) => {
      el.innerHTML = "star";
    });
    expect(resolveGhostCarRenderer("sports")).not.toBe(resolveGhostCarRenderer("nope"));
    const a = fakeEl();
    const b = fakeEl();
    mountGhostCar(a, { carModelKey: "sports", color: "#f0a04b", headingDeg: 42, speedMps: 12 });
    mountGhostCar(b, { carModelKey: "mystery", color: "#7cf0d8" });
    expect(a.innerHTML).toBe("sports");
    expect(b.innerHTML).toBe("star");
  });
});
